/**
 * GET  /api/gallery-likes?slug=<gallery-slug>   - public, returns like counts per image
 * POST /api/gallery-likes                       - public, increments or decrements a like count
 *
 * Requires KV binding: GALLERY_ADMIN
 */

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;
const CLIENT_ID_RE = /^[a-zA-Z0-9_-]{8,100}$/;

function kvKey(slug) {
  return `likes:${slug}`;
}

function normalizeState(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { counts: {}, voters: {} };
  }

  // Backward compatibility with the older plain-object counter format.
  if (!("counts" in raw) && !("voters" in raw)) {
    const counts = {};
    for (const [id, value] of Object.entries(raw)) {
      const num = Number(value);
      if (Number.isFinite(num) && num > 0) counts[id] = Math.floor(num);
    }
    return { counts, voters: {} };
  }

  const counts = {};
  const voters = {};

  if (raw.counts && typeof raw.counts === "object" && !Array.isArray(raw.counts)) {
    for (const [id, value] of Object.entries(raw.counts)) {
      const num = Number(value);
      if (Number.isFinite(num) && num > 0) counts[id] = Math.floor(num);
    }
  }

  if (raw.voters && typeof raw.voters === "object" && !Array.isArray(raw.voters)) {
    for (const [id, value] of Object.entries(raw.voters)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      voters[id] = {};
      for (const [clientId, voted] of Object.entries(value)) {
        if (voted && CLIENT_ID_RE.test(clientId)) voters[id][clientId] = true;
      }
    }
  }

  return { counts, voters };
}

function countVoters(votersForImage) {
  if (!votersForImage || typeof votersForImage !== "object") return 0;
  return Object.keys(votersForImage).length;
}

function syncCountsFromVoters(state) {
  const counts = {};
  for (const [imageId, votersForImage] of Object.entries(state.voters || {})) {
    const count = countVoters(votersForImage);
    if (count > 0) counts[imageId] = count;
  }
  state.counts = counts;
  return state;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const slug = url.searchParams.get("slug");

  if (!slug || !SLUG_RE.test(slug)) {
    return Response.json({ likes: {} });
  }

  try {
    const raw = await context.env.GALLERY_ADMIN.get(kvKey(slug));
    const state = raw ? syncCountsFromVoters(normalizeState(JSON.parse(raw))) : { counts: {}, voters: {} };
    return Response.json({ likes: state.counts });
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
  const clientId = body.clientId;
  if (!clientId || typeof clientId !== "string" || !CLIENT_ID_RE.test(clientId)) {
    return Response.json({ ok: false, error: "Invalid clientId" }, { status: 400 });
  }
  if (action !== "like" && action !== "unlike") {
    return Response.json({ ok: false, error: "Action must be like or unlike" }, { status: 400 });
  }

  try {
    const raw = await context.env.GALLERY_ADMIN.get(kvKey(slug));
    const state = raw ? syncCountsFromVoters(normalizeState(JSON.parse(raw))) : { counts: {}, voters: {} };
    const votersForImage = state.voters[imageId] || {};
    const hasVoted = !!votersForImage[clientId];

    if (action === "like") {
      if (!hasVoted) {
        votersForImage[clientId] = true;
        state.voters[imageId] = votersForImage;
      }
    } else if (hasVoted) {
      delete votersForImage[clientId];
      if (Object.keys(votersForImage).length) {
        state.voters[imageId] = votersForImage;
      } else {
        delete state.voters[imageId];
      }
    }

    syncCountsFromVoters(state);
    await context.env.GALLERY_ADMIN.put(kvKey(slug), JSON.stringify(state));

    return Response.json({ ok: true, likes: state.counts, count: state.counts[imageId] || 0 });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
