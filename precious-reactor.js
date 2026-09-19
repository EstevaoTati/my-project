/* =====================================================================
   PRECIOUS — reactor renderer.
   Two canvases, one animation loop: a slow star/radar field behind the
   whole page, and the core the operator talks to.

   The core is driven by real numbers, never decoration for its own sake:
   while listening it is the live microphone spectrum, while speaking it is
   the synthesiser's cadence, while thinking it is a scan. If the machine
   is not hearing anything, the operator can see that immediately.

   No external library: the content security policy allows scripts from
   this origin and jsDelivr only, and a 3D engine was deliberately removed
   from this site. Everything here is canvas 2D.
   ===================================================================== */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var PALETTE = {
    idle:      { core: [255, 215, 0],  halo: [212, 175, 55] },
    listening: { core: [89, 225, 255], halo: [89, 225, 255] },
    thinking:  { core: [224, 179, 76], halo: [224, 179, 76] },
    speaking:  { core: [255, 230, 128], halo: [255, 215, 0] },
    error:     { core: [255, 107, 90], halo: [255, 107, 90] }
  };

  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function fit(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return dpr;
  }

  var Reactor = {
    state: 'idle',
    level: 0,          // smoothed 0..1 loudness
    spectrum: null,    // Uint8Array from the analyser, when listening
    _raf: 0,
    _t: 0,
    _shownLevel: 0,
    _bars: new Array(72).fill(0),
    _dust: [],

    mount: function (orbCanvas, fieldCanvas) {
      this.orb = orbCanvas;
      this.field = fieldCanvas;
      this.octx = orbCanvas.getContext('2d');
      this.fctx = fieldCanvas.getContext('2d');
      this._seedDust();
      var self = this;
      window.addEventListener('resize', function () { self._seedDust(); self._draw(); }, { passive: true });
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) self.stop(); else self.start();
      });
      this.start();
    },

    setState: function (state) { this.state = state; },
    setLevel: function (v) { this.level = Math.max(0, Math.min(1, v || 0)); },
    setSpectrum: function (bins) { this.spectrum = bins; },

    start: function () {
      if (this._raf) return;
      var self = this;
      var loop = function () { self._t += 1; self._draw(); self._raf = window.requestAnimationFrame(loop); };
      this._raf = window.requestAnimationFrame(loop);
    },

    stop: function () {
      if (this._raf) window.cancelAnimationFrame(this._raf);
      this._raf = 0;
    },

    _seedDust: function () {
      var n = window.innerWidth < 700 ? 34 : 70;
      this._dust = [];
      for (var i = 0; i < n; i++) {
        this._dust.push({
          x: Math.random(), y: Math.random(),
          r: Math.random() * 1.3 + 0.3,
          s: Math.random() * 0.00016 + 0.00004,
          a: Math.random() * 0.4 + 0.08
        });
      }
    },

    /* Energy the core should show. Listening uses the microphone; the other
       states have no live signal, so they get an honest synthetic cadence
       that reads as "working" rather than as "hearing you". */
    _energy: function () {
      var t = this._t;
      if (this.state === 'listening') return this.level;
      if (this.state === 'speaking') return 0.34 + 0.3 * Math.abs(Math.sin(t / 7)) + 0.16 * Math.sin(t / 3.1);
      if (this.state === 'thinking') return 0.18 + 0.12 * Math.sin(t / 11);
      if (this.state === 'error') return 0.5 + 0.5 * Math.sin(t / 4);
      return 0.06 + 0.04 * Math.sin(t / 34);
    },

    _draw: function () {
      var palette = PALETTE[this.state] || PALETTE.idle;
      var target = this._energy();
      this._shownLevel += (target - this._shownLevel) * (reduced ? 1 : 0.16);
      this._drawField(palette);
      this._drawCore(palette, this._shownLevel);
    },

    /* ---------------- background: dust + radar sweep ---------------- */
    _drawField: function (palette) {
      var c = this.field, ctx = this.fctx;
      if (!c || !ctx) return;
      var dpr = fit(c);
      var w = c.width, h = c.height;
      ctx.clearRect(0, 0, w, h);

      var cx = w / 2, cy = h / 2;
      var i, d;
      for (i = 0; i < this._dust.length; i++) {
        d = this._dust[i];
        if (!reduced) { d.y -= d.s; if (d.y < -0.02) { d.y = 1.02; d.x = Math.random(); } }
        ctx.beginPath();
        ctx.arc(d.x * w, d.y * h, d.r * dpr, 0, TAU);
        ctx.fillStyle = rgba(palette.halo, d.a * 0.5);
        ctx.fill();
      }

      if (reduced) return;
      // Radar sweep, drawn as a decaying trail rather than one wedge: a
      // single wedge has a hard trailing edge that reads as a rendering
      // artefact instead of a sweep.
      var ang = (this._t / 420) % TAU;
      var reach = Math.max(w, h) * 0.78;
      var steps = 26, span = 0.30;
      for (i = 0; i < steps; i++) {
        var a0 = ang - (span * (i + 1)) / steps;
        var a1 = ang - (span * i) / steps;
        var fade = Math.pow(1 - i / steps, 2.2) * 0.055;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, reach, a0, a1);
        ctx.closePath();
        ctx.fillStyle = rgba(palette.halo, fade);
        ctx.fill();
      }
    },

    /* ---------------- core: spectrum crown + pulsing heart ---------------- */
    _drawCore: function (palette, energy) {
      var c = this.orb, ctx = this.octx;
      if (!c || !ctx) return;
      var dpr = fit(c);
      var w = c.width, h = c.height;
      var cx = w / 2, cy = h / 2;
      var R = Math.min(w, h) / 2;
      ctx.clearRect(0, 0, w, h);

      var t = this._t;
      var i, ang, v;

      // Outer tick ring — a machined bezel that turns slowly.
      ctx.save();
      ctx.translate(cx, cy);
      if (!reduced) ctx.rotate((t / 900) % TAU);
      for (i = 0; i < 120; i++) {
        ang = (i / 120) * TAU;
        var long = i % 10 === 0;
        var r1 = R * 0.965, r2 = R * (long ? 0.915 : 0.94);
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
        ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
        ctx.strokeStyle = rgba(palette.halo, long ? 0.4 : 0.16);
        ctx.lineWidth = (long ? 1.4 : 0.8) * dpr;
        ctx.stroke();
      }
      ctx.restore();

      // Spectrum crown. Real bins while listening; a travelling wave
      // otherwise, so the ring never pretends to hear silence.
      var bars = this._bars.length;
      var bins = this.state === 'listening' ? this.spectrum : null;
      for (i = 0; i < bars; i++) {
        var raw;
        if (bins && bins.length) {
          // Low bins carry the voice; sample the useful half of the range.
          var idx = Math.floor((i / bars) * (bins.length * 0.55));
          raw = (bins[idx] || 0) / 255;
        } else {
          raw = energy * (0.45 + 0.55 * Math.abs(Math.sin(i * 0.38 + t / 9)));
        }
        this._bars[i] += (raw - this._bars[i]) * (reduced ? 1 : 0.28);
        v = this._bars[i];
        ang = (i / bars) * TAU - Math.PI / 2;
        var inner = R * 0.70;
        var outer = inner + R * 0.20 * Math.max(0.06, v);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
        ctx.lineTo(cx + Math.cos(ang) * outer, cy + Math.sin(ang) * outer);
        ctx.strokeStyle = rgba(palette.core, 0.28 + v * 0.66);
        ctx.lineWidth = 2.1 * dpr;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Two counter-rotating arc segments: the "it is alive" signature.
      var arcs = [
        { r: 0.635, from: 0.15, len: 1.5, speed: 1 / 420, width: 1.4, alpha: 0.5 },
        { r: 0.585, from: 2.4, len: 2.1, speed: -1 / 260, width: 1.0, alpha: 0.32 }
      ];
      for (i = 0; i < arcs.length; i++) {
        var a = arcs[i];
        var off = reduced ? 0 : t * a.speed;
        ctx.beginPath();
        ctx.arc(cx, cy, R * a.r, a.from + off, a.from + a.len + off);
        ctx.strokeStyle = rgba(palette.halo, a.alpha);
        ctx.lineWidth = a.width * dpr;
        ctx.stroke();
      }

      // Heart: a filled disc whose radius follows the energy, plus a halo.
      var pulse = R * (0.30 + energy * 0.17);
      var halo = ctx.createRadialGradient(cx, cy, pulse * 0.2, cx, cy, pulse * 2.5);
      halo.addColorStop(0, rgba(palette.core, 0.34 + energy * 0.3));
      halo.addColorStop(0.45, rgba(palette.core, 0.10));
      halo.addColorStop(1, rgba(palette.core, 0));
      ctx.beginPath();
      ctx.arc(cx, cy, pulse * 2.5, 0, TAU);
      ctx.fillStyle = halo;
      ctx.fill();

      var heart = ctx.createRadialGradient(cx - pulse * 0.3, cy - pulse * 0.35, pulse * 0.1, cx, cy, pulse);
      heart.addColorStop(0, rgba([255, 255, 255], 0.85));
      heart.addColorStop(0.35, rgba(palette.core, 0.85));
      heart.addColorStop(1, rgba(palette.core, 0.12));
      ctx.beginPath();
      ctx.arc(cx, cy, pulse, 0, TAU);
      ctx.fillStyle = heart;
      ctx.fill();

      // Iris ring around the heart.
      ctx.beginPath();
      ctx.arc(cx, cy, pulse * 1.22, 0, TAU);
      ctx.strokeStyle = rgba(palette.core, 0.42);
      ctx.lineWidth = 1.1 * dpr;
      ctx.stroke();

      // Thinking scan line: a horizontal sweep across the iris.
      if (this.state === 'thinking' && !reduced) {
        var y = cy + Math.sin(t / 26) * R * 0.42;
        var scan = ctx.createLinearGradient(cx - R, y, cx + R, y);
        scan.addColorStop(0, rgba(palette.core, 0));
        scan.addColorStop(0.5, rgba(palette.core, 0.5));
        scan.addColorStop(1, rgba(palette.core, 0));
        ctx.beginPath();
        ctx.moveTo(cx - R * 0.8, y);
        ctx.lineTo(cx + R * 0.8, y);
        ctx.strokeStyle = scan;
        ctx.lineWidth = 1.3 * dpr;
        ctx.stroke();
      }
    }
  };

  window.PreciousReactor = Reactor;
})();
