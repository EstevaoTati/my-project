/*
 * LES ÉLITES — motion design layer, shared by every page.
 *
 *   intro          gold curtain + emblem draw on the first page of a visit
 *   page curtain   internal links close a curtain, the next page opens it
 *   split titles   [data-split] headings rise word by word when they enter
 *   reveal         [data-reveal] elements fade/rise in (IntersectionObserver)
 *   magnetic       .btn / [data-magnetic] lean toward the pointer
 *   tilt           [data-tilt] cards and books tilt in 3D under the pointer
 *   book 3D        [data-book3d] drag / arrow keys to turn a real 3D book
 *   counters       [data-count] count up when visible
 *   cursor         a soft gold follower on fine pointers
 *
 * Everything degrades: without JS the content is static and complete; the
 * calm button (and classic mode) stops all of it. OS reduced-motion keeps
 * the reveals instant and drops the pointer effects (founder preference:
 * immersive by default, see docs/decisions).
 */
(function () {
  const root = document.documentElement;
  const calm = () => root.classList.contains('calm') || root.classList.contains('classic');
  const osReduce = () => root.classList.contains('os-reduce') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  root.classList.add('motion-ready');

  /* ---------- intro + page curtain ---------- */
  const curtain = document.createElement('div');
  curtain.className = 'curtain';
  curtain.setAttribute('aria-hidden', 'true');
  const base = document.body.dataset.base || '';
  curtain.innerHTML = `<div class="curtain-in"><img src="${base}assets/brand/emblem-gold.png" alt=""><span>LES ÉLITES</span></div>`;
  document.body.appendChild(curtain);
  let first = false;
  try { first = !sessionStorage.getItem('le.seen'); sessionStorage.setItem('le.seen', '1'); } catch (e) {}
  const fromNav = (() => { try { const v = sessionStorage.getItem('le.nav'); sessionStorage.removeItem('le.nav'); return v === '1'; } catch (e) { return false; } })();
  if (!calm() && !osReduce() && (first || fromNav)) {
    curtain.classList.add('is-closed', first ? 'is-intro' : 'is-nav');
    const open = () => requestAnimationFrame(() => curtain.classList.remove('is-closed'));
    if (first) setTimeout(open, 1250); else setTimeout(open, 120);
  }
  // Close the curtain before leaving for another page of the site.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === '_blank' || a.hasAttribute('download') || calm() || osReduce()) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || /^(mailto|tel):/.test(a.href)) return;
    if (url.pathname === location.pathname) return; // same page: anchors scroll normally
    e.preventDefault();
    try { sessionStorage.setItem('le.nav', '1'); } catch (err) {}
    curtain.classList.remove('is-intro');
    curtain.classList.add('is-nav', 'is-closed');
    setTimeout(() => { location.href = a.href; }, 520);
  });
  // Back/forward cache: never come back to a closed curtain.
  addEventListener('pageshow', (e) => { if (e.persisted) curtain.classList.remove('is-closed'); });

  /* ---------- split titles ---------- */
  function split(el) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((w) => {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
            const o = document.createElement('span'); o.className = 'w';
            const i = document.createElement('span'); i.className = 'wi'; i.textContent = w;
            o.appendChild(i); frag.appendChild(o);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !n.classList.contains('w')) walk(n);
      });
    };
    walk(el);
    el.querySelectorAll('.wi').forEach((w, k) => w.style.setProperty('--d', (k * 0.055).toFixed(3) + 's'));
  }
  const splitAll = () => document.querySelectorAll('[data-split]').forEach(split);
  splitAll();
  // i18n swaps text: re-split after a language change.
  document.addEventListener('le:lang', () => {
    document.querySelectorAll('[data-split]').forEach((el) => { delete el.dataset.splitDone; el.classList.remove('in'); });
    splitAll(); observeAll();
  });

  /* ---------- reveal on scroll ---------- */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;
  function observeAll() {
    document.querySelectorAll('[data-reveal]:not(.in), [data-split]:not(.in), [data-count]:not(.in)').forEach((el) => {
      if (!io || calm() || osReduce()) { el.classList.add('in'); count(el); return; }
      io.observe(el);
    });
  }
  // Counters start when revealed.
  function count(el) {
    if (!el.hasAttribute('data-count') || el.dataset.counted) return;
    el.dataset.counted = '1';
    const to = +el.dataset.count, dur = 1400, t0 = performance.now();
    if (calm() || osReduce()) { el.textContent = to; return; }
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  if (io) {
    const mo = new MutationObserver(() => observeAll());
    mo.observe(document.body, { childList: true, subtree: true });
    new MutationObserver((ms) => ms.forEach((m) => m.target.classList.contains('in') && count(m.target))).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
  }
  observeAll();
  document.addEventListener('le:mode', observeAll);

  /* ---------- magnetic buttons + tilt (fine pointers only) ---------- */
  if (fine) {
    document.addEventListener('pointermove', (e) => {
      if (calm() || osReduce()) return;
      const m = e.target.closest('.btn, [data-magnetic]');
      document.querySelectorAll('.is-magnet').forEach((b) => { if (b !== m) { b.classList.remove('is-magnet'); b.style.translate = ''; } });
      if (m) {
        const r = m.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width, dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        m.classList.add('is-magnet'); m.style.translate = `${(dx * 10).toFixed(1)}px ${(dy * 8).toFixed(1)}px`;
      }
      const t = e.target.closest('[data-tilt]');
      document.querySelectorAll('.is-tilt').forEach((c) => { if (c !== t) { c.classList.remove('is-tilt'); c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); } });
      if (t) {
        const r = t.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        t.classList.add('is-tilt');
        t.style.setProperty('--ry', (x * 14).toFixed(2) + 'deg'); t.style.setProperty('--rx', (-y * 10).toFixed(2) + 'deg');
        t.style.setProperty('--gx', ((x + 0.5) * 100).toFixed(1) + '%'); t.style.setProperty('--gy', ((y + 0.5) * 100).toFixed(1) + '%');
      }
    }, { passive: true });
  }

  /* ---------- cursor follower ---------- */
  if (fine) {
    const c = document.createElement('div'); c.className = 'cursor'; c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    let x = -100, y = -100, cx = x, cy = y, raf = 0;
    const loop = () => { cx += (x - cx) * 0.2; cy += (y - cy) * 0.2; c.style.transform = `translate3d(${cx}px, ${cy}px, 0)`; raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.3 ? requestAnimationFrame(loop) : 0; };
    document.addEventListener('pointermove', (e) => {
      if (calm() || osReduce()) { c.style.opacity = 0; return; }
      x = e.clientX; y = e.clientY; c.style.opacity = '';
      c.classList.toggle('is-link', !!e.target.closest('a, button, [data-tilt], [role=button], input, textarea, select'));
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener('pointerleave', () => { c.style.opacity = 0; });
  }

  /* ---------- interactive 3D book ---------- */
  document.querySelectorAll('[data-book3d]').forEach((wrap) => {
    const book = wrap.querySelector('.b3');
    if (!book) return;
    let ry = -28, rx = 6, drag = null, auto = true;
    const set = () => book.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    set();
    wrap.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, ry, rx }; auto = false; wrap.setPointerCapture(e.pointerId); wrap.classList.add('is-drag'); });
    wrap.addEventListener('pointermove', (e) => {
      if (!drag) return;
      ry = drag.ry + (e.clientX - drag.x) * 0.5; rx = Math.max(-25, Math.min(25, drag.rx - (e.clientY - drag.y) * 0.3)); set();
    });
    const end = () => { drag = null; wrap.classList.remove('is-drag'); };
    wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
    wrap.addEventListener('keydown', (e) => {
      const k = { ArrowLeft: -15, ArrowRight: 15 }[e.key];
      if (k) { e.preventDefault(); auto = false; ry += k; set(); }
      if (e.key === 'Home') { ry = -28; rx = 6; set(); }
    });
    // Idle: a slow turn so the object reads as 3D at a glance.
    let t0 = performance.now();
    const idle = (t) => {
      if (auto && !calm() && !osReduce()) { ry = -28 + Math.sin((t - t0) / 2200) * 22; set(); }
      if (auto) requestAnimationFrame(idle);
    };
    requestAnimationFrame(idle);
  });

  /* ---------- marquee: duplicate content for a seamless loop ---------- */
  document.querySelectorAll('[data-marquee]').forEach((m) => {
    const track = m.querySelector('.mq-track');
    if (track && !track.dataset.dup) { track.dataset.dup = '1'; track.innerHTML += track.innerHTML; track.querySelectorAll(':scope > *').forEach((n, i, all) => { if (i >= all.length / 2) n.setAttribute('aria-hidden', 'true'); }); }
  });
})();
