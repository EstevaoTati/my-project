/* The night sky behind every dark scene: twinkling stars, drifting champagne
 * particles, and a golden shower for the big moments.
 *
 * One 2D canvas, no WebGL: it costs a few hundred draw calls per frame, scales
 * its population to the screen and the device, pauses when the tab is hidden,
 * and draws ONE still frame under prefers-reduced-motion.
 *
 *   Sky.burst(xFrac, yFrac)  — golden shower at a viewport position (0..1)
 *   Sky.glow(0..1)           — how much gold drifts through the air
 */
(function () {
  "use strict";
  var canvas = document.getElementById("sky");
  if (!canvas || !canvas.getContext) { window.Sky = { burst: function () {}, glow: function () {} }; return; }

  var ctx = canvas.getContext("2d");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var lowPower = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
  var dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.75);
  var W = 0, H = 0, stars = [], motes = [], sparks = [], glow = 0.35, glowTarget = 0.35, raf = 0, last = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function populate() {
    var area = W * H;
    var nStars = Math.round(Math.min(lowPower ? 140 : 260, area / 5200));
    var nMotes = Math.round(Math.min(lowPower ? 24 : 48, area / 32000));
    stars = [];
    for (var i = 0; i < nStars; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.pow(Math.random(), 3) * 1.4 + 0.25,
        p: Math.random() * Math.PI * 2, s: rand(0.4, 1.6), warm: Math.random() < 0.18 });
    }
    motes = [];
    for (var j = 0; j < nMotes; j++) motes.push(newMote(true));
  }

  function newMote(anywhere) {
    return { x: Math.random() * W, y: anywhere ? Math.random() * H : H + 10, r: rand(0.6, 2.2),
      vx: rand(-6, 6), vy: rand(-16, -5), p: Math.random() * 6.28, a: rand(0.25, 0.8) };
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    populate();
    if (reduced) draw(0, 0);
  }

  function draw(t, dt) {
    ctx.clearRect(0, 0, W, H);
    // stars
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = reduced ? 0.8 : 0.55 + 0.45 * Math.sin(t * 0.001 * s.s + s.p);
      ctx.globalAlpha = tw * (0.25 + s.r * 0.3);
      ctx.fillStyle = s.warm ? "#C9A66B" : "#AEB8CB";
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
      if (s.r > 1.25 && tw > 0.85) { // a few stars flare into a cross
        ctx.globalAlpha = (tw - 0.85) * 2.2;
        ctx.fillRect(s.x - s.r * 4, s.y - 0.3, s.r * 8, 0.6);
        ctx.fillRect(s.x - 0.3, s.y - s.r * 4, 0.6, s.r * 8);
      }
    }
    // drifting champagne motes
    var visible = Math.round(motes.length * glow);
    for (var j = 0; j < visible; j++) {
      var m = motes[j];
      if (!reduced) {
        m.x += (m.vx + Math.sin(t * 0.0006 + m.p) * 8) * dt; m.y += m.vy * dt;
        if (m.y < -10 || m.x < -10 || m.x > W + 10) motes[j] = m = newMote(false);
      }
      ctx.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(t * 0.002 + m.p));
      var g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 4);
      g.addColorStop(0, "rgba(201,166,107,.9)"); g.addColorStop(0.35, "rgba(216,185,133,.45)"); g.addColorStop(1, "rgba(216,185,133,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 4, 0, 6.283); ctx.fill();
    }
    // golden shower
    for (var k = sparks.length - 1; k >= 0; k--) {
      var p = sparks[k];
      p.life -= dt; if (p.life <= 0) { sparks.splice(k, 1); continue; }
      p.vy += 38 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = Math.min(1, p.life / p.max * 1.6);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function loop(t) {
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
    last = t;
    glow += (glowTarget - glow) * Math.min(1, dt * 2);
    draw(t, dt);
    raf = requestAnimationFrame(loop);
  }

  function start() { if (!raf && !reduced) { last = 0; raf = requestAnimationFrame(loop); } }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
  var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(resize, 150); });
  resize(); start();

  window.Sky = {
    glow: function (v) { glowTarget = Math.max(0.1, Math.min(1, v)); },
    burst: function (fx, fy) {
      if (reduced) return;
      var x = W * (fx == null ? 0.5 : fx), y = H * (fy == null ? 0.4 : fy);
      var colors = ["#D8B985", "#B8914F", "#E9C9C7", "#C9A66B"];
      var n = lowPower ? 60 : 130;
      for (var i = 0; i < n; i++) {
        var a = Math.random() * 6.283, v = rand(40, 260);
        sparks.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90, r: rand(0.7, 2.1),
          c: colors[i % colors.length], life: rand(1.4, 3.2), max: 3.2 });
      }
    }
  };
})();
