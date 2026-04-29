/* ─────────────────────────────────────────────────────────────
   MEMORYGRAPH CMS LOADER
   Reads content from /content folder and injects into pages.
   ───────────────────────────────────────────────────────────── */

(async function() {

  // ─── Helper: fetch JSON safely ───
  async function fetchJSON(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  // ─── Helper: fetch markdown frontmatter from a file ───
  async function fetchMD(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const text = await res.text();
      const match = text.match(/^---\n([\s\S]*?)\n---/);
      if (!match) return null;
      const frontmatter = {};
      match[1].split('\n').forEach(line => {
        const m = line.match(/^([a-z_]+):\s*(.+)$/);
        if (m) {
          let val = m[2].trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (!isNaN(val) && val !== '') val = Number(val);
          if (val === 'true') val = true;
          if (val === 'false') val = false;
          frontmatter[m[1]] = val;
        }
      });
      return frontmatter;
    } catch (e) { return null; }
  }

  // ─── Helper: get list of files in a folder via manifest ───
  async function fetchManifest(folder) {
    return await fetchJSON(`/content/${folder}/manifest.json`);
  }

  // ═════════════════════════════════════════════════════════
  // LOAD: SITE SETTINGS (contact info, social links)
  // ═════════════════════════════════════════════════════════
  const contact = await fetchJSON('/content/settings/contact.json');
  if (contact) {
    document.querySelectorAll('[data-cms="phone"]').forEach(el => el.textContent = contact.phone);
    document.querySelectorAll('[data-cms="email"]').forEach(el => {
      el.textContent = contact.email;
      if (el.tagName === 'A') el.href = `mailto:${contact.email}`;
    });
    document.querySelectorAll('[data-cms="whatsapp-link"]').forEach(el => {
      el.href = `https://wa.me/${contact.whatsapp}?text=Hi%20Arun%2C%20I%27d%20love%20to%20discuss%20my%20wedding.`;
    });
    document.querySelectorAll('[data-cms="address"]').forEach(el => el.innerHTML = contact.studio_address.replace(/\n/g, '<br>'));
    document.querySelectorAll('[data-cms="instagram"]').forEach(el => { if (contact.instagram_url) el.href = contact.instagram_url; });
    document.querySelectorAll('[data-cms="youtube"]').forEach(el => { if (contact.youtube_url) el.href = contact.youtube_url; });
    document.querySelectorAll('[data-cms="facebook"]').forEach(el => { if (contact.facebook_url) el.href = contact.facebook_url; });
  }

  // ═════════════════════════════════════════════════════════
  // LOAD: HOMEPAGE HERO + STATS
  // ═════════════════════════════════════════════════════════
  const homepage = await fetchJSON('/content/settings/homepage.json');
  if (homepage) {
    const setText = (sel, val) => { const el = document.querySelector(sel); if (el && val) el.textContent = val; };
    setText('[data-cms="hero-eyebrow"]', homepage.hero_eyebrow);
    setText('[data-cms="hero-subline"]', homepage.hero_subline);
    setText('[data-cms="weddings-per-year"]', homepage.weddings_per_year);
    setText('[data-cms="years-active"]', homepage.years_active);
    setText('[data-cms="total-weddings"]', homepage.total_weddings);

    // Hero video swap
    if (homepage.hero_video_url) {
      const heroFrame = document.querySelector('.hero-bg-frame');
      if (heroFrame) {
        heroFrame.innerHTML = `
          <video autoplay muted loop playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">
            <source src="${homepage.hero_video_url}" type="video/mp4">
          </video>
          <div style="position:absolute;inset:0;background:linear-gradient(to right, rgba(244,237,224,.4) 0%, transparent 40%);"></div>
        `;
      }
    }
  }

  // ═════════════════════════════════════════════════════════
  // LOAD: ABOUT PAGE
  // ═════════════════════════════════════════════════════════
  const about = await fetchJSON('/content/settings/about.json');
  if (about) {
    if (about.portrait_image) {
      const introImg = document.querySelector('.intro-img');
      if (introImg) {
        introImg.style.backgroundImage = `url('${about.portrait_image}')`;
        introImg.style.backgroundSize = 'cover';
        introImg.style.backgroundPosition = 'center';
        const ph = introImg.querySelector('.portrait-ph');
        if (ph) ph.style.display = 'none';
      }
    }
    const quoteEl = document.querySelector('[data-cms="intro-quote"]');
    if (quoteEl && about.intro_quote) quoteEl.textContent = `"${about.intro_quote}"`;
    const bioEl = document.querySelector('[data-cms="bio"]');
    if (bioEl && about.bio) bioEl.innerHTML = about.bio.replace(/\n/g, '<br><br>');
  }

  // ═════════════════════════════════════════════════════════
  // LOAD: WEDDING STORIES (homepage grid + stories page)
  // ═════════════════════════════════════════════════════════
  const storiesManifest = await fetchManifest('stories');
  if (storiesManifest && storiesManifest.files) {
    const stories = [];
    for (const file of storiesManifest.files) {
      const data = await fetchMD(`/content/stories/${file}`);
      if (data) stories.push(data);
    }
    stories.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    // Inject into homepage grid (max 5)
    const homepageGrid = document.querySelector('[data-cms="stories-grid"]');
    if (homepageGrid) {
      const featured = stories.find(s => s.featured) || stories[0];
      const others = stories.filter(s => s !== featured).slice(0, 4);
      let html = '';
      if (featured) {
        html += `
          <div class="story-card large">
            <div class="story-img">
              <div class="story-img-inner" style="background:url('${featured.hero_image}') center/cover;"></div>
              <div class="story-tag">Featured</div>
            </div>
            <div class="story-meta-block">
              <div class="story-name">${featured.couple_names}</div>
              <div class="story-meta">${featured.location} · ${featured.year}</div>
            </div>
          </div>`;
      }
      others.forEach(s => {
        html += `
          <div class="story-card">
            <div class="story-img">
              <div class="story-img-inner" style="background:url('${s.hero_image}') center/cover;"></div>
            </div>
            <div class="story-meta-block">
              <div class="story-name">${s.couple_names}</div>
              <div class="story-meta">${s.category} · ${s.location.split('·').pop().trim()} · ${s.year}</div>
            </div>
          </div>`;
      });
      homepageGrid.innerHTML = html;
    }

    // Inject into stories page full grid
    const fullGrid = document.querySelector('[data-cms="stories-full-grid"]');
    if (fullGrid) {
      let html = '';
      stories.forEach(s => {
        const filmTag = s.film_url ? '<div class="s-tag video">▶ Film</div>' : '';
        html += `
          <div class="story-card">
            <div class="s-img"><div class="s-img-inner" style="background:url('${s.hero_image}') center/cover;"></div><div class="s-noise"></div></div>
            ${filmTag}
            <div class="s-meta-block"><div class="s-name">${s.couple_names}</div><div class="s-meta">${s.category} · ${s.year}</div></div>
            <div class="s-hover"><div class="s-hover-btn">View Story</div></div>
          </div>`;
      });
      fullGrid.innerHTML = html;
    }
  }

  // ═════════════════════════════════════════════════════════
  // LOAD: TESTIMONIALS (homepage carousel)
  // ═════════════════════════════════════════════════════════
  const testManifest = await fetchManifest('testimonials');
  if (testManifest && testManifest.files) {
    const testimonials = [];
    for (const file of testManifest.files) {
      const data = await fetchMD(`/content/testimonials/${file}`);
      if (data && data.show_on_homepage) testimonials.push(data);
    }
    if (testimonials.length > 0 && window.setT) {
      // Override the global testimonials array if homepage has the rotator
      window.cmsTestimonials = testimonials.map(t => ({
        t: `"${t.quote}"`,
        a: `${t.couple_names} — ${t.location}`
      }));
    }
  }

  // ═════════════════════════════════════════════════════════
  // LOAD: BLOG POSTS (journal page)
  // ═════════════════════════════════════════════════════════
  const blogManifest = await fetchManifest('blog');
  if (blogManifest && blogManifest.files) {
    const posts = [];
    for (const file of blogManifest.files) {
      const data = await fetchMD(`/content/blog/${file}`);
      if (data) posts.push(data);
    }
    posts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const blogGrid = document.querySelector('[data-cms="blog-grid"]');
    if (blogGrid) {
      let html = '';
      posts.forEach(p => {
        html += `
          <article class="article-card">
            <div class="a-img">
              <div class="a-img-inner" style="background:url('${p.cover_image}') center/cover;"></div>
              <div class="a-noise"></div>
              <div class="a-cat">${p.category}</div>
            </div>
            <h3 class="a-title">${p.title}</h3>
            <p class="a-excerpt">${p.subtitle}</p>
            <div class="a-meta">${p.category} <div class="dot"></div> ${p.read_time}</div>
          </article>`;
      });
      blogGrid.innerHTML = html;
    }
  }

})();
