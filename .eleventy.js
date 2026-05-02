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

  return {
    dir: {
      input: "src",
      output: "_site"
    }
  };
};