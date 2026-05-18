/**
 * GET  /api/admin/hidden?slug=<gallery-slug>   — public, returns hidden image IDs
 * POST /api/admin/hidden                       — admin only, hide/unhide an image
 *
 * Requires KV binding: GALLERY_ADMIN
 * Requires env var:    ADMIN_PASSWORD
 */
import { validateToken } from "./_auth-utils.js";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;

function kvKey(slug) {
  return `hidden:${slug}`;
}

// GET — anyone can read hidden list (needed to filter on page load)
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const slug = url.searchParams.get("slug");

  if (!slug || !SLUG_RE.test(slug)) {
    return Response.json({ hidden: [] });
  }

  try {
    const raw = await context.env.GALLERY_ADMIN.get(kvKey(slug));
    const hidden = raw ? JSON.parse(raw) : [];
    return Response.json({ hidden });
  } catch {
    return Response.json({ hidden: [] });
  }
}

// POST — admin only: hide or unhide an image
export async function onRequestPost(context) {
  // Validate admin token
  const authHeader = context.request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const secret = context.env.ADMIN_PASSWORD;

  if (!secret) {
    return Response.json({ ok: false, error: "Not configured" }, { status: 500 });
  }

  if (!token || !(await validateToken(token, secret))) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { slug, imageId, action } = await context.request.json();

    // Validate inputs
    if (!slug || !SLUG_RE.test(slug)) {
      return Response.json({ ok: false, error: "Invalid slug" }, { status: 400 });
    }
    if (!imageId || typeof imageId !== "string" || imageId.length > 50) {
      return Response.json({ ok: false, error: "Invalid imageId" }, { status: 400 });
    }
    if (action !== "hide" && action !== "unhide") {
      return Response.json({ ok: false, error: "Action must be hide or unhide" }, { status: 400 });
    }

    // Read current hidden list
    const raw = await context.env.GALLERY_ADMIN.get(kvKey(slug));
    let hidden = raw ? JSON.parse(raw) : [];

    if (action === "hide") {
      if (!hidden.includes(imageId)) {
        hidden.push(imageId);
      }
    } else {
      hidden = hidden.filter((id) => id !== imageId);
    }

    // Write back
    await context.env.GALLERY_ADMIN.put(kvKey(slug), JSON.stringify(hidden));

    return Response.json({ ok: true, hidden });
  } catch (err) {
    return Response.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
}
