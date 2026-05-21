const fs = require("fs");
const path = require("path");

module.exports = function(eleventyConfig) {

  // Copy static folders
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/admin");

  // Collection
  eleventyConfig.addCollection("stories", function(collectionApi) {
    return collectionApi
      .getFilteredByGlob("src/content/stories/*.md")
      .sort((a, b) => b.date - a.date);
  });

  // Testimonials collection
  eleventyConfig.addCollection("testimonials", function(collectionApi) {
    return collectionApi
      .getFilteredByGlob("src/content/testimonials/*.md")
      .sort((a, b) => (a.data.order || 10) - (b.data.order || 10));
  });

  // ✅ THIS was missing / broken
  eleventyConfig.addFilter("formatDate", function(dateObj) {
    if (!dateObj) return "";
    const d = new Date(dateObj);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  });

  // Year shortcode — footer copyright
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  // Blog collection
  eleventyConfig.addCollection("blog", function(collectionApi) {
    return collectionApi
      .getFilteredByGlob("src/content/blog/*.md")
      .sort((a, b) => b.date - a.date);
  });

  // Client gallery collection
  eleventyConfig.addCollection("clientGalleries", function(collectionApi) {
    return collectionApi
      .getFilteredByGlob("src/content/client-galleries/*.md")
      .sort((a, b) => (a.data.title || "").localeCompare(b.data.title || ""));
  });

  // JSON filter for passing CMS gallery data to frontend scripts
  eleventyConfig.addFilter("json", function(value) {
    return JSON.stringify(value || null);
  });

  eleventyConfig.addFilter("isoDate", function(dateObj) {
    if (!dateObj) return "";
    return new Date(dateObj).toISOString();
  });

  eleventyConfig.addFilter("stripHtml", function(value) {
    return String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  });

  eleventyConfig.addFilter("wordCount", function(value) {
    return String(value || "")
      .replace(/<[^>]*>/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  });

  eleventyConfig.addFilter("readingTime", function(value) {
    const words = String(value || "")
      .replace(/<[^>]*>/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 220));
  });

  // Expands a client gallery folder into image items, merges Google Drive images,
  // then appends CMS quote/image blocks.
  eleventyConfig.addFilter("clientGalleryItems", function(manualItems, galleryFolder, driveImages, sections) {
    const items = [];
    const supported = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

    // 1. Local folder images
    if (galleryFolder) {
      const publicFolder = String(galleryFolder).replace(/\\/g, "/").replace(/^\/+/, "");
      const sourceFolder = path.join("src", publicFolder);
      if (fs.existsSync(sourceFolder) && fs.statSync(sourceFolder).isDirectory()) {
        fs.readdirSync(sourceFolder)
          .filter(file => supported.has(path.extname(file).toLowerCase()))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
          .forEach((file, index) => {
            const parsed = path.parse(file).name;
            const displayName = parsed.replace(/^\d+[-_\s]*/, "").replace(/[-_]+/g, " ").trim() || `Image ${index + 1}`;
            items.push({
              item_type: "image",
              image: `/${publicFolder}/${file}`,
              image_code: `MG-${String(index + 1).padStart(3, "0")}`,
              image_name: displayName.replace(/\b\w/g, char => char.toUpperCase()),
              category: "Gallery",
              caption: ""
            });
          });
      }
    }

    // 2. Google Drive images (URLs written by tools/drive-gallery.js or sync-gallery.js)
    // Supports both old format (plain URL strings) and new format (objects with url + name)
    if (Array.isArray(driveImages)) {
      driveImages.forEach((entry, index) => {
        if (!entry) return;
        const isObject = typeof entry === "object" && entry !== null;
        const url = isObject ? String(entry.url || "").trim() : String(entry).trim();
        const rawName = isObject ? String(entry.name || "").trim() : "";
        if (!url) return;
        // Derive display name from Drive filename (strip extension and prefix numbers)
        const driveName = rawName
          ? rawName.replace(/\.[^.]+$/, "")  // remove extension
          : `Image ${items.length + 1}`;
        items.push({
          item_type: "image",
          image: url,
          image_code: rawName ? rawName.replace(/\.[^.]+$/, "") : `MG-${String(items.length + 1).padStart(3, "0")}`,
          image_name: driveName,
          category: "Gallery",
          caption: ""
        });
      });
    }

    // 3. Manual CMS items (quotes, hand-picked images)
    const merged = items.concat(Array.isArray(manualItems) ? manualItems : []);

    // 4. Insert section divider markers at the correct positions
    // Sections are defined as [{name, start_file (filename), cover}]
    // Match by filename (e.g. "S&K-120.jpg") against image_code or the raw Drive filename
    if (Array.isArray(sections) && sections.length > 0) {
      const valid = sections.filter(s => s && s.name && s.start_file);
      // Find the index of each section's start file in the merged array
      const withIndex = valid.map(sec => {
        const target = String(sec.start_file).trim();
        const targetNoExt = target.replace(/\.[^.]+$/, "");
        let idx = merged.findIndex(item => {
          if (item.item_type !== "image") return false;
          // Match against image_code (which is filename without extension for Drive images)
          if (item.image_code && item.image_code === targetNoExt) return true;
          // Also try exact filename match against image_name
          if (item.image_name && item.image_name === targetNoExt) return true;
          return false;
        });
        return { ...sec, idx: idx >= 0 ? idx : -1 };
      }).filter(s => s.idx >= 0);
      // Sort descending so inserting doesn't shift later indices
      withIndex.sort((a, b) => b.idx - a.idx);
      withIndex.forEach(sec => {
        merged.splice(sec.idx, 0, {
          item_type: "section",
          section_name: sec.name,
          section_cover: sec.cover || "",
          section_start_file: sec.start_file
        });
      });
    }

    return merged;
  });

  // Flattens gallery data into a simple image list for masonry display.
  // Merges folder-based images with manual gallery entries.
  eleventyConfig.addFilter("storyGalleryImages", function(manualGallery, galleryFolder) {
    const images = [];
    const supported = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

    if (galleryFolder) {
      const publicFolder = String(galleryFolder).replace(/\\/g, "/").replace(/^\/+/, "");
      const sourceFolder = path.join("src", publicFolder);
      if (fs.existsSync(sourceFolder) && fs.statSync(sourceFolder).isDirectory()) {
        fs.readdirSync(sourceFolder)
          .filter(file => supported.has(path.extname(file).toLowerCase()))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
          .forEach(file => {
            images.push({ type: "image", src: `/${publicFolder}/${file}` });
          });
      }
    }

    if (Array.isArray(manualGallery)) {
      manualGallery.forEach(row => {
        if (row.layout === "quote" && row.text) {
          images.push({ type: "quote", text: row.text });
        } else if (Array.isArray(row.images)) {
          row.images.forEach(src => {
            if (src) images.push({ type: "image", src: src });
          });
        } else if (row.image) {
          images.push({ type: "image", src: row.image });
        }
      });
    }

    return images;
  });

  // Google Drive → direct image URL converter
  // Accepts any of these formats:
  //   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  //   https://drive.google.com/open?id=FILE_ID
  //   https://drive.google.com/uc?id=FILE_ID
  //   Just the raw FILE_ID string
  // Returns: https://lh3.googleusercontent.com/d/FILE_ID=s1920 (sized for web)
  eleventyConfig.addFilter("gdrive", function(url, size) {
    if (!url) return "";
    const s = String(url).trim();
    // Already a direct/local URL — pass through
    if (s.startsWith("/") || s.startsWith("http://") || (s.startsWith("https://") && !s.includes("drive.google.com") && !s.includes("docs.google.com"))) {
      return s;
    }
    // Extract file ID from various Google Drive URL formats
    let fileId = s;
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9_-]+)/,         // /file/d/ID/view
      /[?&]id=([a-zA-Z0-9_-]+)/,             // ?id=ID or &id=ID
      /\/d\/([a-zA-Z0-9_-]+)/,               // /d/ID
      /^([a-zA-Z0-9_-]{20,})$/                // raw ID (20+ chars)
    ];
    for (const p of patterns) {
      const m = s.match(p);
      if (m) { fileId = m[1]; break; }
    }
    const sz = size || 1920;
    return `https://lh3.googleusercontent.com/d/${fileId}=s${sz}`;
  });

  // absoluteUrl filter — story.njk OG image meta
  eleventyConfig.addFilter("absoluteUrl", function(path, base) {
    if (!path) return base || "";
    if (path.startsWith("http")) return path;
    return (base || "").replace(/\/$/, "") + (path.startsWith("/") ? path : "/" + path);
  });

  return {
    dir: {
      input: "src",
      output: "_site"
    }
  };
};
