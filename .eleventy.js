module.exports = function(eleventyConfig) {

  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy({"src/admin": "admin"});
  eleventyConfig.addPassthroughCopy("src/admin/config.yml");

  // COLLECTION
  eleventyConfig.addCollection("stories", function(collectionApi) {
    return collectionApi
      .getFilteredByGlob("src/content/stories/*.md")
      .sort((a, b) => b.date - a.date);
  });

  // FILTER
  eleventyConfig.addFilter("formatDate", function(dateObj) {
    return new Date(dateObj).toLocaleDateString("en-IN", {
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