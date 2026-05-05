/* ═══════════════════════════════════════════════════════════════════════
   Memorygraph Weddings — Shared Interactions & Animations
   GSAP + ScrollTrigger + Lenis + Vanilla JS
   ═══════════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════
  // 1. PRELOADER
  // ═══════════════════════════════════════════════
  const preloader = document.querySelector('.preloader');
  if (preloader) {
    // Trigger flash effect after line animation
    setTimeout(() => preloader.classList.add('flash'), 1400);
    // Hide preloader
    setTimeout(() => {
      preloader.classList.add('done');
      document.body.style.overflow = '';
      // Trigger hero animations after preloader
      setTimeout(() => {
        document.querySelectorAll('.hero-eyebrow, .hero-headline, .hero-subline, .hero-actions, .hero-meta, .hero-scroll')
          .forEach(el => el.style.animationPlayState = 'running');
      }, 300);
    }, 1800);
    document.body.style.overflow = 'hidden';
  }

  // ═══════════════════════════════════════════════
  // 2. LENIS SMOOTH SCROLL
  // ═══════════════════════════════════════════════
  let lenis;
  if (window.Lenis) {
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Connect Lenis to GSAP ScrollTrigger
    if (window.gsap && window.ScrollTrigger) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    }
  }

  // ═══════════════════════════════════════════════
  // 3. GSAP SCROLL ANIMATIONS
  // ═══════════════════════════════════════════════
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    // Reveal sections
    gsap.utils.toArray('.gsap-reveal').forEach((el, i) => {
      gsap.to(el, {
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          toggleActions: 'play none none none',
          once: true,
        },
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        delay: el.classList.contains('reveal-d1') ? 0.15 : el.classList.contains('reveal-d2') ? 0.3 : el.classList.contains('reveal-d3') ? 0.45 : 0,
      });
    });

    // Stagger words in headings
    gsap.utils.toArray('.stagger-words').forEach(heading => {
      if (heading.querySelector('.word-reveal, .gsap-reveal-word')) return; // skip if already processed
      const words = heading.textContent.trim().split(/\s+/).filter(w => w.length > 0);
      heading.innerHTML = words.map(w => `<span class="gsap-reveal-word"><span>${w}</span></span>`).join(' ');
      gsap.to(heading.querySelectorAll('.gsap-reveal-word > span'), {
        scrollTrigger: {
          trigger: heading,
          start: 'top 85%',
          once: true,
        },
        y: 0,
        duration: 0.8,
        stagger: 0.06,
        ease: 'power3.out',
      });
    });

    // Hero parallax
    const heroBg = document.querySelector('.hero-bg-frame');
    const heroText = document.querySelector('.hero-content');
    if (heroBg && heroText) {
      gsap.to(heroBg, {
        scrollTrigger: {
          trigger: '.hero',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
        y: 80,
        ease: 'none',
      });
      gsap.to(heroText, {
        scrollTrigger: {
          trigger: '.hero',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
        y: -40,
        opacity: 0.3,
        ease: 'none',
      });
    }

    // Process timeline
    gsap.utils.toArray('.process-tl-item').forEach((item, i) => {
      ScrollTrigger.create({
        trigger: item,
        start: 'top 60%',
        end: 'bottom 40%',
        onEnter: () => item.classList.add('active'),
        onLeave: () => item.classList.remove('active'),
        onEnterBack: () => item.classList.add('active'),
        onLeaveBack: () => item.classList.remove('active'),
      });
      gsap.from(item.querySelector('.tl-content'), {
        scrollTrigger: { trigger: item, start: 'top 80%', once: true },
        opacity: 0, y: 40, duration: 0.8, delay: i % 2 === 0 ? 0 : 0.15, ease: 'power3.out',
      });
    });

    // Service cards
    gsap.utils.toArray('.service-card').forEach((card, i) => {
      gsap.from(card, {
        scrollTrigger: { trigger: card, start: 'top 85%', once: true },
        opacity: 0, y: 50, duration: 0.8, delay: i * 0.12, ease: 'power3.out',
      });
    });

    // Story cards
    gsap.utils.toArray('.story-card').forEach((card, i) => {
      gsap.from(card, {
        scrollTrigger: { trigger: card, start: 'top 88%', once: true },
        opacity: 0, y: 40, duration: 0.7, delay: (i % 3) * 0.1, ease: 'power3.out',
      });
    });

    // Testimonial
    const testimonialSection = document.querySelector('.testimonial');
    if (testimonialSection) {
      gsap.from('.testimonial-inner', {
        scrollTrigger: { trigger: testimonialSection, start: 'top 75%', once: true },
        opacity: 0, y: 40, duration: 1, ease: 'power3.out',
      });
    }
  }

  // ═══════════════════════════════════════════════
  // 4. CUSTOM CURSOR
  // ═══════════════════════════════════════════════
  const cursor = document.getElementById('cursor');
  const cursorDot = document.getElementById('cursorDot');
  const cursorRing = document.getElementById('cursorRing');
  if (cursor && cursorDot && cursorRing && !window.matchMedia('(pointer: coarse)').matches) {
    let mx = 0, my = 0, rx = 0, ry = 0;
    document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
    function animateCursor() {
      cursorDot.style.left = mx + 'px'; cursorDot.style.top = my + 'px';
      rx += (mx - rx) * 0.15; ry += (my - ry) * 0.15;
      cursorRing.style.left = rx + 'px'; cursorRing.style.top = ry + 'px';
      requestAnimationFrame(animateCursor);
    }
    animateCursor();

    document.querySelectorAll('a, button, .magnetic, input, textarea, select, [role="button"]').forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursorRing.classList.add('hover');
        cursorRing.style.width = '48px'; cursorRing.style.height = '48px';
      });
      el.addEventListener('mouseleave', () => {
        cursorRing.classList.remove('hover');
        cursorRing.style.width = '28px'; cursorRing.style.height = '28px';
      });
    });
  }

  // ═══════════════════════════════════════════════
  // 5. MAGNETIC BUTTONS
  // ═══════════════════════════════════════════════
  document.querySelectorAll('.magnetic').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.25}px, ${y * 0.25}px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0,0)';
    });
  });



  // ═══════════════════════════════════════════════
  // 7. NAV SCROLL
  // ═══════════════════════════════════════════════
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
  }

  // ═══════════════════════════════════════════════
  // 8. LIGHTBOX
  // ═══════════════════════════════════════════════
  const lightbox = document.getElementById('lightbox');
  let lightboxImages = [];
  let lightboxIndex = 0;

  function openLightbox(src, caption) {
    if (!lightbox) return;
    lightboxImages = Array.from(document.querySelectorAll('[data-lightbox]')).map(el => ({
      src: el.dataset.lightbox || el.src,
      caption: el.dataset.caption || '',
    }));
    lightboxIndex = lightboxImages.findIndex(img => img.src === src);
    if (lightboxIndex === -1) { lightboxImages = [{src, caption}]; lightboxIndex = 0; }
    updateLightbox();
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();
  }

  function updateLightbox() {
    const img = lightbox.querySelector('.lightbox-img');
    const cap = lightbox.querySelector('.lightbox-caption');
    const current = lightboxImages[lightboxIndex];
    if (img) img.src = current.src;
    if (cap) cap.textContent = current.caption || `${lightboxIndex + 1} / ${lightboxImages.length}`;
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    if (lenis) lenis.start();
  }

  function nextLightbox() {
    lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
    updateLightbox();
  }
  function prevLightbox() {
    lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
    updateLightbox();
  }

  if (lightbox) {
    lightbox.querySelector('.lightbox-close')?.addEventListener('click', closeLightbox);
    lightbox.querySelector('.lightbox-next')?.addEventListener('click', (e) => { e.stopPropagation(); nextLightbox(); });
    lightbox.querySelector('.lightbox-prev')?.addEventListener('click', (e) => { e.stopPropagation(); prevLightbox(); });
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', e => {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextLightbox();
      if (e.key === 'ArrowLeft') prevLightbox();
    });
  }

  document.querySelectorAll('[data-lightbox]').forEach(el => {
    el.addEventListener('click', () => openLightbox(el.dataset.lightbox || el.src, el.dataset.caption));
  });

  // ═══════════════════════════════════════════════
  // 9. FLOATING LABELS VALIDATION
  // ═══════════════════════════════════════════════
  document.querySelectorAll('form[data-validate]').forEach(form => {
    form.addEventListener('submit', e => {
      let valid = true;
      form.querySelectorAll('.float-field [required]').forEach(field => {
        const wrap = field.closest('.float-field');
        if (!field.value.trim()) {
          valid = false;
          wrap.classList.add('error');
        } else {
          wrap.classList.remove('error');
        }
      });
      if (!valid) {
        e.preventDefault();
        form.querySelector('.float-field.error input, .float-field.error textarea')?.focus();
      }
    });
    form.querySelectorAll('.float-field input, .float-field textarea').forEach(field => {
      field.addEventListener('input', () => {
        if (field.value.trim()) field.closest('.float-field').classList.remove('error');
      });
    });
  });

  // ═══════════════════════════════════════════════
  // 10. TESTIMONIAL SWIPER SETUP
  // ═══════════════════════════════════════════════
  if (window.Swiper) {
    const testimonialSwiper = document.querySelector('.testimonial-swiper');
    if (testimonialSwiper) {
      const swiper = new Swiper(testimonialSwiper, {
        loop: true,
        speed: 800,
        autoplay: { delay: 6000, disableOnInteraction: false },
        effect: 'fade',
        fadeEffect: { crossFade: true },
        navigation: {
          nextEl: '.swiper-next',
          prevEl: '.swiper-prev',
        },
        on: {
          slideChange: function () {
            // Animate stars
            const active = testimonialSwiper.querySelector('.swiper-slide-active');
            if (active) {
              active.querySelectorAll('.star').forEach((star, i) => {
                star.classList.remove('animate');
                void star.offsetWidth; // force reflow
                setTimeout(() => star.classList.add('animate'), i * 80);
              });
            }
          },
        },
      });
      // Initial star animation
      setTimeout(() => {
        testimonialSwiper.querySelectorAll('.swiper-slide-active .star').forEach((star, i) => {
          setTimeout(() => star.classList.add('animate'), i * 80);
        });
      }, 500);
    }
  }

  // ═══════════════════════════════════════════════
  // 11. PAGE TRANSITIONS
  // ═══════════════════════════════════════════════
  const transitionOverlay = document.querySelector('.page-transition-overlay');
  document.querySelectorAll('a[href^="/"]').forEach(link => {
    if (link.target === '_blank') return;
    if (link.href.includes('#')) return;
    link.addEventListener('click', e => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http')) return;
      e.preventDefault();
      if (transitionOverlay) {
        transitionOverlay.classList.add('active');
      }
      setTimeout(() => {
        window.location.href = href;
      }, transitionOverlay ? 500 : 0);
    });
  });

  // ═══════════════════════════════════════════════
  // 12. HERO WORD-BY-WORD REVEAL
  // ═══════════════════════════════════════════════
  const heroHeadline = document.querySelector('.hero-headline');
  if (heroHeadline && !heroHeadline.dataset.revealed) {
    heroHeadline.dataset.revealed = 'true';
    const html = heroHeadline.innerHTML;
    // Split by lines (br tags) and words
    const lines = html.split(/<br\s*\/?>/i);
    heroHeadline.innerHTML = lines.map((line, li) => {
      // Temporarily wrap in a div to parse HTML
      const wrapper = document.createElement('div');
      wrapper.innerHTML = line.trim();
      const text = wrapper.textContent;
      const words = text.split(/\s+/).filter(w => w);
      let wordIndex = 0;
      // Reconstruct with HTML tags preserved
      let result = line.replace(/(<[^>]*>)|([^<>\s]+)/g, (match, tag, word) => {
        if (tag) return tag; // preserve HTML tags intact
        if (word && word.trim()) {
          const delay = (li * 0.3) + (wordIndex * 0.08) + 0.5;
          wordIndex++;
          return `<span class="word-reveal" style="display:inline-block;overflow:hidden;"><span style="display:inline-block;transform:translateY(110%);animation:fadeWord 0.8s ${delay}s cubic-bezier(.22,1,.36,1) forwards;">${word}</span></span>`;
        }
        return match;
      });
      return result;
    }).join('<br>');
  }

})();

// Keyframe for word reveal (injected via JS to avoid CSS file bloat)
const wordRevealStyle = document.createElement('style');
wordRevealStyle.textContent = `
  @keyframes fadeWord { to { transform: translateY(0); opacity: 1; } }
  .word-reveal > span { opacity: 0; }
`;
document.head.appendChild(wordRevealStyle);
