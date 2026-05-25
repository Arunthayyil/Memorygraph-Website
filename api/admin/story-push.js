/**
 * POST /api/admin/story-push
 *
 * Adds an image from the client gallery to the linked story page
 * by committing a change to the story's markdown file via GitHub API.
 *
 * Body: { slug, imageUrl, layout? }
 * Headers: x-admin-key: <ADMIN_SECRET>
 *
 * Env vars required:
 *   ADMIN_SECRET     — admin password for this API
 *   GITHUB_PAT       — GitHub personal access token with repo scope
 *   GITHUB_REPO      — e.g. "Arunthayyil/Memorygraph-Website"
 */

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { slug, imageUrl, layout } = req.body || {};
  if (!slug || !imageUrl) {
    return res.status(400).json({ error: 'Missing slug or imageUrl' });
  }

  const GITHUB_PAT = process.env.GITHUB_PAT;
  const GITHUB_REPO = process.env.GITHUB_REPO || 'Arunthayyil/Memorygraph-Website';
  if (!GITHUB_PAT) {
    return res.status(500).json({ error: 'Server misconfigured: missing GITHUB_PAT' });
  }

  const filePath = `src/content/stories/${slug}.md`;
  const branch = 'main';

  try {
    // 1. Fetch the current file from GitHub
    const fileRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}?ref=${branch}`,
      { headers: { Authorization: `Bearer ${GITHUB_PAT}`, Accept: 'application/vnd.github.v3+json' } }
    );

    if (!fileRes.ok) {
      if (fileRes.status === 404) {
        return res.status(404).json({ error: `Story not found: ${slug}` });
      }
      const err = await fileRes.text();
      return res.status(500).json({ error: `GitHub API error: ${fileRes.status}`, detail: err });
    }

    const fileData = await fileRes.json();
    const content = Buffer.from(fileData.content, 'base64').toString('utf8');
    const sha = fileData.sha;

    // 2. Parse the front matter to find the gallery array
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      return res.status(500).json({ error: 'Could not parse front matter' });
    }

    const frontMatter = fmMatch[1];
    const bodyContent = content.slice(fmMatch[0].length);

    // 3. Build the new gallery entry
    const chosenLayout = layout || 'full';
    const newEntry = `  - layout: ${chosenLayout}\n    images:\n      - ${imageUrl}\n    text: ''`;

    // 4. Insert before the end of the gallery array (before 'layout: story.njk' line)
    // Find the last gallery entry and append after it
    let updatedFM;
    if (frontMatter.includes('gallery:')) {
      // Find the position right before the "layout: story.njk" line
      const layoutLineMatch = frontMatter.match(/^layout:\s*story\.njk$/m);
      if (layoutLineMatch) {
        const insertPos = frontMatter.indexOf(layoutLineMatch[0]);
        updatedFM = frontMatter.slice(0, insertPos) + newEntry + '\n' + frontMatter.slice(insertPos);
      } else {
        // Append to end of front matter
        updatedFM = frontMatter + '\n' + newEntry;
      }
    } else {
      // No gallery exists yet — create one
      updatedFM = frontMatter + '\ngallery:\n' + newEntry;
    }

    const updatedContent = `---\n${updatedFM}\n---${bodyContent}`;

    // 5. Commit the updated file via GitHub API
    const commitRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${GITHUB_PAT}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Add gallery image to ${slug} story`,
          content: Buffer.from(updatedContent).toString('base64'),
          sha,
          branch,
        }),
      }
    );

    if (!commitRes.ok) {
      const err = await commitRes.text();
      return res.status(500).json({ error: `Failed to commit: ${commitRes.status}`, detail: err });
    }

    const commitData = await commitRes.json();
    return res.status(200).json({
      ok: true,
      message: `Image added to ${slug} story`,
      commit: commitData.commit?.sha?.slice(0, 7),
    });
  } catch (err) {
    console.error('story-push error:', err);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
};
