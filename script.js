/* ============================================================
   MWINDA DIGITAL — Animations & Interactions
   ============================================================ */
(() => {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 900px)').matches;

  /* ---------- Welcome / boot ---------- */
  // Mark JS as ready so the hero hidden state can apply (CSS only kicks in here)
  document.documentElement.classList.add('js-ready');

  let bootDone = false;
  function boot() {
    if (bootDone) return;
    bootDone = true;
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('hidden');
    document.body.classList.add('loaded');
    runHeroAnim();
  }
  // Enter the welcome (hero) page as soon as the DOM is parsed — no loader delay.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  // Safety net for edge cases
  setTimeout(boot, 1500);

  /* ---------- Year ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Custom cursor ---------- */
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  if (dot && ring && !isMobile) {
    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rx = mx, ry = my;
    window.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });
    const animate = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      requestAnimationFrame(animate);
    };
    animate();

    document.querySelectorAll('a, button, [data-magnetic], .div-card, .eco-node, input, textarea, select').forEach(el => {
      el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
    });
  }

  /* ---------- Magnetic effect ---------- */
  if (!isMobile) {
    document.querySelectorAll('[data-magnetic]').forEach(el => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.18}px, ${y * 0.25}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- Nav: scroll state + burger ---------- */
  const nav = document.getElementById('nav');
  const burger = document.getElementById('navBurger');
  const navLinks = document.querySelector('.nav-links');
  window.addEventListener('scroll', () => {
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 30);
    const sp = document.getElementById('scrollProgress');
    if (sp) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      sp.style.width = ((window.scrollY / max) * 100) + '%';
    }
  });
  if (burger && navLinks) {
    burger.addEventListener('click', () => {
      burger.classList.toggle('open');
      navLinks.classList.toggle('open');
    });
    navLinks.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        burger.classList.remove('open');
        navLinks.classList.remove('open');
      }
    });
  }

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* ---------- Hero text animation (GSAP, with fallback) ---------- */
  function runHeroAnim() {
    const words = document.querySelectorAll('.hero-title .word');
    if (!window.gsap) {
      // Fallback: just show the words
      words.forEach(w => { w.style.transform = 'translateY(0)'; w.style.transition = 'transform .8s ease'; });
      return;
    }
    gsap.set(words, { yPercent: 110 });
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to(words, { yPercent: 0, duration: 1.2, stagger: 0.08 }, 0)
      .from('.hero-tag', { opacity: 0, y: 20, duration: 1 }, 0.1)
      .from('.hero-sub', { opacity: 0, y: 20, duration: 1 }, 0.4)
      .from('.hero-actions > *', { opacity: 0, y: 20, duration: 1, stagger: 0.1 }, 0.55)
      .from('.hero-meta > *', { opacity: 0, y: 20, duration: 1, stagger: 0.08 }, 0.7)
      .from('.hero-scroll', { opacity: 0, duration: 1 }, 0.9);
  }

  /* ---------- 3D Tilt + spotlight on division cards ---------- */
  document.querySelectorAll('.div-card.tilt').forEach(card => {
    if (isMobile) return;
    let rect = null;
    card.addEventListener('mouseenter', () => { rect = card.getBoundingClientRect(); });
    card.addEventListener('mousemove', (e) => {
      if (!rect) rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2, cy = rect.height / 2;
      const rx = ((y - cy) / cy) * -7;
      const ry = ((x - cx) / cx) * 8;
      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
      card.style.setProperty('--mx', x + 'px');
      card.style.setProperty('--my', y + 'px');
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      rect = null;
    });
  });

  /* ---------- Counters ---------- */
  const counterIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const dur = 1800;
      const start = performance.now();
      const fmt = (n) => {
        if (target >= 1000) return Math.round(n).toLocaleString('fr-FR') + suffix;
        return Math.round(n) + suffix;
      };
      const tick = (t) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * eased);
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = fmt(target);
      };
      requestAnimationFrame(tick);
      counterIO.unobserve(el);
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('[data-count]').forEach(el => counterIO.observe(el));

  /* ---------- Smooth anchor scroll ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      // Bare "#" or empty — block default scroll-to-top
      if (!id || id.length < 2) { e.preventDefault(); return; }
      const target = document.querySelector(id);
      if (!target) { e.preventDefault(); return; }
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 60;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  /* ---------- Contact form ---------- */
  // Used to spot form-stuffers: a human cannot read the page and submit in
  // under a couple of seconds.
  const pageLoadedAt = Date.now();
  const form = document.getElementById('contactForm');
  const formNote = document.getElementById('formNote');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = (window.i18n && window.i18n.t) ? window.i18n.t : (k => k);
      const name = form.querySelector('#name').value.trim();
      const email = form.querySelector('#email').value.trim();
      const topic = form.querySelector('#topic').value;
      const message = form.querySelector('#message').value.trim();
      if (!name || !email || !topic || !message) {
        formNote.textContent = t('form.err.empty');
        formNote.style.color = '#ff8a8a';
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        formNote.textContent = t('form.err.email');
        formNote.style.color = '#ff8a8a';
        return;
      }
      formNote.style.color = '';
      formNote.textContent = t('form.ok', { name: name.split(' ')[0] });

      // Record the lead server-side first. Until this existed, a visitor who
      // abandoned the WhatsApp hop — popup blocked, no WhatsApp installed,
      // changed their mind — was lost with no trace. Fire-and-forget: a
      // storage failure must never block the handoff.
      fetch('/.netlify/functions/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name, email: email, topic: topic, message: message,
          source: 'website', handedOff: true,
          website: (form.querySelector('#hp_site') || {}).value || '',
          elapsed: Date.now() - pageLoadedAt,
        }),
      }).catch(function () { /* the WhatsApp handoff below still happens */ });

      // Hand the message off to WhatsApp (business line) with everything prefilled.
      const waText = 'Nouveau message via mwindadigital' + String.fromCharCode(10) +
        'Nom / Name: ' + name + String.fromCharCode(10) +
        'Email: ' + email + String.fromCharCode(10) +
        'Pole: ' + topic + String.fromCharCode(10) + String.fromCharCode(10) + message;
      const waUrl = 'https://wa.me/17065725957?text=' + encodeURIComponent(waText);
      const waWin = window.open(waUrl, '_blank', 'noopener');
      if (!waWin) {
        // Popup blocked: give the visitor a direct link instead.
        formNote.innerHTML = '';
        const link = document.createElement('a');
        link.href = waUrl; link.target = '_blank'; link.rel = 'noopener';
        link.textContent = 'Ouvrir WhatsApp / Open WhatsApp →';
        formNote.appendChild(link);
      }
      form.reset();
    });
  }

  /* The Three.js hero — a gold wireframe icosahedron with orbital rings and a
     particle field — used to sit over the hero and across the page. It is gone
     on purpose: the background artwork (and the video, once one is dropped in)
     is now the only thing behind the page, and two competing gold light
     sources fought each other. Removing it also drops the three.js CDN script
     from this page entirely. See docs/hero-video.md. */

  /* ---------- Background video ----------
     Autoplay is only permitted for muted video, and even then a browser may
     refuse, a file may 404, or a codec may be unsupported. So the poster stays
     underneath and the video is only revealed on the `playing` event — the one
     signal that means frames are actually on screen. Anything short of that
     leaves the artwork we already ship.

     `loop` handles the "never stops" requirement; the watchdog handles the
     case where a backgrounded tab or a mobile power-saver pauses it. */
  function initBackgroundVideo(video) {
    const layer = video.parentElement;
    if (!layer) return;

    if (prefersReduced) {
      // Honour the preference at the source rather than merely hiding it.
      video.removeAttribute('autoplay');
      video.pause();
      return;
    }

    // Set in JS as well as markup: a muted video is the only kind a browser
    // will start on its own, and this must not depend on the attribute
    // surviving an edit.
    // These clips are 8-12 MB. Autoplaying them costs a metered visitor real
    // money, so honour the two signals a browser gives us about that. The
    // poster stays, which is a complete experience on its own.
    const net = navigator.connection;
    if (net && (net.saveData === true || /^(slow-)?2g$/.test(net.effectiveType || ''))) {
      video.removeAttribute('autoplay');
      video.preload = 'none';
      return;
    }

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.loop = true;

    const reveal = () => {
      layer.classList.add('video-ready');
      // Also on <body>, so text protection is a plain selector rather than a
      // chain of sibling combinators.
      document.body.classList.add('has-video-bg');
    };
    video.addEventListener('playing', reveal, { once: true });
    // A failure of any kind simply leaves the poster in place.
    video.addEventListener('error', () => {
      layer.classList.remove('video-ready');
      document.body.classList.remove('has-video-bg');
    });

    const attempt = () => {
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => { /* poster stands in */ });
    };
    attempt();

    // "Play forever" is not something `loop` alone guarantees. A background
    // video gets paused by things the page never hears about: a tab losing
    // focus, iOS Low Power Mode, a data saver, a decoder dropped under memory
    // pressure, or a stall that ends the stream early. Each of those leaves a
    // frozen frame that looks like a bug.
    //
    // So: restart on every signal that it stopped, plus a slow watchdog for
    // the stalls that emit no event at all. play() on an already-playing video
    // is a no-op, and the rejection is swallowed, so this is safe to call
    // often — it is deliberately infrequent all the same.
    video.addEventListener('pause', () => { if (!document.hidden) attempt(); });
    video.addEventListener('ended', attempt);      // fires if `loop` is ever lost
    video.addEventListener('stalled', attempt);
    video.addEventListener('suspend', () => { if (video.paused) attempt(); });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && video.paused) attempt();
    });

    let lastTime = -1;
    setInterval(() => {
      if (document.hidden) return;
      if (video.paused) { attempt(); return; }
      // Playing but the clock has not moved since the last check: the decoder
      // is wedged. Nudging currentTime forces it to re-seek and resume.
      if (video.currentTime === lastTime && video.readyState >= 2) {
        video.currentTime = 0;
        attempt();
      }
      lastTime = video.currentTime;
    }, 4000);
  }

  document.querySelectorAll('.site-bg video, .hero-media video').forEach(initBackgroundVideo);

  /* ---------- Reading scrim ----------
     The hero shows the video at roughly 90% strength. Every section below it is
     transparent, so page copy scrolls directly over the moving image — the
     scrim has to come back before the first paragraph does. Threshold is 55% of
     the hero, which puts the change well before any body text reaches the top
     of the viewport. */
  (() => {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    let ticking = false;
    const apply = () => {
      ticking = false;
      const past = window.scrollY > hero.offsetHeight * 0.55;
      document.body.classList.toggle('past-hero', past);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    apply();
  })();

  /* ---------- Parallax for hero glow ---------- */
  const heroGlow = document.querySelector('.hero-glow');
  if (heroGlow && !isMobile) {
    window.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 30;
      const y = (e.clientY / window.innerHeight - 0.5) * 30;
      heroGlow.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    });
  }

})();
