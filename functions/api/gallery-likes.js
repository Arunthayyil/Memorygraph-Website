/**
 * GET  /api/gallery-likes?slug=<gallery-slug>   - public, returns like counts per image
 * POST /api/gallery-likes                       - public, increments or decrements a like count
 *
 * Requires KV binding: GALLERY_ADMIN
 */

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;

function kvKey(slug) {
  return `likes:${slug}`;
}

function normalizeCounts(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [id, value] of Object.entries(raw)) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) out[id] = Math.floor(num);
  }
  return out;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const slug = url.searchParams.get("slug");

  if (!slug || !SLUG_RE.test(slug)) {
    return Response.json({ likes: {} });
  }

  try {
    const raw = await context.env.GALLERY_ADMIN.get(kvKey(slug));
    const likes = raw ? normalizeCounts(JSON.parse(raw)) : {};
    return Response.json({ likes });
  } catch {
    return Response.json({ likes: {} });
  }
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { slug, imageId, action } = body || {};
  if (!slug || !SLUG_RE.test(slug)) {
    return Response.json({ ok: false, error: "Invalid slug" }, { status: 400 });
  }
  if (!imageId || typeof imageId !== "string" || imageId.length > 50) {
    return Response.json({ ok: false, error: "Invalid imageId" }, { status: 400 });
  }
  if (action !== "like" && action !== "unlike") {
    return Response.json({ ok: false, error: "Action must be like or unlike" }, { status: 400 });
  }

  try {
    const raw = await context.env.GALLERY_ADMIN.get(kvKey(slug));
    const likes = raw ? normalizeCounts(JSON.parse(raw)) : {};
    const current = Number(likes[imageId] || 0);

    if (action === "like") {
      likes[imageId] = current + 1;
    } else if (current > 0) {
      likes[imageId] = current - 1;
      if (likes[imageId] <= 0) delete likes[imageId];
    }

    await context.env.GALLERY_ADMIN.put(kvKey(slug), JSON.stringify(likes));

    return Response.json({ ok: true, likes, count: likes[imageId] || 0 });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
