/*
 * THE HOUSE OF KNOWLEDGE — scroll-driven camera.
 *
 * No scroll hijacking: the page scrolls natively; this only READS scroll
 * position and maps it onto the stage. So wheel, keyboard, touch, anchors,
 * fast flicks and scrolling backwards all behave like any page.
 *
 *   chapter progress p ∈ [0,1]  (one per <section.chapter>)
 *     → --p on the chapter         (CSS-driven objects: shelf, manuscript)
 *     → .reveal[data-at] .on       (reversible: toggles both ways)
 *     → scene video currentTime    (scrubbed, smoothed, seek-guarded)
 *     → scene poster scale         (dolly-in when no video)
 *     → cross-fade to next scene   (last 14% of a chapter = the threshold)
 *
 * Videos load lazily (active + next scene only) and are skipped entirely in
 * classic mode, calm mode, prefers-reduced-motion and Save-Data.
 */
(function () {
  const root = document.documentElement;
  const stage = document.getElementById('stage');
  if (!stage) return;
  const chapters = [...document.querySelectorAll('.chapter')];
  const scenes = [...stage.querySelectorAll('.scene')];
  const railLinks = [...document.querySelectorAll('#rail a')];
  const railFill = document.getElementById('railFill');
  const nav = document.querySelectorAll('#navLinks a[href^="#"]');
  const FADE = 0.14;
  const conn = navigator.connection || {};
  const lowData = !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  const small = () => Math.min(innerWidth, innerHeight) < 700;

  chapters.forEach((c) => c.style.setProperty('--len', c.dataset.len || 2));

  const motion = () => !root.classList.contains('calm') && !root.classList.contains('classic');
  const videosAllowed = () => motion() && !lowData;

  /* ---------- media loading (posters always, videos when allowed) ---------- */
  const state = scenes.map((el) => ({ el, img: el.querySelector('.poster'), vid: el.querySelector('video'), t: 0, loaded: false, ok: false }));

  state.forEach((s) => {
    if (s.img) {
      s.img.addEventListener('load', () => s.img.classList.add('ready'), { once: true });
      s.img.addEventListener('error', () => s.img.remove(), { once: true });
    }
    if (s.vid) {
      s.vid.addEventListener('error', () => { s.vid.remove(); s.vid = null; }, { once: true });
      s.vid.addEventListener('loadeddata', () => { s.ok = true; s.vid.classList.add('ready'); s.vid.pause(); }, { once: true });
    }
  });
  function loadPoster(i) {
    const s = state[i];
    if (s && s.img && !s.img.src) s.img.src = s.img.dataset.src;
  }
  function loadVideo(i) {
    const s = state[i];
    if (!s || !s.vid || s.loaded || !videosAllowed()) return;
    s.loaded = true;
    const src = small() && s.vid.dataset.srcM ? s.vid.dataset.srcM : s.vid.dataset.src;
    // Try the mobile cut first on small screens, fall back to the main file.
    if (src !== s.vid.dataset.src) {
      s.vid.addEventListener('error', function retry() {
        if (s.vid && s.vid.getAttribute('src') !== s.vid.dataset.src) { s.vid.src = s.vid.dataset.src; s.vid.load(); }
      }, { once: true, capture: true });
    }
    s.vid.preload = 'auto';
    s.vid.src = src;
    s.vid.load();
  }
  loadPoster(0); loadPoster(1);

  /* ---------- geometry ---------- */
  let tops = [], spans = [], vh = innerHeight;
  function measure() {
    vh = innerHeight;
    tops = chapters.map((c) => c.getBoundingClientRect().top + scrollY);
    spans = chapters.map((c) => Math.max(1, c.offsetHeight - vh));
  }

  /* ---------- the frame ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  let target = scrollY, smooth = scrollY, raf = 0, lastActive = -1, mx = 0, my = 0, pmx = 0, pmy = 0;

  function frame() {
    raf = 0;
    const calm = !motion();
    smooth = calm ? target : smooth + (target - smooth) * 0.14;
    if (Math.abs(target - smooth) < 0.4) smooth = target;
    const y = smooth;

    // Which chapter owns the viewport?
    let active = 0;
    for (let i = 0; i < chapters.length; i++) if (y >= tops[i] - vh * 0.5) active = i;

    const ps = chapters.map((c, i) => clamp((y - tops[i]) / spans[i]));
    chapters.forEach((c, i) => {
      const p = ps[i];
      c.style.setProperty('--p', p.toFixed(4));
      c.querySelectorAll('.reveal[data-at]').forEach((el) => el.classList.toggle('on', calm || p >= +el.dataset.at));
      c.querySelectorAll('.reveal[data-out]').forEach((el) => el.classList.toggle('gone', !calm && p >= +el.dataset.out));
    });

    // Scene weights: the active scene is fully visible; near the end of its
    // chapter the next scene fades in over it — the "doorway" moment.
    const sceneOf = active;
    const pa = ps[sceneOf];
    const fadeIn = sceneOf < scenes.length - 1 ? clamp((pa - (1 - FADE)) / FADE) : 0;
    state.forEach((s, i) => {
      let o = 0;
      if (i === sceneOf) o = 1;
      if (i === sceneOf + 1) o = fadeIn;
      s.el.style.opacity = o;
      s.el.style.visibility = o > 0 ? 'visible' : 'hidden';
      if (o <= 0) return;
      // Local time in this scene: the incoming scene starts at its first frame.
      const p = i === sceneOf ? ps[i] : 0;
      // Threshold push: the outgoing scene scales up as we "walk through" it.
      const push = i === sceneOf ? 1 + fadeIn * 0.08 : 1.04 - fadeIn * 0.04;
      const dolly = s.ok && !calm ? 1 : 1 + (calm ? 0 : p * 0.12);
      const par = calm ? '' : ` translate3d(${(pmx * -10).toFixed(2)}px, ${(pmy * -6).toFixed(2)}px, 0)`;
      s.el.style.transform = `scale(${(push * dolly).toFixed(4)})${par}`;
      if (s.vid && s.ok && !calm) scrub(s, p);
    });

    if (active !== lastActive) {
      lastActive = active;
      [active, active + 1].forEach((i) => { loadPoster(i); loadVideo(i); });
      loadPoster(active + 2);
      railLinks.forEach((a, i) => (i === active ? a.setAttribute('aria-current', 'step') : a.removeAttribute('aria-current')));
      nav.forEach((a) => (a.getAttribute('href') === '#' + chapters[active].id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    }
    const total = tops[tops.length - 1] + spans[spans.length - 1] - tops[0];
    if (railFill) railFill.style.setProperty('--g', clamp((y - tops[0]) / total).toFixed(4));

    // Pointer parallax eases too.
    pmx += (mx - pmx) * 0.06; pmy += (my - pmy) * 0.06;
    if (Math.abs(target - smooth) > 0.4 || Math.abs(mx - pmx) > 0.002 || Math.abs(my - pmy) > 0.002) request();
  }

  // Seek only when the decoder is free, so a fast scroll never queues dozens
  // of seeks (the cause of "laggy" scrub). The last request always wins.
  function scrub(s, p) {
    const d = s.vid.duration;
    if (!d || !isFinite(d)) return;
    const want = Math.min(d - 0.05, p * d);
    if (s.vid.seeking || Math.abs(s.vid.currentTime - want) < 1 / 30) return;
    s.vid.currentTime = want;
  }

  function request() { if (!raf) raf = requestAnimationFrame(frame); }

  addEventListener('scroll', () => { target = scrollY; request(); }, { passive: true });
  addEventListener('resize', () => { measure(); target = scrollY; request(); });
  document.addEventListener('le:mode', () => { measure(); smooth = target = scrollY; request(); });
  // A seek that finished may not match the latest scroll yet: re-frame.
  state.forEach((s) => s.vid && s.vid.addEventListener('seeked', request));

  // Desktop-only, secondary, and off whenever motion is reduced.
  if (matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', (e) => {
      if (!motion()) return;
      mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; request();
    }, { passive: true });
  }

  // Background never moves while a panel is open.
  document.addEventListener('le:dialog', () => { mx = my = 0; request(); });

  // Fonts change heights; measure after they land.
  measure(); request();
  (document.fonts && document.fonts.ready || Promise.resolve()).then(() => { measure(); request(); });
  addEventListener('load', () => { measure(); request(); });
})();
