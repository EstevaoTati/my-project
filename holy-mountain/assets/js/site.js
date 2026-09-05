/* =============================================================================
   Holy Mountain Washington Church — site behaviour
   Vanilla JS, no dependencies, no build step.

   ▼▼ EDIT THIS BLOCK ▼▼  Everything the church needs to keep current lives in
   SITE below. Replace every value marked TODO, then set draft:false to hide
   the amber banner at the top of the page.
   ========================================================================== */
const SITE = {
  // Amber "draft preview" banner. Set to false once the values below are real.
  draft: true,

  // Service time. Shown on the visit card and in the contact panel.
  // Add another entry here (and a card in index.html) only for a gathering
  // that actually runs — nothing on this page invents a schedule.
  times: {
    sunday: { en: 'Sunday · 10:00 AM', fr: 'Dimanche · 10h00' }   // TODO confirm
  },

  // Meeting place.
  address: { en: 'Address to confirm — Washington, D.C. area', fr: 'Adresse à confirmer — région de Washington' }, // TODO
  mapsUrl: 'https://www.google.com/maps',          // TODO: link to the exact venue

  // Giving.
  giving: { mobile: { en: 'Details on request', fr: 'Coordonnées sur demande' } }, // TODO: Zelle / CashApp handle

  // Social profiles. TODO: replace each one with the church's own page URL.
  social: {
    instagram: 'https://www.instagram.com/',
    facebook:  'https://www.facebook.com/',
    youtube:   'https://www.youtube.com/',
    tiktok:    'https://www.tiktok.com/'
  }
};
/* ▲▲ END EDIT BLOCK ▲▲ */

/* ---------------------------------------------------------------------------
   French translations. English lives in index.html and is restored from the
   DOM, so it is never duplicated here.
   ------------------------------------------------------------------------ */
const FR = {
  'a11y.skip': 'Aller au contenu',
  'draft.tag': 'Aperçu provisoire.',
  'draft.body': 'Les horaires, l’adresse et les liens sociaux sont des exemples — à confirmer avant publication.',

  'nav.visit': 'Visite', 'nav.about': 'À propos', 'nav.vision': 'Vision',
  'nav.leadership': 'Direction',
  'nav.ministries': 'Ministères', 'nav.life': 'Vie d’église', 'nav.give': 'Donner',
  'nav.plan': 'Planifier une visite',

  'hero.eyebrow': 'Washington, D.C. · Tous sont les bienvenus',
  'hero.l1': 'La Montagne', 'hero.l2': 'Sainte Washington',
  'hero.verse': 'Communauté Évangélique Missionnaire La Montagne Sainte. Une famille missionnaire envoyée dans le monde pour faire des disciples de Jésus.',
  'hero.cta1': 'Planifier votre visite', 'hero.cta2': 'Voir la vie d’église', 'hero.scroll': 'Défiler',

  'visit.eyebrow': 'Rassemblons-nous',
  'visit.title': 'Venez comme vous êtes.<br>Vous serez reçus comme la famille.',
  'visit.lede': 'Le dimanche est le rassemblement autour duquel nous vous invitons à vous organiser. Ce qu’il faut savoir avant une première visite est ci-dessous ; s’il manque quelque chose, écrivez-nous et nous répondrons.',
  'visit.c1k': 'Culte du dimanche',
  'visit.c1m': 'Louange, Parole et prière, avec un accueil des nouveaux à la fin du culte.',
  'visit.c2k': 'À quoi s’attendre', 'visit.c2t': 'Venez comme vous êtes',
  'visit.c2m': 'Pas de code vestimentaire, rien à payer. Quelqu’un de l’équipe d’accueil vous rencontrera à la porte et s’assiéra avec vous si vous préférez ne pas entrer seul.',
  'visit.c3k': 'Venir avec des enfants', 'visit.c3t': 'Ils sont les bienvenus',
  'visit.c3m': 'Les enfants restent avec leur famille pendant le culte. Personne ici ne s’offusque du bruit d’un enfant.',
  'visit.placek': 'Où nous nous réunissons',
  'visit.placem': 'Écrivez-nous pour l’itinéraire et pour tout ce que vous aimeriez savoir avant votre première visite.',
  'visit.directions': 'Obtenir l’itinéraire', 'visit.ask': 'Poser une question',

  'about.eyebrow': 'Qui nous sommes',
  'about.title': 'Une communauté missionnaire, plantée à Washington, envoyée vers les nations.',
  'about.p1': 'La Montagne Sainte Washington est l’assemblée de Washington de la Communauté Évangélique Missionnaire La Montagne Sainte (CEMMS). Nous sommes une communauté de croyants venus de plusieurs pays et langues, unis par une seule confession : Jésus-Christ est Seigneur.',
  'about.p2': 'Nous tenons à la Bible comme Parole de Dieu, au salut par grâce au moyen de la foi, à l’œuvre du Saint-Esprit dans la vie du croyant, et à la Grande Commission comme mission de chaque disciple — pas seulement des pasteurs.',
  'about.badgeb': 'Une famille', 'about.badges': 'Français, anglais, lingala — un seul Évangile',
  'about.s1b': 'Bible', 'about.s1s': 'Notre seule règle de foi',
  'about.s2b': 'Mission', 'about.s2s': 'Chaque membre est envoyé',
  'about.s3b': 'Famille', 'about.s3s': 'Personne ne marche seul',

  'lead.eyebrow': 'Direction',
  'lead.title': 'Ceux qui portent cette maison.',
  'lead.lede': 'Vous devez savoir qui conduit avant de franchir la porte. Voici les personnes qui portent cette église, et que vous rencontrerez le dimanche.',
  'lead.r1': 'Pasteur principal',
  'lead.d1': 'Shepherd Israel Kalakala conduit La Montagne Sainte Washington. Il porte la vision de la maison, prêche la Parole le dimanche et se donne au soin pastoral de la communauté. Sa porte est ouverte à quiconque a besoin de conseil ou de prière.',
  'lead.c1': 'Demander un entretien →',
  'lead.r2': 'Au service ensemble',
  'lead.d2': 'Les Kalakala conduisent cette église ensemble. Le mariage, le foyer et la famille ne sont pas séparés du ministère ici : ils font partie de la manière dont la communauté est enseignée, accueillie et accompagnée.',
  'lead.c2': 'Voir les ministères →',

  'vision.eyebrow': 'Vision &amp; mission',
  'vision.title': 'Deux phrases qui décident de tout ce que nous faisons.',
  'vision.vn': 'Vision', 'vision.vt': 'Allez dans le monde',
  'vision.vd': 'Nous n’existons pas pour nous-mêmes. L’Église n’est pas le bâtiment où nous nous réunissons — ce sont les personnes que Dieu en envoie, dans les entreprises, les campus, les quartiers et les nations, porteuses de la lumière reçue.',
  'vision.mn': 'Mission', 'vision.mt': 'Faites des disciples de Jésus',
  'vision.md': 'Pas des foules — des disciples. Des personnes qui connaissent la Parole, marchent par l’Esprit, sont formées dans le caractère, et capables à leur tour de conduire quelqu’un à Christ et de lui enseigner à garder tout ce qu’il a commandé.',

  'min.eyebrow': 'Ministères',
  'min.title': 'Il y a ici une place pour ce que Dieu a mis en vous.',
  'min.lede': 'Chaque ministère est ouvert aux membres et aux invités qui désirent servir. Dites-nous par où vous aimeriez commencer et nous vous mettrons en lien avec le responsable.',
  'min.m1t': 'Louange &amp; musique',
  'min.m1d': 'Chanteurs, musiciens et techniciens du son qui conduisent l’assemblée dans la présence de Dieu, semaine après semaine.',
  'min.m2t': 'Prière &amp; intercession',
  'min.m2d': 'La salle des machines de l’église. Nous prions pour notre ville, nos familles, les malades et les nations.',
  'min.m3t': 'Jeunesse &amp; enfants',
  'min.m3d': 'Un enseignement qui prend les jeunes au sérieux, afin que la génération suivante s’approprie la foi au lieu d’hériter d’une habitude.',
  'min.m4t': 'Missions &amp; évangélisation',
  'min.m4d': 'Évangélisation dans la région de Washington et soutien à l’œuvre missionnaire de la CEMMS — la raison du nom que porte cette église.',
  'min.m5t': 'Fraternités femmes &amp; hommes',
  'min.m5d': 'De petits cercles où le mariage, le travail, l’argent, le célibat et la foi se discutent honnêtement et se portent dans la prière.',
  'min.m6t': 'Accueil &amp; entraide',
  'min.m6d': 'Hospitalité, aide pratique aux nouveaux arrivés aux États-Unis, visite des malades et soutien dans le deuil.',

  'life.eyebrow': 'Vie d’église', 'life.title': 'Nuit de louange.',
  'life.lede': 'La Nuit de louange est une soirée entièrement consacrée à la louange et à la présence de Dieu, conduite par notre équipe. Voici à quoi cela ressemble.',
  'watch.title': 'Vous avez manqué un culte ? Revoyez-le.',
  'watch.lede': 'Les messages, les nuits de louange et les cultes spéciaux sont publiés sur notre chaîne YouTube. Abonnez-vous pour être averti dès que nous sommes en direct.',
  'watch.cta': 'Regarder sur YouTube',

  'give.eyebrow': 'Donner', 'give.title': 'Chaque don part dans la mission.',
  'give.p1': 'Les dîmes et les offrandes financent la salle où nous nous réunissons, le matériel de l’équipe de louange, le soutien aux familles en difficulté et l’œuvre missionnaire que notre communauté appuie.',
  'give.p2': 'Donner est un acte d’adoration, jamais une condition d’accueil. Vous êtes tout aussi bienvenu si vous ne donnez jamais un dollar.',
  'give.r1': 'Sur place, pendant le culte', 'give.r1b': 'Espèces ou chèque',
  'give.r2': 'Par transfert mobile', 'give.r3': 'Par virement bancaire', 'give.r3b': 'Sur demande',
  'give.cta': 'Demander les coordonnées',

  'contact.eyebrow': 'Contact &amp; prière',
  'contact.title': 'Dites-nous que vous venez — ou comment prier pour vous.',
  'contact.lede': 'Les demandes envoyées ici sont lues par l’équipe pastorale et traitées confidentiellement. Si vous souhaitez être rappelé, laissez un numéro de téléphone dans votre message.',
  'contact.fname': 'Votre nom', 'contact.phname': 'Prénom et nom',
  'contact.femail': 'Courriel', 'contact.ftopic': 'De quoi s’agit-il ?',
  'contact.o1': 'Je souhaite visiter', 'contact.o2': 'J’ai un sujet de prière',
  'contact.o3': 'Je souhaite servir dans un ministère', 'contact.o4': 'Coordonnées pour les dons',
  'contact.o5': 'Autre chose',
  'contact.fmsg': 'Message', 'contact.phmsg': 'Écrivez librement — nous lisons chaque message.',
  'contact.send': 'Envoyer le message',
  'contact.note': 'Nous répondons par courriel, généralement sous deux jours.',
  'contact.iemail': 'Courriel', 'contact.iplace': 'Adresse', 'contact.itimes': 'Culte du dimanche',
  'contact.follow': 'Suivre l’église',

  'ftr.blurb': 'Une communauté évangélique missionnaire dans la région de Washington. Allez dans le monde. Faites des disciples de Jésus.',
  'ftr.h1': 'L’église', 'ftr.h2': 'Nous contacter', 'ftr.prayer': 'Sujet de prière',
  'ftr.verse': '« Allez, faites de toutes les nations des disciples. » — Matthieu 28:19'
};

/* ------------------------------------------------------------------ utils */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------- config injection */
function applyConfig(lang) {
  $$('[data-time]').forEach(el => { const t = SITE.times[el.dataset.time]; if (t) el.textContent = t[lang] || t.en; });
  $$('[data-address]').forEach(el => { el.textContent = SITE.address[lang] || SITE.address.en; });
  $$('[data-maps]').forEach(el => { el.href = SITE.mapsUrl; el.target = '_blank'; el.rel = 'noopener'; });
  $$('[data-give]').forEach(el => { const g = SITE.giving[el.dataset.give]; if (g) el.textContent = g[lang] || g.en; });
  $$('[data-social]').forEach(el => { const u = SITE.social[el.dataset.social]; if (u) el.href = u; });
  const banner = $('#draftBanner');
  if (banner) banner.hidden = !SITE.draft;
}

/* -------------------------------------------------------------- language */
const cache = new WeakMap();   // element -> original English

function translate(lang) {
  $$('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (!cache.has(el)) cache.set(el, el.innerHTML);
    el.innerHTML = lang === 'fr' ? (FR[key] ?? cache.get(el)) : cache.get(el);
  });
  $$('[data-i18n-ph]').forEach(el => {
    const key = el.dataset.i18nPh;
    if (!cache.has(el)) cache.set(el, el.placeholder);
    el.placeholder = lang === 'fr' ? (FR[key] ?? cache.get(el)) : cache.get(el);
  });
  document.documentElement.lang = lang;
  $$('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  applyConfig(lang);
  try { localStorage.setItem('msw-lang', lang); } catch (e) { /* private mode */ }
}

function initLang() {
  let lang = 'en';
  try {
    lang = localStorage.getItem('msw-lang')
        || ((navigator.language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en');
  } catch (e) { lang = 'en'; }
  translate(lang);
  $$('.lang button').forEach(b => b.addEventListener('click', () => translate(b.dataset.lang)));
}

/* ---------------------------------------------------------------- header */
function initHeader() {
  const hdr = $('#hdr'), drawer = $('#drawer'), burger = $('#burger');
  const onScroll = () => hdr.classList.toggle('is-stuck', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const close = () => { drawer.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; };
  burger.addEventListener('click', () => {
    const open = drawer.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });
  $$('#drawer a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  // Active section highlighting
  const links = $$('#nav a');
  const sections = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => spy.observe(s));
  }
}

/* ---------------------------------------------------------------- reveal */
function initReveal() {
  const items = $$('.rv');
  if (reduced || !('IntersectionObserver' in window)) { items.forEach(i => i.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); obs.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: .12 });
  items.forEach(i => io.observe(i));
}

/* --------------------------------------------------------------- marquee */
function initMarquee() {
  const track = $('#marquee');
  if (!track) return;
  track.appendChild(track.firstElementChild.cloneNode(true)); // seamless -50% loop
  if (reduced) track.style.animation = 'none';
}

/* ----------------------------------------------------------------- video */
function initVideo() {
  const v = $('#heroVideo'), btn = $('#motionToggle');
  if (!v) return;
  const play = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  if (reduced) { v.pause(); v.removeAttribute('autoplay'); }
  else {
    play();
    // Pause off-screen to save battery, resume on return — unless the visitor paused it.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) v.pause();
      else if (!v.dataset.userPaused) play();
    });
    ['click', 'touchstart', 'keydown'].forEach(ev =>
      document.addEventListener(ev, () => { if (v.paused && !v.dataset.userPaused) play(); }, { once: true, passive: true }));
  }
  // The animation is meant to run continuously: restart it if it ever stalls or ends.
  ['ended', 'stalled', 'suspend'].forEach(ev =>
    v.addEventListener(ev, () => { if (!v.dataset.userPaused && !reduced && v.paused) play(); }));

  if (!btn) return;
  btn.addEventListener('click', () => {
    if (v.paused) { v.dataset.userPaused = ''; delete v.dataset.userPaused; play(); btn.setAttribute('aria-label', 'Pause background animation'); }
    else { v.pause(); v.dataset.userPaused = '1'; btn.setAttribute('aria-label', 'Play background animation'); }
    btn.innerHTML = v.paused
      ? '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M8 5h3v14H8zm5 0h3v14h-3z"/></svg>';
  });
}

/* -------------------------------------------------------------- lightbox */
function initLightbox() {
  const lb = $('#lightbox'), img = $('#lbImg'), thumbs = $$('#gallery button');
  if (!lb || !thumbs.length) return;
  let i = 0, lastFocus = null;

  const show = n => {
    i = (n + thumbs.length) % thumbs.length;
    const t = thumbs[i];
    img.src = t.dataset.full;
    img.alt = t.querySelector('img')?.alt || '';
  };
  const open = n => { lastFocus = document.activeElement; show(n); lb.classList.add('is-open'); document.body.style.overflow = 'hidden'; $('.lb__close', lb).focus(); };
  const close = () => { lb.classList.remove('is-open'); document.body.style.overflow = ''; lastFocus?.focus(); };

  thumbs.forEach((t, n) => t.addEventListener('click', () => open(n)));
  $('.lb__close', lb).addEventListener('click', close);
  $('.lb__nav--prev', lb).addEventListener('click', () => show(i - 1));
  $('.lb__nav--next', lb).addEventListener('click', () => show(i + 1));
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') show(i + 1);
    if (e.key === 'ArrowLeft') show(i - 1);
  });
}

/* ------------------------------------------------------------------ boot */
document.addEventListener('DOMContentLoaded', () => {
  const yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();
  initLang();
  initHeader();
  initReveal();
  initMarquee();
  initVideo();
  initLightbox();
});
