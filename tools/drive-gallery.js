#!/usr/bin/env node
/**
 * drive-gallery.js
 *
 * Fetches all images from a Google Drive shared folder and writes
 * direct image URLs into a client gallery markdown file's front matter.
 *
 * SETUP (one-time):
 *   1. Go to https://console.cloud.google.com
 *   2. Create a project → Enable "Google Drive API"
 *   3. Credentials → Create Credentials → API Key
 *   4. Copy the key into .env as GOOGLE_DRIVE_API_KEY=your_key
 *      Or pass it via --key flag
 *
 * USAGE:
 *   node tools/drive-gallery.js --folder "DRIVE_FOLDER_URL" --gallery "suvarna-karna"
 *   node tools/drive-gallery.js --folder "DRIVE_FOLDER_URL" --gallery "suvarna-karna" --key "YOUR_API_KEY"
 *   node tools/drive-gallery.js --folder "DRIVE_FOLDER_URL" --out urls.txt    (just list URLs)
 *
 * The Drive folder must be shared as "Anyone with the link can view".
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

// ── Parse CLI args ──
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const folderUrl = getArg("folder");
const gallerySlug = getArg("gallery");
const outputFile = getArg("out");
const apiKey = getArg("key") || process.env.GOOGLE_DRIVE_API_KEY || loadEnvKey();
const imageSize = getArg("size") || "1920";

function loadEnvKey() {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const m = line.match(/^GOOGLE_DRIVE_API_KEY\s*=\s*(.+)/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return null;
}

if (!folderUrl) {
  console.log(`
  Google Drive → Client Gallery Image Importer
  ─────────────────────────────────────────────

  Usage:
    node tools/drive-gallery.js --folder "DRIVE_URL" --gallery "slug" [--key API_KEY] [--size 1920]
    node tools/drive-gallery.js --folder "DRIVE_URL" --out urls.txt

  Options:
    --folder   Google Drive folder share link (required)
    --gallery  Client gallery filename slug, e.g. "suvarna-karna" (writes to front matter)
    --out      Output URLs to a text file instead of writing to a gallery
    --key      Google API key (or set GOOGLE_DRIVE_API_KEY in .env)
    --size     Image size in pixels (default: 1920)

  Setup:
    1. Google Cloud Console → Enable Google Drive API
    2. Create API Key → paste into .env as GOOGLE_DRIVE_API_KEY=xxx
    3. Share your Drive folder as "Anyone with the link can view"
  `);
  process.exit(0);
}

if (!apiKey) {
  console.error("\n  ERROR: No API key found.");
  console.error("  Set GOOGLE_DRIVE_API_KEY in .env or pass --key YOUR_KEY\n");
  process.exit(1);
}

// ── Extract folder ID ──
function extractFolderId(url) {
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{20,})$/
  ];
  for (const p of patterns) {
    const m = String(url).match(p);
    if (m) return m[1];
  }
  return null;
}

const folderId = extractFolderId(folderUrl);
if (!folderId) {
  console.error("\n  ERROR: Could not extract folder ID from URL:", folderUrl);
  process.exit(1);
}

// ── Fetch from Google Drive API ──
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    }).on("error", reject);
  });
}

async function listAllImages(folderId) {
  const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic"];
  const mimeQuery = imageTypes.map((t) => `mimeType='${t}'`).join(" or ");
  const query = `'${folderId}' in parents and (${mimeQuery}) and trashed=false`;

  let allFiles = [];
  let pageToken = null;

  do {
    const params = new URLSearchParams({
      q: query,
      key: apiKey,
      fields: "nextPageToken,files(id,name,mimeType,size,createdTime)",
      pageSize: "1000",
      orderBy: "name",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true"
    });
    if (pageToken) params.set("pageToken", pageToken);

    const url = `https://www.googleapis.com/drive/v3/files?${params}`;
    const data = await httpsGet(url);

    if (data.error) {
      console.error("\n  Google Drive API error:", data.error.message);
      if (data.error.code === 403) {
        console.error("  → Make sure the Drive API is enabled and the folder is shared publicly.\n");
      }
      process.exit(1);
    }

    allFiles = allFiles.concat(data.files || []);
    pageToken = data.nextPageToken;
  } while (pageToken);

  // Natural/numeric sort so S&K-96 comes before S&K-100
  allFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

  return allFiles;
}

function toDirectUrl(fileId, size) {
  return `https://lh3.googleusercontent.com/d/${fileId}=s${size}`;
}

// ── Write to gallery markdown ──
function writeToGallery(slug, imageUrls) {
  const galleryDir = path.join(__dirname, "..", "src", "content", "client-galleries");
  const filePath = path.join(galleryDir, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    console.error(`\n  ERROR: Gallery file not found: ${filePath}`);
    console.error(`  Available galleries:`);
    fs.readdirSync(galleryDir)
      .filter((f) => f.endsWith(".md") && f !== "client-galleries.json")
      .forEach((f) => console.error(`    - ${path.parse(f).name}`));
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf8");
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    console.error("  ERROR: Could not parse front matter in", filePath);
    process.exit(1);
  }

  // Build the gallery_drive_images YAML list
  const yamlList = imageUrls
    .map((url) => `  - "${url}"`)
    .join("\n");

  let frontMatter = fmMatch[1];

  // Remove existing gallery_drive_images block (handles LF and CRLF)
  frontMatter = frontMatter.replace(/gallery_drive_images:\s*\r?\n(?:\s+-\s+.*\r?\n)*/g, "");
  frontMatter = frontMatter.replace(/gallery_drive_images:\s*\[.*?\]\r?\n?/g, "");
  frontMatter = frontMatter.replace(/gallery_drive_images:\s*'[^']*'\r?\n?/g, "");
  frontMatter = frontMatter.replace(/gallery_drive_images:\s*"[^"]*"\r?\n?/g, "");

  // Add gallery_drive_images before the closing ---
  frontMatter = frontMatter.trimEnd() + `\ngallery_drive_images:\n${yamlList}`;

  const body = content.slice(fmMatch[0].length);
  const newContent = `---\n${frontMatter}\n---${body}`;

  fs.writeFileSync(filePath, newContent, "utf8");
  return filePath;
}

// ── Main ──
(async () => {
  console.log(`\n  Fetching images from Drive folder: ${folderId}`);
  console.log(`  Image size: ${imageSize}px\n`);

  const files = await listAllImages(folderId);

  if (files.length === 0) {
    console.log("  No images found in this folder.");
    console.log("  Make sure the folder is shared as 'Anyone with the link can view'.\n");
    process.exit(0);
  }

  console.log(`  Found ${files.length} images:\n`);

  const urls = files.map((f) => {
    const url = toDirectUrl(f.id, imageSize);
    const sizeKB = f.size ? `${Math.round(f.size / 1024)}KB` : "?";
    console.log(`    ${f.name} (${sizeKB}) → ${url.substring(0, 60)}...`);
    return url;
  });

  console.log("");

  if (outputFile) {
    // Write URLs to a text file
    fs.writeFileSync(outputFile, urls.join("\n") + "\n", "utf8");
    console.log(`  Wrote ${urls.length} URLs to ${outputFile}\n`);
  } else if (gallerySlug) {
    // Write to gallery markdown front matter
    const filePath = writeToGallery(gallerySlug, urls);
    console.log(`  Wrote ${urls.length} image URLs to ${path.basename(filePath)}`);
    console.log(`  Field: gallery_drive_images\n`);
  } else {
    // Just print URLs
    console.log("  Direct URLs (copy-paste ready):\n");
    urls.forEach((u) => console.log(`  ${u}`));
    console.log(`\n  Tip: Use --gallery "slug" to write directly to a gallery file.\n`);
  }
})();
