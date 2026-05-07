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

  // Expands a client gallery folder into image items, then merges CMS quote/image blocks.
  eleventyConfig.addFilter("clientGalleryItems", function(manualItems, galleryFolder) {
    const items = [];
    const supported = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
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
    return items.concat(Array.isArray(manualItems) ? manualItems : []);
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
