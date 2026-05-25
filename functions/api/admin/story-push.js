/**
 * POST /api/admin/story-push
 * Adds client gallery images to the linked story page via GitHub API.
 *
 * Body: { slug, imageUrls: [url, ...] }
 *   OR legacy: { slug, imageUrl }
 * Auth: Bearer <admin-token> (from /api/admin/auth)
 *
 * Env vars: ADMIN_PASSWORD, GITHUB_PAT, GITHUB_REPO
 */
import { validateToken } from "./_auth-utils.js";

/** Decode base64 to UTF-8 string (handles multi-byte chars) */
function b64decode(b64) {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Encode UTF-8 string to base64 */
function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function onRequestPost(context) {
  const authHeader = context.request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const secret = context.env.ADMIN_PASSWORD;

  if (!secret || !token || !(await validateToken(token, secret))) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const GITHUB_PAT = context.env.GITHUB_PAT;
  const GITHUB_REPO = context.env.GITHUB_REPO || "Arunthayyil/Memorygraph-Website";
  if (!GITHUB_PAT) {
    return Response.json({ ok: false, error: "GITHUB_PAT not configured" }, { status: 500 });
  }

  let body;
  try { body = await context.request.json(); } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { slug } = body;
  // Support both batch (imageUrls) and legacy single (imageUrl)
  const imageUrls = body.imageUrls || (body.imageUrl ? [body.imageUrl] : []);
  if (!slug || imageUrls.length === 0) {
    return Response.json({ ok: false, error: "Missing slug or imageUrls" }, { status: 400 });
  }

  const filePath = `src/content/stories/${slug}.md`;
  const ghHeaders = { Authorization: `Bearer ${GITHUB_PAT}`, Accept: "application/vnd.github.v3+json", "User-Agent": "Memorygraph-Admin" };

  try {
    // Fetch current file
    const fileRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}?ref=main`, { headers: ghHeaders });
    if (!fileRes.ok) {
      return Response.json({ ok: false, error: fileRes.status === 404 ? `Story not found: ${slug}` : `GitHub error ${fileRes.status}` }, { status: fileRes.status === 404 ? 404 : 500 });
    }

    const fileData = await fileRes.json();
    const content = b64decode(fileData.content);
    const sha = fileData.sha;

    // Parse front matter
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) {
      return Response.json({ ok: false, error: "Could not parse front matter" }, { status: 500 });
    }

    const fm = fmMatch[1];
    const bodyContent = content.slice(fmMatch[0].length);

    // Build new gallery entries — use layout: "image" to match CMS config
    const entries = imageUrls.map(url =>
      `  - layout: image\n    images:\n      - ${url}`
    ).join("\n");

    // Insert before "layout: story.njk" line (end of gallery list)
    let updatedFM;
    const layoutLine = fm.match(/^layout:\s*story\.njk$/m);
    if (layoutLine) {
      const pos = fm.indexOf(layoutLine[0]);
      updatedFM = fm.slice(0, pos) + entries + "\n" + fm.slice(pos);
    } else if (fm.includes("gallery:")) {
      updatedFM = fm + "\n" + entries;
    } else {
      updatedFM = fm + "\ngallery:\n" + entries;
    }

    // Commit via GitHub API — single atomic commit for all images
    const updated = `---\n${updatedFM}\n---${bodyContent}`;
    const commitRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
      method: "PUT",
      headers: { ...ghHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Add ${imageUrls.length} image${imageUrls.length > 1 ? "s" : ""} to ${slug} story`,
        content: b64encode(updated),
        sha,
        branch: "main"
      }),
    });

    if (!commitRes.ok) {
      const errBody = await commitRes.text();
      return Response.json({ ok: false, error: `Commit failed: ${commitRes.status}`, detail: errBody }, { status: 500 });
    }

    const commitData = await commitRes.json();
    return Response.json({ ok: true, count: imageUrls.length, commit: commitData.commit?.sha?.slice(0, 7) });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
