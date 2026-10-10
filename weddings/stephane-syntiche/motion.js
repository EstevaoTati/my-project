/* STEPHANE & SYNTICHE — "Every scroll is a scene."
 *
 * GSAP + ScrollTrigger, self-hosted in assets/vendor (no CDN to fail).
 * Each chapter uses a different technique so no two scrolls feel alike:
 *   I    arch-framed photo that opens into a full-screen scene (pinned scrub)
 *   II   two halves of ONE photograph drift together and become whole
 *   III  five milestones: curtain, blur-to-focus, slide, iris, Ken Burns
 *   IV   inset photo expands while the words dissolve into light
 *   V    branches part, a crystal sphere clears, the date rises, gold falls
 *   …    countdown parallax, a program line that draws itself, an envelope
 *        that opens on arrival, a finale that darkens into stars.
 *
 * Rules (learned the hard way on the MWINDA site):
 *  - Initial states are set HERE, never in CSS. No GSAP → everything visible.
 *  - prefers-reduced-motion → none of this runs; the page is complete without it.
 *  - No scroll hijacking: scrub follows the user's own scroll, never drives it.
 */
(function () {
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var gsap = window.gsap, ST = window.ScrollTrigger;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var sky = function () { return window.Sky || { burst: function () {}, glow: function () {} }; };

  if (!gsap || !ST || reduced) {
    // Still celebrate a "yes", just without motion.
    return;
  }
  gsap.registerPlugin(ST);
  ST.config({ ignoreMobileResize: true });
  gsap.defaults({ ease: "power3.out", duration: 1.1 });
  document.documentElement.classList.add("has-motion");

  var built = false;

  // -------------------------------------------------------------- intro --
  function playIntro() {
    var intro = $("#intro");
    if (!intro || intro.hidden) return;
    var tl = gsap.timeline({ delay: 0.3 });
    gsap.set(".intro-photo", { opacity: 0, scale: 1.12, filter: "blur(16px)" });
    gsap.set("[data-intro]", { opacity: 0 });
    tl.fromTo("[data-intro='1']", { opacity: 0, y: 24, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.6 })
      .fromTo("[data-intro='2']", { opacity: 0, y: 24, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.6 }, "+=0.5")
      .to("[data-intro='1'], [data-intro='2']", { opacity: 0, y: -18, filter: "blur(6px)", duration: 1, stagger: 0.1 }, "+=1.1")
      .set("[data-intro='1'], [data-intro='2']", { display: "none" })
      .to(".intro-photo", { opacity: 0.42, scale: 1, filter: "blur(0px)", duration: 2.6, ease: "power2.inOut" }, "-=0.4")
      .set("[data-intro='3']", { opacity: 1 }, "<0.6")
      .from(".intro-title .names > *", { opacity: 0, y: 40, letterSpacing: "0.4em", duration: 1.6, stagger: 0.18 }, "<")
      .from(".intro-title > :not(.names)", { opacity: 0, y: 18, duration: 1, stagger: 0.14 }, "-=0.9")
      .call(function () { sky().glow(0.7); });
    document.addEventListener("ss:enter", function () { tl.progress(1).kill(); heroEntrance(); }, { once: true });
  }

  function heroEntrance() {
    gsap.from(".hero-copy > *", { opacity: 0, y: 30, duration: 1.3, stagger: 0.12, delay: 0.2 });
    // Ends exactly where the scroll scene starts (1.12), so the first scroll never jumps.
    gsap.fromTo(".hero-frame img", { scale: 1.3 }, { scale: 1.12, duration: 2.4, ease: "power2.out" });
  }

  // ----------------------------------------------------- I. the entrance --
  function heroScene() {
    // The frame's own box grows from the arch to the full screen, so the photo
    // is re-cropped as it opens: a portrait crop with both faces inside the
    // arch, a cinematic landscape crop at full size. Clip-path alone would
    // keep the landscape crop and lose one of them.
    var frame = $(".hero-frame"), arch = $(".hero-arch"), hero = $("#home");
    var geo;
    function measure() {
      frame.style.cssText = "";
      var f = frame.getBoundingClientRect(), hr = hero.getBoundingClientRect();
      geo = { t: f.top - hr.top, b: hr.bottom - f.bottom, s: f.left - hr.left, r: f.width / 2 };
    }
    function paint(p) {
      var k = 1 - p;
      frame.style.top = geo.t * k + "px"; frame.style.bottom = geo.b * k + "px";
      frame.style.left = frame.style.right = geo.s * k + "px";
      frame.style.borderRadius = geo.r * k + "px " + geo.r * k + "px " + 6 * k + "px " + 6 * k + "px";
    }
    measure();
    var prox = { p: 0 };
    var tl = gsap.timeline({
      scrollTrigger: { trigger: hero, start: "top top", end: "+=110%", scrub: 0.6, pin: true, anticipatePin: 1,
        onRefreshInit: function () { frame.style.cssText = ""; }, onRefresh: function () { measure(); paint(prox.p); } }
    });
    tl.to(prox, { p: 1, ease: "power1.inOut", duration: 1, onUpdate: function () { paint(prox.p); } }, 0)
      .fromTo(".hero-frame img", { scale: 1.12 }, { scale: 1, ease: "none", duration: 1, immediateRender: false }, 0)
      .to(arch, { opacity: 0, duration: 0.3, ease: "none" }, 0)
      .to(".hero-copy", { opacity: 0, y: -80, duration: 0.5, ease: "power1.in" }, 0.05)
      .to(".scroll-cue", { opacity: 0, duration: 0.15 }, 0);
  }

  // ------------------------------------------------ II. two souls, one --
  function soulsScene() {
    var gap = function () { return Math.min(innerWidth * 0.13, 170); };
    gsap.set(".souls-copy", { opacity: 0, y: 30 });
    var tl = gsap.timeline({ scrollTrigger: { trigger: "#couple", start: "top top", end: "+=120%", scrub: 0.8, pin: true, anticipatePin: 1, invalidateOnRefresh: true } });
    tl.fromTo(".soul--a", { x: function () { return -gap(); }, rotate: -4, y: 30 }, { x: 0, rotate: 0, y: 0, ease: "power2.inOut", duration: 1 }, 0)
      .fromTo(".soul--b", { x: function () { return gap(); }, rotate: 4, y: -30 }, { x: 0, rotate: 0, y: 0, ease: "power2.inOut", duration: 1 }, 0)
      .fromTo(".souls-line", { opacity: 0, scaleX: 1.6 }, { opacity: 1, scaleX: 1.2, duration: 0.35, ease: "none" }, 0)
      .to(".souls-line", { opacity: 0, scaleX: 0.02, duration: 0.45, ease: "power2.in" }, 0.55)
      .to(".soul figcaption", { opacity: 0, y: 10, duration: 0.25 }, 0.8)
      .fromTo(".souls-stage", { filter: "drop-shadow(0 0 0 rgba(216,185,133,0))" }, { filter: "drop-shadow(0 0 40px rgba(216,185,133,.45))", duration: 0.3 }, 0.9)
      .to(".souls-copy", { opacity: 1, y: 0, duration: 0.35 }, 0.95);
  }

  // ----------------------------------------------------- III. the story --
  var FX = {
    curtain: function (m) {
      return gsap.timeline().fromTo($(".ms-img", m), { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.6, ease: "power4.inOut" })
        .fromTo($(".ms-img img", m), { scale: 1.35 }, { scale: 1, duration: 2, ease: "power3.out" }, 0);
    },
    focus: function (m) {
      return gsap.timeline().fromTo($(".ms-img img", m), { filter: "blur(18px) saturate(0.4)", scale: 1.18, opacity: 0.2 }, { filter: "blur(0px) saturate(1)", scale: 1, opacity: 1, duration: 2.2, ease: "power2.out" });
    },
    slide: function (m, i) {
      var dir = i % 2 ? 1 : -1;
      return gsap.timeline().fromTo($(".ms-media", m), { x: dir * 140, opacity: 0 }, { x: 0, opacity: 1, duration: 1.6, ease: "expo.out" })
        .fromTo($(".ms-img img", m), { x: -dir * 60, scale: 1.15 }, { x: 0, scale: 1, duration: 2, ease: "expo.out" }, 0);
    },
    iris: function (m) {
      return gsap.timeline().fromTo($(".ms-img", m), { clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(75% at 50% 50%)", duration: 1.8, ease: "power3.inOut" })
        .fromTo($(".ms-img img", m), { rotate: 4, scale: 1.3 }, { rotate: 0, scale: 1, duration: 2.2 }, 0);
    },
    zoom: function (m) {
      return gsap.timeline().fromTo($(".ms-img img", m), { scale: 1.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 2.6, ease: "power2.out" });
    }
  };
  function storyScene() {
    $$(".milestone").forEach(function (m, i) {
      var fx = FX[m.getAttribute("data-fx")] || FX.curtain;
      var tl = gsap.timeline({ scrollTrigger: { trigger: m, start: "top 75%", once: true } });
      tl.add(fx(m, i), 0)
        .from($$(".ms-copy > *", m), { opacity: 0, y: 40, duration: 1.1, stagger: 0.12 }, 0.35);
      // A slow, scroll-linked drift inside every frame keeps the photos alive.
      gsap.fromTo($(".ms-img", m), { yPercent: 0, y: 30 }, { y: -30, ease: "none", scrollTrigger: { trigger: m, start: "top bottom", end: "bottom top", scrub: true } });
    });
  }

  // --------------------------------------------------- IV. the promise --
  function promiseScene() {
    var frame = $(".promise-frame");
    var ins = function () { return innerWidth <= 640 ? [10, 6] : [12, 18]; };
    var st = { p: 0 };
    function paint() { var k = 1 - st.p, v = ins(); frame.style.clipPath = "inset(" + v[0] * k + "% " + v[1] * k + "% " + v[0] * k + "% " + v[1] * k + "% round " + 4 * k + "px)"; }
    var tl = gsap.timeline({ scrollTrigger: { trigger: "#promise", start: "top top", end: "+=140%", scrub: 0.8, pin: true, anticipatePin: 1,
      onToggle: function (s) { sky().glow(s.isActive ? 0.9 : 0.4); } } });
    tl.to(st, { p: 1, ease: "power1.inOut", duration: 1, onUpdate: paint }, 0)
      .fromTo(".promise-frame img", { scale: 1.2 }, { scale: 1, ease: "none", duration: 1 }, 0)
      .fromTo(".promise-copy", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.2 }, 0)
      .to(".promise-copy", { opacity: 0, y: -50, filter: "blur(10px)", duration: 0.35, ease: "power1.in" }, 0.5)
      .to(".promise-light", { opacity: 0.9, duration: 0.3 }, 0.7);
  }

  // ---------------------------------------------------- V. the reveal ---
  function splitChars(el) {
    if (el.getAttribute("data-split") === el.textContent) return;
    var text = el.textContent;
    el.setAttribute("aria-label", text);
    el.textContent = "";
    text.split("").forEach(function (c) {
      var s = document.createElement("span");
      s.className = "ch"; s.setAttribute("aria-hidden", "true");
      s.textContent = c === " " ? " " : c;
      el.appendChild(s);
    });
    el.setAttribute("data-split", text);
  }
  function revealScene() {
    gsap.set(".branch--r", { scaleX: -1 });
    var scrub = gsap.timeline({ scrollTrigger: { trigger: "#reveal", start: "top bottom", end: "center center", scrub: 1 } });
    scrub.fromTo(".branch--l", { x: "18vw", rotate: 6 }, { x: 0, rotate: 0, ease: "none" }, 0)
      .fromTo(".branch--r", { x: "-18vw", rotate: -6 }, { x: 0, rotate: 0, ease: "none" }, 0)
      .fromTo(".crystal-img img", { scale: 1.5, filter: "blur(12px) grayscale(1)", rotate: -12 }, { scale: 1, filter: "blur(0px) grayscale(0)", rotate: 0, ease: "none" }, 0)
      .fromTo(".crystal", { rotateY: 50, opacity: 0.2 }, { rotateY: 0, opacity: 1, ease: "none" }, 0);

    var date = $(".reveal-date");
    splitChars(date);
    var tl = gsap.timeline({ scrollTrigger: { trigger: ".reveal-inner", start: "top 55%", once: true,
      onEnter: function () { sky().glow(1); } } });
    tl.from("#revealTitle", { opacity: 0, y: 50, letterSpacing: "0.12em", duration: 1.6 })
      .from(".reveal-date .ch", { opacity: 0, yPercent: 110, rotateX: -80, transformOrigin: "50% 100%", duration: 1, stagger: 0.045, ease: "back.out(1.6)" }, "-=0.8")
      .call(function () { var r = date.getBoundingClientRect(); sky().burst(0.5, (r.top + r.height / 2) / innerHeight); })
      .from(".reveal-place, .reveal-inner .lede", { opacity: 0, y: 20, duration: 1, stagger: 0.15 }, "-=0.4");
    ST.create({ trigger: "#reveal", start: "top center", end: "bottom center", onLeave: function () { sky().glow(0.45); }, onLeaveBack: function () { sky().glow(0.45); } });
  }

  // ---------------------------------------------------- the rest -------
  function heads() {
    $$(".section-head").forEach(function (h) {
      gsap.from(h.children, { opacity: 0, y: 34, duration: 1.2, stagger: 0.1, scrollTrigger: { trigger: h, start: "top 82%", once: true } });
    });
  }

  function countdownScene() {
    gsap.fromTo(".countdown-bg", { yPercent: -8 }, { yPercent: 8, ease: "none", scrollTrigger: { trigger: "#countdown", start: "top bottom", end: "bottom top", scrub: true } });
    gsap.from(".countdown-inner > *, .cd-unit", { opacity: 0, y: 40, duration: 1.1, stagger: 0.1, scrollTrigger: { trigger: "#countdown", start: "top 65%", once: true } });
  }

  function detailsScene() {
    gsap.from(".event-card", { opacity: 0, y: 70, rotateX: 8, transformPerspective: 900, duration: 1.4, stagger: 0.18, scrollTrigger: { trigger: "#eventGrid", start: "top 80%", once: true } });
    gsap.from(".fact", { opacity: 0, y: 24, duration: 1, stagger: 0.1, scrollTrigger: { trigger: "#facts", start: "top 88%", once: true } });
  }

  function programScene() {
    gsap.fromTo(".program-line", { scaleY: 0 }, { scaleY: 1, transformOrigin: "50% 0%", ease: "none", scrollTrigger: { trigger: ".program-wrap", start: "top 70%", end: "bottom 60%", scrub: true } });
    $$(".pg-item, .pg-empty").forEach(function (it, i) {
      gsap.from(it.children.length ? it.children : it, { opacity: 0, x: innerWidth > 640 ? (i % 2 ? -40 : 40) : 30, duration: 1.1, stagger: 0.08, scrollTrigger: { trigger: it, start: "top 82%", once: true } });
    });
  }

  function invitationScene() {
    gsap.from(".envelope", { opacity: 0, y: 90, rotate: -4, duration: 1.6, scrollTrigger: { trigger: "#invitation", start: "top 70%", once: true,
      onEnter: function () { setTimeout(function () { document.dispatchEvent(new Event("ss:envelope")); }, 1100); } } });
  }

  function giftsScene() {
    gsap.from(".gift-sphere", { y: -160, opacity: 0, duration: 2, ease: "elastic.out(1, 0.45)", scrollTrigger: { trigger: "#gifts", start: "top 70%", once: true } });
    gsap.from(".gift-string", { scaleY: 0, transformOrigin: "50% 0%", duration: 1.2, scrollTrigger: { trigger: "#gifts", start: "top 70%", once: true } });
    gsap.from(".gift-actions > *", { opacity: 0, y: 20, stagger: 0.1, scrollTrigger: { trigger: ".gift-actions", start: "top 90%", once: true } });
  }

  var batches = {};
  function batch(selector, key) {
    (batches[key] || []).forEach(function (t) { t.kill(); });
    var items = $$(selector);
    gsap.set(items, { opacity: 0, y: 60 });
    batches[key] = ST.batch(items, {
      start: "top 92%", once: true,
      onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, duration: 1.2, stagger: 0.1, overwrite: true }); }
    });
  }

  function rsvpScene() {
    gsap.from(".rsvp-card", { opacity: 0, y: 50, duration: 1.3, scrollTrigger: { trigger: "#rsvp", start: "top 70%", once: true } });
    document.addEventListener("ss:rsvp", function (e) { if (e.detail.attending) sky().burst(0.5, 0.45); });
  }

  function finaleScene() {
    var tl = gsap.timeline({ scrollTrigger: { trigger: "#finale", start: "top bottom", end: "bottom bottom", scrub: 1 } });
    tl.fromTo(".finale-bg img", { scale: 1.25 }, { scale: 1, ease: "none" }, 0)
      .fromTo(".finale-shade", { opacity: 0.55 }, { opacity: 1, ease: "none" }, 0);
    gsap.from(".finale-inner > *", { opacity: 0, y: 40, duration: 1.6, stagger: 0.22, scrollTrigger: { trigger: ".finale-inner", start: "top 75%", once: true,
      onEnter: function () { sky().glow(1); setTimeout(function () { sky().burst(0.5, 0.25); }, 1800); } } });
  }

  // ------------------------------------------- desktop-only refinements --
  function pointerFx() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    var c = document.createElement("div"); c.className = "cursor"; c.setAttribute("aria-hidden", "true");
    document.body.appendChild(c);
    var x = gsap.quickTo(c, "x", { duration: 0.35, ease: "power3" }), y = gsap.quickTo(c, "y", { duration: 0.35, ease: "power3" });
    addEventListener("pointermove", function (e) { c.classList.add("is-on"); x(e.clientX); y(e.clientY); }, { passive: true });
    document.addEventListener("pointerleave", function () { c.classList.remove("is-on"); });
    document.addEventListener("pointerover", function (e) { c.classList.toggle("is-link", Boolean(e.target.closest("a, button, summary, label, input, textarea, select"))); });

    $$(".btn--gold, .env-seal").forEach(function (b) {
      var bx = gsap.quickTo(b, "x", { duration: 0.5, ease: "elastic.out(1, .4)" }), by = gsap.quickTo(b, "y", { duration: 0.5, ease: "elastic.out(1, .4)" });
      b.addEventListener("pointermove", function (e) { var r = b.getBoundingClientRect(); bx((e.clientX - r.left - r.width / 2) * 0.18); by((e.clientY - r.top - r.height / 2) * 0.25); });
      b.addEventListener("pointerleave", function () { bx(0); by(0); });
    });
  }

  // -------------------------------------------------------------- build --
  function build(detail) {
    if (built) return; built = true;
    if (detail && detail.intro) playIntro(); else heroEntrance();
    heroScene(); soulsScene(); storyScene(); promiseScene(); revealScene();
    heads(); countdownScene(); detailsScene(); programScene(); invitationScene(); rsvpScene(); giftsScene(); finaleScene();
    batch(".gal-item", "gal"); batch(".gb-card", "gb"); batch(".faq-item", "faq");
    pointerFx();
    document.addEventListener("ss:gallery", function () { batch(".gal-item", "gal"); ST.refresh(); });
    document.addEventListener("ss:guestbook", function () { batch(".gb-card", "gb"); ST.refresh(); });
    document.addEventListener("ss:relayout", function () {
      // Language switch re-renders the story/program/faq: rebind their scenes.
      ST.getAll().forEach(function (t) { var tr = t.trigger; if (tr && tr.closest && tr.closest("#story, #program")) t.kill(); });
      storyScene(); programScene(); batch(".faq-item", "faq"); ST.refresh();
    });
    addEventListener("load", function () { ST.refresh(); });
    // Pins add height above deep-linked sections: land where the link meant.
    if (location.hash.length > 1) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) requestAnimationFrame(function () { ST.refresh(); target.scrollIntoView(); });
    }
  }

  document.addEventListener("ss:ready", function (e) { build(e.detail); });
  if (document.documentElement.classList.contains("is-ready")) build({});
})();
