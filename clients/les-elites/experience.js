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
 *     → scene video                (plays continuously on a seamless
 *                                     boomerang loop while visible, pauses
 *                                     when off-stage — founder: "animated
 *                                     without stopping")
 *     → scroll SPEED → playbackRate (1× idle … 4× fast scroll) + blur
 *     → scroll PROGRESS → camera dolly-in (+22%) and tilt per room,
 *       outgoing room surging past (+30%, blur) at each doorway
 *     → cross-fade to next scene   (last 14% of a chapter = the threshold)
 *
 * Videos load lazily (active + next scene only) and are skipped entirely in
 * classic mode, calm mode (the in-page button) and Save-Data. The OS
 * reduced-motion setting keeps the footage but drops parallax and smoothing.
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
  const osReduce = () => root.classList.contains('os-reduce');

  /* ---------- media loading (posters always, videos when allowed) ---------- */
  const state = scenes.map((el) => ({ el, img: el.querySelector('.poster'), vid: el.querySelector('video'), t: 0, loaded: false, ok: false }));

  state.forEach((s) => {
    if (s.img) {
      s.img.addEventListener('load', () => s.img.classList.add('ready'), { once: true });
      s.img.addEventListener('error', () => s.img.remove(), { once: true });
    }
    if (s.vid) {
      s.vid.addEventListener('error', () => { s.vid.remove(); s.vid = null; }, { once: true });
      s.vid.addEventListener('loadeddata', () => { s.ok = true; s.vid.classList.add('ready'); root.classList.add('vid-' + s.el.dataset.scene); request(); }, { once: true });
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
  let target = scrollY, smooth = scrollY, raf = 0, lastActive = -1, mx = 0, my = 0, pmx = 0, pmy = 0, lastT = 0;
  let prevY = scrollY, speed = 0; // scroll speed, px/ms, eased

  function frame(now) {
    raf = 0;
    const calm = !motion();
    // Time-based easing: the same feel at 120, 60 or 15 fps. A per-frame
    // factor lags far behind on slow devices busy decoding video.
    const dt = Math.min(100, lastT ? now - lastT : 16.7);
    lastT = now;
    const k = 1 - Math.pow(1 - 0.14, dt / 16.7);
    smooth = calm || osReduce() ? target : smooth + (target - smooth) * k;
    if (Math.abs(target - smooth) < 0.4) smooth = target;
    const y = smooth;
    // Scroll speed drives the camera: scrolling makes the footage rush
    // forward (playbackRate), idle lets it ease back to cruising pace.
    const strong = !calm && !osReduce();
    const inst = Math.abs(y - prevY) / Math.max(1, dt);
    prevY = y;
    speed += (inst - speed) * (1 - Math.pow(inst > speed ? 0.6 : 0.92, dt / 16.7));
    if (speed < 0.005) speed = 0;
    const rate = strong ? 1 + Math.min(3, speed * 1.6) : 1;
    const blur = strong ? Math.min(2.5, Math.max(0, speed - 0.9) * 2) : 0;

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
      if (o <= 0) { if (s.vid && s.vid.playbackRate !== 1) s.vid.playbackRate = 1; return; }
      // Camera push driven by scroll: across a room the view dollies in
      // (+22%) and tilts up a little; at the doorway the outgoing room surges
      // past the viewer (+30%, motion blur) while the next one fades in.
      const p = i === sceneOf ? ps[i] : 0;
      const out = i === sceneOf ? fadeIn : 0;
      const dolly = calm || osReduce() ? 1 : 1 + p * 0.22 + out * 0.3;
      const lift = calm || osReduce() ? 0 : -p * 2.2;
      const par = strong ? ` translate3d(${(pmx * -12).toFixed(2)}px, ${(pmy * -7).toFixed(2)}px, 0)` : '';
      s.el.style.transform = `translateY(${lift.toFixed(3)}%) scale(${dolly.toFixed(4)})${par}`;
      const b = (i === sceneOf ? blur : 0) + out * 5 * (strong ? 1 : 0);
      s.el.style.filter = b > 0.15 ? `blur(${b.toFixed(2)}px)` : '';
      if (s.vid && s.ok && Math.abs(s.vid.playbackRate - rate) > 0.04) s.vid.playbackRate = rate;
    });
    root.style.setProperty('--scroll-speed', Math.min(1, speed / 2).toFixed(3));
    // Visible scenes play continuously; hidden ones pause (battery, CPU).
    state.forEach((s, i) => play(s, !calm && (i === sceneOf || (i === sceneOf + 1 && fadeIn > 0))));

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
    const kp = 1 - Math.pow(1 - 0.06, dt / 16.7);
    pmx += (mx - pmx) * kp; pmy += (my - pmy) * kp;
    if (Math.abs(target - smooth) > 0.4 || speed > 0 || Math.abs(mx - pmx) > 0.002 || Math.abs(my - pmy) > 0.002) request();
    else lastT = 0;
  }

  // Continuous playback. The clips are boomerang-encoded (forward then
  // reversed), so `loop` never jumps the camera back to its start.
  // If the browser refuses autoplay (iOS Low Power Mode), the poster stays and
  // the first tap/scroll gesture retries — the stage is never black.
  let blocked = false;
  function play(s, on) {
    if (!s.vid || !s.ok) return;
    if (on && s.vid.paused) {
      const pr = s.vid.play();
      if (pr && pr.catch) pr.catch(() => { blocked = true; });
    } else if (!on && !s.vid.paused) s.vid.pause();
  }
  const retry = () => { if (blocked) { blocked = false; lastActive = -2; request(); } };
  ['pointerdown', 'touchstart', 'keydown'].forEach((t) => addEventListener(t, retry, { passive: true }));

  function request() { if (!raf) { if (!lastT) lastT = 0; raf = requestAnimationFrame(frame); } }

  addEventListener('scroll', () => { target = scrollY; request(); }, { passive: true });
  addEventListener('resize', () => { measure(); target = scrollY; request(); });
  document.addEventListener('le:mode', () => { measure(); smooth = target = scrollY; request(); });

  // Desktop-only, secondary, and off whenever motion is reduced.
  if (matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', (e) => {
      if (!motion() || osReduce()) return;
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
