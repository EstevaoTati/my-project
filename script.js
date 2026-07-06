/* ============================================================
   HOLY GHOST IMPACT MINISTRIES — Motion & Interaction Engine
   Vanilla JS · zero dependencies · 60fps budget
   ============================================================ */
(() => {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Loader ---------- */
  const loader = document.getElementById("loader");
  window.addEventListener("load", () => {
    setTimeout(() => loader.classList.add("is-done"), prefersReduced ? 0 : 900);
  });
  // Safety: never trap the user behind the loader
  setTimeout(() => loader.classList.add("is-done"), 4000);

  /* ---------- Custom cursor (spring follow) ---------- */
  const dot = document.getElementById("cursorDot");
  const ring = document.getElementById("cursorRing");
  if (!isTouch && !prefersReduced) {
    let mx = innerWidth / 2, my = innerHeight / 2;
    let rx = mx, ry = my;
    addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; });
    (function cursorLoop() {
      rx = lerp(rx, mx, 0.18);
      ry = lerp(ry, my, 0.18);
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(cursorLoop);
    })();
    document.querySelectorAll("a, button, .tilt, .moment").forEach((el) => {
      el.addEventListener("mouseenter", () => ring.classList.add("is-hover"));
      el.addEventListener("mouseleave", () => ring.classList.remove("is-hover"));
    });
  }

  /* ---------- Ambient particle field (gold embers) ---------- */
  const canvas = document.getElementById("bgCanvas");
  const ctx = canvas.getContext("2d");
  let W, H, particles = [];
  const P_COUNT = isTouch ? 36 : 70;

  function resize() {
    W = canvas.width = innerWidth * devicePixelRatio;
    H = canvas.height = innerHeight * devicePixelRatio;
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
  }
  resize();
  addEventListener("resize", resize);

  function spawn() {
    const r = (0.6 + Math.random() * 1.8) * devicePixelRatio;
    return {
      x: Math.random() * W,
      y: H + r + Math.random() * H * 0.3,
      r,
      vy: (0.12 + Math.random() * 0.4) * devicePixelRatio,
      vx: (Math.random() - 0.5) * 0.18 * devicePixelRatio,
      a: 0.05 + Math.random() * 0.4,
      tw: Math.random() * Math.PI * 2,
      tws: 0.004 + Math.random() * 0.012,
    };
  }
  for (let i = 0; i < P_COUNT; i++) {
    const p = spawn();
    p.y = Math.random() * H; // initial scatter
    particles.push(p);
  }

  let pointerX = 0.5;
  addEventListener("mousemove", (e) => { pointerX = e.clientX / innerWidth; });

  if (!prefersReduced) {
    (function particleLoop() {
      ctx.clearRect(0, 0, W, H);
      const drift = (pointerX - 0.5) * 0.3 * devicePixelRatio;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y -= p.vy;
        p.x += p.vx + drift;
        p.tw += p.tws;
        if (p.y < -10) particles[i] = spawn();
        const alpha = p.a * (0.55 + 0.45 * Math.sin(p.tw));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(232, 185, 65, ${alpha})`;
        ctx.shadowColor = "rgba(232,185,65,.8)";
        ctx.shadowBlur = 6 * devicePixelRatio;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      requestAnimationFrame(particleLoop);
    })();
  }

  /* ---------- Nav state + scroll progress ---------- */
  const nav = document.getElementById("nav");
  const progress = document.getElementById("scrollProgress");
  let ticking = false;
  function onScroll() {
    nav.classList.toggle("is-scrolled", scrollY > 40);
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + "%";
    ticking = false;
  }
  addEventListener("scroll", () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const burger = document.getElementById("navBurger");
  const links = document.getElementById("navLinks");
  burger.addEventListener("click", () => {
    burger.classList.toggle("is-open");
    links.classList.toggle("is-open");
  });
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      burger.classList.remove("is-open");
      links.classList.remove("is-open");
    })
  );

  /* ---------- Scroll reveal ---------- */
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }),
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 0.08}s`;
    io.observe(el);
  });

  /* ---------- Animated counters ---------- */
  const counterIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      counterIO.unobserve(el);
      const target = +el.dataset.count;
      const suffix = el.dataset.suffix || "";
      const dur = 1800;
      const t0 = performance.now();
      (function tick(t) {
        const k = Math.min((t - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - k, 4);
        el.textContent = Math.round(target * eased).toLocaleString("en-US") + suffix;
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll("[data-count]").forEach((el) => counterIO.observe(el));

  /* ---------- Cinematic hero: scroll-scrubbed 3D orbit + letter tracking ----------
     The hero section is a 320vh runway; .hero-pin stays stuck while scroll
     progress (0..1) drives the whole scene — Lando-Norris-helmet style. */
  const hero = document.querySelector(".hero");
  const orbitRing = document.getElementById("orbitRing");
  const emblem = document.querySelector(".orbit-emblem");
  const kicker = document.getElementById("heroKicker");
  const display = document.getElementById("heroDisplay");
  let chars = [];

  // Split display lines into per-letter spans
  if (display) {
    display.querySelectorAll(".display-line").forEach((line) => {
      const text = line.dataset.text || "";
      line.textContent = "";
      [...text].forEach((c) => {
        const s = document.createElement("span");
        s.className = "ch" + (c === " " ? " sp" : "");
        s.textContent = c === " " ? " " : c;
        line.appendChild(s);
        chars.push(s);
      });
    });
  }

  // Position orbit cards around the ring — responsive to viewport and
  // to cards hidden by CSS (mobile shows fewer to avoid overlap)
  const orbitCards = orbitRing ? [...orbitRing.querySelectorAll(".orbit-card")] : [];
  let RADIUS = 0, visibleCards = [];
  function layoutOrbit() {
    RADIUS = Math.min(innerWidth * 0.36, 620);
    visibleCards = orbitCards.filter((c) => getComputedStyle(c).display !== "none");
    visibleCards.forEach((card, i) => {
      card.dataset.angle = (360 / visibleCards.length) * i;
    });
  }
  layoutOrbit();
  addEventListener("resize", layoutOrbit);

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  // Smooth eased progress so the scrub feels weighted, not linear
  let heroP = 0, heroPT = 0;

  function heroScrub() {
    if (!hero) return;
    const rect = hero.getBoundingClientRect();
    const runway = rect.height - innerHeight;
    heroPT = runway > 0 ? clamp01(-rect.top / runway) : 0;
    heroP = prefersReduced ? heroPT : lerp(heroP, heroPT, 0.09);
    const p = heroP;

    // 1) Letters track in one-by-one across the first 45% of the runway
    const n = chars.length;
    chars.forEach((ch, i) => {
      const start = (i / n) * 0.3;             // stagger window
      const k = clamp01((p - start) / 0.16);   // per-letter ease window
      const e = 1 - Math.pow(1 - k, 3);
      ch.style.opacity = e;
      ch.style.transform =
        `translateY(${(1 - e) * 0.55}em) rotateX(${(1 - e) * 60}deg) scale(${0.9 + e * 0.1})`;
      ch.style.filter = `blur(${(1 - e) * 8}px)`;
    });

    // 2) Kicker fades in after the title lands
    if (kicker) kicker.classList.toggle("is-in", p > 0.42);

    // 3) Orbit ring: one full revolution across the runway
    if (orbitRing) {
      const rot = p * 360;
      orbitRing.style.transform = `rotateX(6deg) rotateY(${rot}deg)`;
      visibleCards.forEach((card) => {
        const a = +card.dataset.angle;
        card.style.transform =
          `rotateY(${a}deg) translateZ(${RADIUS}px) rotateY(${-(a + rot)}deg)`;
        // Cards fade as they pass behind the emblem
        const rel = (((a + rot) % 360) + 360) % 360;
        const depth = Math.cos((rel * Math.PI) / 180); // 1 front, -1 back
        card.style.opacity = 0.25 + 0.75 * (depth * 0.5 + 0.5);
      });
    }

    // 4) Emblem: breathes up then recedes as the story takes over
    if (emblem) {
      const grow = 0.72 + 0.28 * Math.sin(Math.min(p, 0.9) * Math.PI);
      emblem.style.transform = `scale(${grow}) translateY(${p * -4}vh)`;
      emblem.style.opacity = p > 0.94 ? String(1 - (p - 0.94) / 0.06) : "1";
    }

    requestAnimationFrame(heroScrub);
  }
  if (hero) requestAnimationFrame(heroScrub);

  /* ---------- 3D tilt cards + spotlight tracking ---------- */
  if (!isTouch && !prefersReduced) {
    document.querySelectorAll(".tilt").forEach((card) => {
      const inner = card.querySelector(".min-card-inner") || card;
      card.addEventListener("mousemove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        inner.style.transform =
          `rotateY(${(px - 0.5) * 10}deg) rotateX(${(0.5 - py) * 10}deg) translateZ(6px)`;
        inner.style.setProperty("--mx", `${px * 100}%`);
        inner.style.setProperty("--my", `${py * 100}%`);
      });
      card.addEventListener("mouseleave", () => { inner.style.transform = ""; });
    });

    document.querySelectorAll(".photo-frame").forEach((frame) => {
      frame.addEventListener("mousemove", (e) => {
        const r = frame.getBoundingClientRect();
        frame.style.setProperty("--gx", `${((e.clientX - r.left) / r.width) * 100}%`);
        frame.style.setProperty("--gy", `${((e.clientY - r.top) / r.height) * 100}%`);
      });
    });
  }

  /* ---------- Magnetic buttons ---------- */
  if (!isTouch && !prefersReduced) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      const strength = 0.28;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transition = "transform .6s cubic-bezier(0.22, 1.6, 0.36, 1)";
        el.style.transform = "";
        setTimeout(() => (el.style.transition = ""), 600);
      });
    });
  }

  /* ---------- Moments: drag-to-scroll (mouse only — touch scrolls natively) ---------- */
  const track = document.getElementById("momentsTrack");
  if (track) {
    let down = false, startX = 0, startScroll = 0;
    track.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") return;
      down = true; startX = e.clientX; startScroll = track.scrollLeft;
      track.style.scrollSnapType = "none";
    });
    addEventListener("pointermove", (e) => {
      if (down) track.scrollLeft = startScroll - (e.clientX - startX) * 1.4;
    });
    addEventListener("pointerup", () => {
      down = false; track.style.scrollSnapType = "";
    });
  }

  /* ---------- Contact form ---------- */
  const form = document.getElementById("contactForm");
  const note = document.getElementById("formNote");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = form.querySelector("#name").value.trim();
    const email = form.querySelector("#email").value.trim();
    const msg = form.querySelector("#message").value.trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !msg) {
      note.textContent = "Please fill in your name, a valid email and a message.";
      return;
    }
    note.textContent = `Thank you, ${name.split(" ")[0]} — we received your message and will be in touch soon. 🙏`;
    form.reset();
  });

  /* ---------- Footer year ---------- */
  document.getElementById("year").textContent = new Date().getFullYear();
})();
