/* ============================================================
   MWINDA DIGITAL — background video that keeps playing.

   Shared by index.html and bi.html. One implementation, because two copies of
   this logic drift and only one of them gets the next fix.

   `<video autoplay muted loop playsinline>` is the starting point, not the
   answer. What actually stops a background video in the field:

     · iOS Low Power Mode refuses programmatic play() outright.
     · Firefox and Safari block autoplay per-site once a user opts in.
     · Android data savers refuse to fetch it.
     · Chrome freezes background tabs and does not always resume media.
     · Safari's back/forward cache restores the page with the video paused.
     · A decoder dropped under memory pressure leaves a frozen frame and
       emits nothing at all.

   Each of those leaves a still image that looks like a bug. So: react to every
   signal that playback stopped, poll for the ones that emit no signal, and when
   the browser has genuinely refused, wait for the first human gesture instead
   of hammering an API that will keep saying no.

   The poster underneath is never removed, so every failure path shows the
   artwork rather than a black rectangle.
   ============================================================ */
(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const GESTURES = ['touchstart', 'pointerdown', 'click', 'keydown', 'scroll'];

  function init(video) {
    const layer = video.parentElement;
    if (!layer) return;

    // A metered connection is a real cost to a real person. The poster is a
    // complete experience; the clip is not worth someone's data plan.
    const net = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (net && (net.saveData === true || /^(slow-)?2g$/.test(net.effectiveType || ''))) {
      video.removeAttribute('autoplay');
      video.preload = 'none';
      return;
    }

    if (reduce.matches) {
      video.removeAttribute('autoplay');
      video.preload = 'none';
      return;
    }

    // Set as properties AND attributes. Safari gates autoplay on the muted
    // PROPERTY at play() time, while the parser gates on the attribute — and an
    // edit that drops one of them should not silently break playback.
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');   // older iOS and WebViews
    // Nothing here should ever surface in AirPlay or a cast picker.
    video.disableRemotePlayback = true;
    video.setAttribute('disableremoteplayback', '');

    let failures = 0;
    let waitingForHuman = false;

    const reveal = () => {
      failures = 0;
      layer.classList.add('video-ready');
      document.body.classList.add('has-video-bg');
    };
    const conceal = () => {
      layer.classList.remove('video-ready');
      document.body.classList.remove('has-video-bg');
    };

    video.addEventListener('playing', reveal);
    video.addEventListener('error', conceal);

    /* ---------- the one place play() is called ---------- */
    function play() {
      // Do not fight a refusal or a stated preference.
      if (waitingForHuman || reduce.matches || document.hidden) return;
      let p;
      try { p = video.play(); } catch { return; }
      if (p && typeof p.then === 'function') {
        p.then(() => { failures = 0; }).catch(() => {
          // Three refusals is a policy, not a hiccup.
          if (++failures >= 3) armGesture();
        });
      }
    }

    /* ---------- when the browser has said no ---------- */
    // Low Power Mode and per-site autoplay blocking only relent after a user
    // gesture. Take the first one that arrives — any kind — then stand down.
    function armGesture() {
      if (waitingForHuman) return;
      waitingForHuman = true;
      const opts = { passive: true, capture: true };

      const disarm = () => {
        waitingForHuman = false;
        GESTURES.forEach((t) => window.removeEventListener(t, kick, opts));
      };
      function kick() {
        // Bypass the guard: this call IS the gesture.
        waitingForHuman = false;
        failures = 0;
        let p;
        try { p = video.play(); } catch { waitingForHuman = true; return; }
        if (p && typeof p.then === 'function') {
          p.then(disarm).catch(() => { waitingForHuman = true; });
        } else {
          disarm();
        }
      }
      GESTURES.forEach((t) => window.addEventListener(t, kick, opts));
    }

    /* ---------- every signal that playback stopped ---------- */
    video.addEventListener('pause', () => { if (!document.hidden) play(); });
    video.addEventListener('ended', play);          // fires if `loop` is ever lost
    video.addEventListener('stalled', play);
    video.addEventListener('suspend', () => { if (video.paused) play(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) play(); });
    // Safari restores a bfcache page with media paused; `persisted` marks it.
    window.addEventListener('pageshow', (e) => { if (e.persisted) play(); });
    // Page Lifecycle: Chrome can freeze a background tab and resume it later.
    document.addEventListener('resume', play);

    /* ---------- and the stalls that emit nothing ---------- */
    let last = -1;
    const watchdog = setInterval(() => {
      if (!video.isConnected) { clearInterval(watchdog); return; }
      if (document.hidden || reduce.matches || waitingForHuman) return;
      if (video.paused) { play(); return; }
      // Reporting as playing while the clock stands still means the decoder is
      // wedged. Re-seeking is the cheapest way to shake it loose.
      if (video.currentTime === last && video.readyState >= 2) {
        video.currentTime = 0;
        play();
      }
      last = video.currentTime;
    }, 4000);

    /* ---------- honour a preference changed after load ---------- */
    const onPref = () => {
      if (reduce.matches) { video.pause(); conceal(); }
      else play();
    };
    if (typeof reduce.addEventListener === 'function') reduce.addEventListener('change', onPref);
    else if (typeof reduce.addListener === 'function') reduce.addListener(onPref);

    play();
  }

  function start() {
    document.querySelectorAll('.site-bg video, .hero-media video').forEach(init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
