/* ============================================================
   MWINDA GROUP LLC — Animations & Interactions
   ============================================================ */
(() => {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 900px)').matches;

  /* ---------- Loader ---------- */
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
  window.addEventListener('load', () => setTimeout(boot, 500));
  // Safety net: never let the loader stick around if 'load' is delayed by a CDN
  setTimeout(boot, 2500);

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
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 60;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  /* ---------- Contact form ---------- */
  const form = document.getElementById('contactForm');
  const formNote = document.getElementById('formNote');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.querySelector('#name').value.trim();
      const email = form.querySelector('#email').value.trim();
      const topic = form.querySelector('#topic').value;
      const message = form.querySelector('#message').value.trim();
      if (!name || !email || !topic || !message) {
        formNote.textContent = 'Merci de remplir tous les champs.';
        formNote.style.color = '#ff8a8a';
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        formNote.textContent = 'Adresse email invalide.';
        formNote.style.color = '#ff8a8a';
        return;
      }
      formNote.style.color = '';
      formNote.textContent = `Merci ${name.split(' ')[0]}, votre message a bien été envoyé. Nous reviendrons vers vous très vite.`;
      form.reset();
    });

    // Force "valid" floating label state after value change for select
    const sel = form.querySelector('#topic');
    if (sel) sel.addEventListener('change', () => sel.setAttribute('data-filled', sel.value ? 'true' : ''));
  }

  /* ============================================================
     Three.js — Premium animated background
     Hexagon particles + glowing core
     ============================================================ */
  if (window.THREE && !prefersReduced) {
    initBgScene();
    initHero3D();
  }

  function initBgScene() {
    const canvas = document.getElementById('bgCanvas');
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
    camera.position.z = 60;

    // Particle field — gold dust
    const count = isMobile ? 600 : 1400;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
      sizes[i] = Math.random() * 1.4 + 0.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      color: 0xFFD700,
      size: 0.55,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // Subtle larger sparse particles
    const count2 = isMobile ? 60 : 120;
    const pos2 = new Float32Array(count2 * 3);
    for (let i = 0; i < count2; i++) {
      pos2[i * 3] = (Math.random() - 0.5) * 220;
      pos2[i * 3 + 1] = (Math.random() - 0.5) * 130;
      pos2[i * 3 + 2] = (Math.random() - 0.5) * 130;
    }
    const geo2 = new THREE.BufferGeometry();
    geo2.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
    const mat2 = new THREE.PointsMaterial({
      color: 0xFFE680,
      size: 1.4,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sparkles = new THREE.Points(geo2, mat2);
    scene.add(sparkles);

    let mouseX = 0, mouseY = 0;
    window.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX / window.innerWidth) - 0.5;
      mouseY = (e.clientY / window.innerHeight) - 0.5;
    });

    let scrollY = 0;
    window.addEventListener('scroll', () => { scrollY = window.scrollY; });

    const clock = new THREE.Clock();
    function tick() {
      const t = clock.getElapsedTime();
      points.rotation.y = t * 0.04 + mouseX * 0.3;
      points.rotation.x = mouseY * 0.2 + scrollY * 0.0008;
      sparkles.rotation.y = -t * 0.02 + mouseX * 0.2;
      sparkles.rotation.x = -mouseY * 0.1;
      camera.position.z = 60 + Math.sin(t * 0.3) * 1.2;
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }
    tick();

    window.addEventListener('resize', () => {
      const W = window.innerWidth, H = window.innerHeight;
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    });
  }

  /* ---------- Hero 3D bulb (Three.js) ---------- */
  function initHero3D() {
    const mount = document.getElementById('hero3d');
    if (!mount) return;

    const w = mount.clientWidth || 600;
    const h = mount.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0, 8);

    // Light bulb made of icosahedron with wireframe + glow
    const group = new THREE.Group();
    scene.add(group);

    const bulbGeo = new THREE.IcosahedronGeometry(2, 1);
    const bulbMat = new THREE.MeshBasicMaterial({
      color: 0xFFD700, wireframe: true, transparent: true, opacity: 0.5,
    });
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    group.add(bulb);

    // Inner glowing sphere
    const coreGeo = new THREE.SphereGeometry(0.9, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xFFE680, transparent: true, opacity: 0.85,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Outer glow shell
    const glowGeo = new THREE.SphereGeometry(2.6, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xD4AF37, transparent: true, opacity: 0.08, side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    group.add(glow);

    // Orbital ring
    const ringGeo = new THREE.TorusGeometry(3.2, 0.015, 16, 200);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xFFD700, transparent: true, opacity: 0.55,
    });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 2.4;
    group.add(ring1);

    const ring2 = new THREE.Mesh(ringGeo, ringMat.clone());
    ring2.rotation.x = Math.PI / 1.6;
    ring2.rotation.y = Math.PI / 4;
    ring2.material.opacity = 0.35;
    group.add(ring2);

    // Orbit particles around bulb
    const orbitCount = 80;
    const orbitPos = new Float32Array(orbitCount * 3);
    const orbitData = [];
    for (let i = 0; i < orbitCount; i++) {
      const r = 3 + Math.random() * 1.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      orbitData.push({ r, theta, phi, speed: 0.2 + Math.random() * 0.6 });
      orbitPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
      orbitPos[i*3+1] = r * Math.cos(phi);
      orbitPos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const orbitGeo = new THREE.BufferGeometry();
    orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPos, 3));
    const orbitMat = new THREE.PointsMaterial({
      color: 0xFFE680, size: 0.06, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const orbit = new THREE.Points(orbitGeo, orbitMat);
    group.add(orbit);

    let targetRX = 0, targetRY = 0;
    window.addEventListener('mousemove', (e) => {
      targetRY = ((e.clientX / window.innerWidth) - 0.5) * 0.6;
      targetRX = ((e.clientY / window.innerHeight) - 0.5) * 0.4;
    });

    const clock = new THREE.Clock();
    function tick() {
      const t = clock.getElapsedTime();
      group.rotation.y += (targetRY - group.rotation.y) * 0.05 + 0.003;
      group.rotation.x += (targetRX - group.rotation.x) * 0.05;
      ring1.rotation.z = t * 0.4;
      ring2.rotation.z = -t * 0.3;
      core.scale.setScalar(1 + Math.sin(t * 2) * 0.05);
      glow.scale.setScalar(1 + Math.sin(t * 1.5) * 0.04);

      const arr = orbitGeo.attributes.position.array;
      for (let i = 0; i < orbitCount; i++) {
        const d = orbitData[i];
        d.theta += 0.005 * d.speed;
        arr[i*3] = d.r * Math.sin(d.phi) * Math.cos(d.theta);
        arr[i*3+1] = d.r * Math.cos(d.phi);
        arr[i*3+2] = d.r * Math.sin(d.phi) * Math.sin(d.theta);
      }
      orbitGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }
    tick();

    function onResize() {
      const W = mount.clientWidth, H = mount.clientHeight;
      if (W && H) {
        renderer.setSize(W, H);
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
      }
    }
    window.addEventListener('resize', onResize);
  }

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
