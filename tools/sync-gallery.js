#!/usr/bin/env node
/**
 * sync-gallery.js — One-command Google Drive → gallery sync
 *
 * Reads the gallery_drive_folder URL directly from the gallery markdown,
 * fetches all images from that Drive folder, and updates the file.
 *
 * USAGE:
 *   node tools/sync-gallery.js suvarna-karna
 *   node tools/sync-gallery.js --all              (sync every gallery that has a Drive folder)
 *   node tools/sync-gallery.js suvarna-karna --dry (preview without writing)
 *
 * The Drive folder URL is read from gallery_drive_folder in the markdown front matter.
 * API key is read from .env (GOOGLE_DRIVE_API_KEY).
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

// ── Config ──
const GALLERY_DIR = path.join(__dirname, "..", "src", "content", "client-galleries");
const IMAGE_SIZE = "1920";

// ── Load API key ──
function loadApiKey() {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^GOOGLE_DRIVE_API_KEY\s*=\s*(.+)/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return process.env.GOOGLE_DRIVE_API_KEY || null;
}

const apiKey = loadApiKey();

// ── Parse args ──
const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const syncAll = args.includes("--all");
const slugs = args.filter(a => !a.startsWith("--"));

if (!slugs.length && !syncAll) {
  console.log(`
  Sync Google Drive → Client Gallery
  ───────────────────────────────────

  Usage:
    node tools/sync-gallery.js <gallery-slug>       Sync one gallery
    node tools/sync-gallery.js --all                Sync all galleries with Drive folders
    node tools/sync-gallery.js <slug> --dry         Preview only (no file changes)

  Examples:
    node tools/sync-gallery.js suvarna-karna
    node tools/sync-gallery.js --all

  The script reads gallery_drive_folder from each gallery's front matter.
  API key is loaded from .env (GOOGLE_DRIVE_API_KEY).
  `);
  process.exit(0);
}

if (!apiKey) {
  console.error("\n  ERROR: No API key found in .env\n");
  process.exit(1);
}

// ── Helpers ──
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        else resolve(JSON.parse(data));
      });
    }).on("error", reject);
  });
}

function extractFolderId(url) {
  for (const p of [/\/folders\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/, /^([a-zA-Z0-9_-]{20,})$/]) {
    const m = String(url).match(p);
    if (m) return m[1];
  }
  return null;
}

async function listDriveImages(folderId) {
  const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic"];
  const mimeQuery = imageTypes.map((t) => `mimeType='${t}'`).join(" or ");
  const query = `'${folderId}' in parents and (${mimeQuery}) and trashed=false`;
  let allFiles = [], pageToken = null;
  do {
    const params = new URLSearchParams({
      q: query, key: apiKey,
      fields: "nextPageToken,files(id,name,mimeType,size)",
      pageSize: "1000", orderBy: "name",
      supportsAllDrives: "true", includeItemsFromAllDrives: "true"
    });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await httpsGet(`https://www.googleapis.com/drive/v3/files?${params}`);
    if (data.error) {
      console.error(`  API error: ${data.error.message}`);
      return null;
    }
    allFiles = allFiles.concat(data.files || []);
    pageToken = data.nextPageToken;
  } while (pageToken);
  allFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  return allFiles;
}

function parseFrontMatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
}

function readGalleryDriveFolder(fm) {
  const m = fm.match(/^gallery_drive_folder:\s*(.+)$/m);
  return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : null;
}

function countExistingDriveImages(fm) {
  const m = fm.match(/gallery_drive_images:\s*\r?\n((?:\s+-\s+.*\r?\n)*)/);
  if (!m) return 0;
  return (m[1].match(/^\s+-/gm) || []).length;
}

function writeGalleryImages(filePath, imageEntries) {
  const content = fs.readFileSync(filePath, "utf8");
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) { console.error(`  Could not parse front matter: ${filePath}`); return false; }

  let fm = fmMatch[1];
  // Remove old gallery_drive_images block (handles both old URL-only and new object format)
  fm = fm.replace(/gallery_drive_images:\s*\r?\n(?:\s+-[\s\S]*?)(?=\n[a-z_]|\n---|\s*$)/g, "");
  fm = fm.replace(/gallery_drive_images:\s*\[.*?\]\r?\n?/g, "");
  fm = fm.replace(/gallery_drive_images:\s*'[^']*'\r?\n?/g, "");
  fm = fm.replace(/gallery_drive_images:\s*"[^"]*"\r?\n?/g, "");

  // Build YAML list of objects with url + name
  const yamlList = imageEntries.map((e) =>
    `  - url: "${e.url}"\n    name: "${e.name}"`
  ).join("\n");
  fm = fm.trimEnd() + `\ngallery_drive_images:\n${yamlList}`;

  const body = content.slice(fmMatch[0].length);
  fs.writeFileSync(filePath, `---\n${fm}\n---${body}`, "utf8");
  return true;
}

// ── Main ──
async function syncGallery(slug) {
  const filePath = path.join(GALLERY_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    console.error(`  ✗ Gallery not found: ${slug}.md`);
    return false;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const fm = parseFrontMatter(content);
  if (!fm) { console.error(`  ✗ Bad front matter: ${slug}.md`); return false; }

  const driveUrl = readGalleryDriveFolder(fm);
  if (!driveUrl) {
    console.log(`  ⊘ ${slug} — no gallery_drive_folder set, skipping`);
    return false;
  }

  const folderId = extractFolderId(driveUrl);
  if (!folderId) {
    console.error(`  ✗ ${slug} — invalid Drive folder URL`);
    return false;
  }

  const existingCount = countExistingDriveImages(fm);
  console.log(`  ↻ ${slug} — fetching from Drive...`);

  const files = await listDriveImages(folderId);
  if (files === null) return false;

  const entries = files.map((f) => ({
    url: `https://lh3.googleusercontent.com/d/${f.id}=s${IMAGE_SIZE}`,
    name: f.name
  }));

  const added = entries.length - existingCount;
  const symbol = added > 0 ? "+" : added < 0 ? "" : "±";

  if (dryRun) {
    console.log(`  ✓ ${slug} — ${entries.length} images found (was ${existingCount}, ${symbol}${added}) [DRY RUN]`);
    return true;
  }

  if (writeGalleryImages(filePath, entries)) {
    console.log(`  ✓ ${slug} — ${entries.length} images written (was ${existingCount}, ${symbol}${added})`);
    return true;
  }
  return false;
}

(async () => {
  console.log(`\n  Drive Gallery Sync${dryRun ? " [DRY RUN]" : ""}\n`);

  let targets = slugs;
  if (syncAll) {
    targets = fs.readdirSync(GALLERY_DIR)
      .filter((f) => f.endsWith(".md"))
      .map((f) => path.parse(f).name);
  }

  let synced = 0;
  for (const slug of targets) {
    if (await syncGallery(slug)) synced++;
  }

  console.log(`\n  Done. ${synced}/${targets.length} galleries synced.\n`);
})();
