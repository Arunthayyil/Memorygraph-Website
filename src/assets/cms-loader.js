/* ============================================================
 * Memorygraph — cms-loader.js
 * ------------------------------------------------------------
 * Why this file exists
 *   Several pages (index, about, blog, investment, contact, success)
 *   reference <script src="/assets/cms-loader.js"></script>. That
 *   file was missing, so every page logged a 404 in the console.
 *
 * What it does
 *   - Stops the 404.
 *   - Acts as a SAFE NO-OP today: every element with a [data-cms]
 *     attribute already has hand-written fallback content in the
 *     HTML, so we leave that content alone.
 *   - Provides a tiny, future-proof `window.MGCMS` API so that
 *     when you wire up real Decap CMS / Netlify CMS data later,
 *     you can populate values from one place.
 *
 * Safe to ship as-is. No external network calls, no globals
 * leaked beyond `window.MGCMS`.
 * ============================================================ */

(function () {
  "use strict";

  // ---- Tiny helper: replace all [data-cms="key"] nodes ------
  function applyValues(map) {
    if (!map || typeof map !== "object") return 0;
    var count = 0;
    Object.keys(map).forEach(function (key) {
      var value = map[key];
      if (value === undefined || value === null) return;
      var nodes = document.querySelectorAll('[data-cms="' + key + '"]');
      nodes.forEach(function (node) {
        // Links: update href if value looks like a URL or contact target.
        if (node.tagName === "A" && /^(https?:|mailto:|tel:|wa\.me|\/)/i.test(String(value))) {
          node.setAttribute("href", value);
          return;
        }
        // Images: swap src.
        if (node.tagName === "IMG") {
          node.setAttribute("src", value);
          return;
        }
        // Everything else: replace text content.
        node.textContent = value;
      });
      count += nodes.length;
    });
    return count;
  }

  // ---- Public API ------------------------------------------
  // Usage (later, when you wire up CMS data):
  //   window.MGCMS.set({ email: "hello@example.com", phone: "+91 ..." });
  window.MGCMS = {
    version: "1.0.0",
    set: applyValues,
    // Convenience: load a JSON file from /assets/cms.json if present.
    // Silently does nothing if the file is missing — keeps console clean.
    loadFromJson: function (url) {
      url = url || "/assets/cms.json";
      try {
        return fetch(url, { cache: "no-store" })
          .then(function (r) {
            if (!r.ok) return null;
            return r.json();
          })
          .then(function (data) {
            if (data) applyValues(data);
            return data;
          })
          .catch(function () { return null; });
      } catch (e) {
        return Promise.resolve(null);
      }
    }
  };

  // ---- Intentionally do NOT auto-fetch anything ------------
  // The static fallback content in your HTML is already correct.
  // When you're ready to drive these from a CMS, call:
  //     window.MGCMS.loadFromJson();
  // or  window.MGCMS.set({ ...values });
})();
