/**
 * POST /api/admin/story-push
 * Adds a client gallery image to the linked story page via GitHub API.
 *
 * Body: { slug, imageUrl, layout? }
 * Auth: Bearer <admin-token> (from /api/admin/auth)
 *
 * Env vars: ADMIN_PASSWORD, GITHUB_PAT, GITHUB_REPO
 */
import { validateToken } from "./_auth-utils.js";

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

  const { slug, imageUrl, layout } = body;
  if (!slug || !imageUrl) {
    return Response.json({ ok: false, error: "Missing slug or imageUrl" }, { status: 400 });
  }

  const filePath = `src/content/stories/${slug}.md`;
  const headers = { Authorization: `Bearer ${GITHUB_PAT}`, Accept: "application/vnd.github.v3+json", "User-Agent": "Memorygraph-Admin" };

  try {
    // Fetch current file
    const fileRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}?ref=main`, { headers });
    if (!fileRes.ok) {
      return Response.json({ ok: false, error: fileRes.status === 404 ? `Story not found: ${slug}` : `GitHub error ${fileRes.status}` }, { status: fileRes.status === 404 ? 404 : 500 });
    }

    const fileData = await fileRes.json();
    const content = atob(fileData.content.replace(/\n/g, ""));
    const sha = fileData.sha;

    // Parse front matter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      return Response.json({ ok: false, error: "Could not parse front matter" }, { status: 500 });
    }

    const fm = fmMatch[1];
    const bodyContent = content.slice(fmMatch[0].length);
    const entry = `  - layout: ${layout || "full"}\n    images:\n      - ${imageUrl}\n    text: ''`;

    // Insert before "layout: story.njk" line, or append
    let updatedFM;
    const layoutLine = fm.match(/^layout:\s*story\.njk$/m);
    if (layoutLine) {
      const pos = fm.indexOf(layoutLine[0]);
      updatedFM = fm.slice(0, pos) + entry + "\n" + fm.slice(pos);
    } else {
      updatedFM = fm.includes("gallery:") ? fm + "\n" + entry : fm + "\ngallery:\n" + entry;
    }

    // Commit via GitHub API
    const updated = `---\n${updatedFM}\n---${bodyContent}`;
    const commitRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ message: `Add image to ${slug} story`, content: btoa(unescape(encodeURIComponent(updated))), sha, branch: "main" }),
    });

    if (!commitRes.ok) {
      return Response.json({ ok: false, error: `Commit failed: ${commitRes.status}` }, { status: 500 });
    }

    const commitData = await commitRes.json();
    return Response.json({ ok: true, commit: commitData.commit?.sha?.slice(0, 7) });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
