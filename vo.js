/* ============================================================
   VO NAIL ARTIST — page behaviour.

   Scoped to this page on purpose. It does not use the site's i18n.js: that
   dictionary belongs to Mwinda Digital and loading it here would ship a few
   hundred unrelated strings to every visitor. The attribute contract is the
   same one documented in CLAUDE.md, so the markup reads identically:

     data-i18n="key"            replace text
     data-i18n-html             the string carries inline HTML
     data-i18n-attr="content"   translate an attribute instead of text

   French is the source language written in the markup; both locales live in
   the dictionary below, and every key exists in both.
   ============================================================ */
(() => {
  'use strict';

  document.documentElement.classList.add('js');

  const WA_NUMBER = '14258641421';   // +1 (425) 864-1421

  /* ============================================================
     Background cut selection.

     Two encodes exist: a 16:9 master and a 9:16 cut framed for phones. The
     obvious way to choose between them — `media` on a <source> — does not
     work: browsers evaluate that attribute inside <picture> only and ignore
     it inside <video>, so a phone silently loads the landscape file and
     centre-crops it. The markup therefore ships the landscape cut (which is
     what a visitor without JavaScript gets, and it is fine), and the swap
     happens here.

     This runs before video-bg.js on purpose, so the player initialises on the
     source it will actually keep.
     ============================================================ */
  (function pickBackgroundCut() {
    const video = document.querySelector('.site-bg video');
    if (!video) return;

    if (!window.matchMedia('(max-aspect-ratio: 3/4)').matches) return;

    // Both codecs are swapped, by type, so the browser keeps whichever it can
    // actually decode. Replacing only the MP4 would leave a VP9-capable
    // browser playing the landscape WebM on a phone.
    const byType = {
      'video/webm': video.dataset.portraitWebm,
      'video/mp4': video.dataset.portraitMp4,
    };
    let swapped = false;
    video.querySelectorAll('source').forEach((source) => {
      const next = byType[source.type];
      if (next) { source.src = next; swapped = true; }
    });
    if (!swapped) return;

    const poster = video.dataset.portraitPoster;
    if (poster) {
      video.poster = poster;
      const still = document.querySelector('.site-bg-img');
      if (still) still.src = poster;
    }
    // Required: changing a <source> after parsing has no effect until the
    // element re-runs resource selection.
    video.load();
  })();

  /* ---------------- dictionary ---------------- */
  const dict = {
    fr: {
      'meta.desc': "VO Nail Artist à Issaquah, WA — pose gel, Gel-X, acrylique et nail art sur mesure. Studio privé, sur rendez-vous. Réservation directe par WhatsApp.",
      'a11y.skip': 'Aller au contenu',

      'nav.signature': 'Signatures', 'nav.services': 'Prestations',
      'nav.ritual': 'Le rituel', 'nav.gallery': 'Galerie', 'nav.faq': 'FAQ',

      'cta.book': 'Réserver',
      'cta.bookWa': 'Réserver sur WhatsApp',
      'cta.see': 'Voir les créations',
      'cta.ask': 'Poser une question',

      'hero.eyebrow': 'Issaquah, WA · Sur rendez-vous',
      'hero.title': "L'art au bout <em>des doigts</em>",
      'hero.lede': "Des mains qu'on remarque avant même que vous parliez. Pose gel, Gel-X, acrylique et nail art dessiné à la main — pensé pour votre morphologie, tenu pour durer trois semaines sans faiblir.",

      'trust.1.k': 'Stérilisation', 'trust.1.v': 'Instruments en autoclave, limes à usage unique',
      'trust.2.k': '3 semaines',    'trust.2.v': 'De tenue, sans décollement ni éclat',
      'trust.3.k': 'Sur mesure',    'trust.3.v': 'Forme, longueur et motif dessinés pour vous',

      'sig.eyebrow': 'Les signatures',
      'sig.title': 'Trois univers, <em>une même exigence</em>',
      'sig.sub': "Chaque collection part d'une conversation : votre peau, vos mains, votre semaine. Le motif vient après.",
      'sig.1.t': 'Botanique Espresso',
      'sig.1.d': "Feuillage peint à main levée sur base laiteuse, french chocolat en finition miroir. Discret de loin, minutieux de près.",
      'sig.1.g': 'Gel · Ballerine · Nail art main levée',
      'sig.2.t': 'Saphir en Fleur',
      'sig.2.d': "Bleu profond, fleurs blanches en dégradé et cristaux posés un par un. La pièce qu'on garde pour les grands soirs.",
      'sig.2.g': 'Gel-X · Carré long · Cristaux · Chrome',
      'sig.3.t': 'Velours Bordeaux',
      'sig.3.d': "Prune profond, paillettes cuivrées et feuillage doré. Une palette d'automne qui tient toute l'année.",
      'sig.3.g': 'Acrylique · Ballerine · Or · Perles',

      'srv.eyebrow': 'Prestations & tarifs',
      'srv.title': "Le dessin est <em>compris</em> dans le prix",
      'srv.sub': "Tout modèle, tout nail art. Le tarif suit la longueur, jamais la complexité du motif — une fresque coûte le prix d'une couleur nue.",
      'srv.hands': 'Mains', 'srv.feet': 'Pieds',
      'srv.short': 'Court', 'srv.medium': 'Moyen', 'srv.long': 'Long',
      'srv.feetAll': 'Toutes longueurs',
      'srv.included': 'Tout modèle · Tout nail art compris',
      'srv.home.t': 'À domicile · +$15',
      'srv.home.d': "Je me déplace chez vous avec tout le matériel. Vous ne bougez pas, vous ne cherchez pas de place de parking. Sur demande, selon le secteur.",
      'srv.home.cta': 'Demander à domicile',
      'srv.note': "Issaquah et alentours. Le créneau et le tarif exact sont confirmés sur WhatsApp avant le rendez-vous. Paiement sur place.",

      'rit.eyebrow': 'Le rituel',
      'rit.title': "Quatre temps, <em>zéro improvisation</em>",
      'rit.1.t': "On parle d'abord",
      'rit.1.d': "Photos, inspirations, contraintes de métier. On fixe forme, longueur et budget avant de toucher une lime.",
      'rit.2.t': 'Préparation clinique',
      'rit.2.d': "Instruments sortis d'autoclave devant vous, limes neuves, plan de travail désinfecté. C'est non négociable.",
      'rit.3.t': 'La pose',
      'rit.3.d': "Structure d'abord, couleur ensuite, motif en dernier. Chaque couche est contrôlée à la lumière avant la suivante.",
      'rit.4.t': 'Vous repartez avec',
      'rit.4.d': "Huile à cuticules, les gestes qui font tenir la pose, et la date du remplissage déjà posée.",

      'std.eyebrow': "L'exigence",
      'std.title': "Ce qui ne se négocie <em>jamais</em>",
      'std.sub': "Une belle pose se voit le premier jour. Une bonne pose se voit le vingtième.",
      'std.1.t': "Hygiène d'abord",
      'std.1.d': "Autoclave, usage unique, gants. L'ongle qui vous est rendu est plus sain qu'à l'arrivée.",
      'std.2.t': "L'ongle naturel protégé",
      'std.2.d': "Pas de ponçage à l'os pour gagner dix minutes. La tenue vient de la préparation, pas de l'agression.",
      'std.3.t': "L'heure est l'heure",
      'std.3.d': "Un seul rendez-vous à la fois. Vous n'attendez pas, et on ne vous presse pas.",
      'std.4.t': 'Retouche offerte',
      'std.4.d': "Un ongle cède dans les sept jours ? Il est repris sans discussion et sans frais.",

      'gal.eyebrow': 'Galerie',
      'gal.title': 'Le travail, <em>sans filtre</em>',
      'gal.sub': 'Cliquez pour agrandir.',

      'faq.eyebrow': 'Questions',
      'faq.title': "Ce qu'on me demande <em>le plus</em>",
      'faq.1.q': "Combien de temps ça tient ?",
      'faq.1.a': "Trois semaines en moyenne, souvent quatre. La repousse se voit avant que la pose ne bouge — c'est elle qui fixe la date du remplissage.",
      'faq.2.q': "Est-ce que ça abîme mes ongles ?",
      'faq.2.a': "Non, quand la préparation et la dépose sont faites correctement. Ce qui abîme, c'est le limage excessif et l'arrachage à la maison.",
      'faq.3.q': "Vous travaillez sur ongles rongés ?",
      'faq.3.a': "Oui, c'est même l'un des cas les plus fréquents. On reconstruit progressivement et la peau autour se calme en deux à trois poses.",
      'faq.4.q': "Je viens avec une photo, c'est possible ?",
      'faq.4.a': "C'est encouragé. Envoyez-la sur WhatsApp avant : je vous dis honnêtement ce qui est reproductible, ce qui est adaptable, et ce qui ne tiendra pas sur vos mains.",
      'faq.5.q': 'Comment réserver ?',
      'faq.5.a': "Uniquement par WhatsApp, au +1 (425) 864-1421. Vous recevez la confirmation, l'adresse exacte et le tarif dans le même message.",
      'faq.7.q': 'Vous vous déplacez à domicile ?',
      'faq.7.a': "Oui, pour 15 $ de plus. J'arrive avec tout le matériel, y compris la lampe et la table. Sur demande et selon le secteur autour d'Issaquah — demandez sur WhatsApp avec votre adresse et je vous dis tout de suite.",
      'faq.6.q': 'Et si je dois annuler ?',
      'faq.6.a': "Prévenez au moins 24 h à l'avance et le créneau est simplement déplacé. C'est tout ce qui est demandé.",

      'book.eyebrow': 'Réservation',
      'book.title': 'Un message suffit. <em>Vraiment.</em>',
      'book.sub': "Dites-moi la date qui vous arrange et ce que vous avez en tête. Vous recevez le créneau, le tarif et l'adresse dans la réponse.",
      'book.cta': 'Écrire sur WhatsApp',
      'book.hours': 'Réponse sous quelques heures · Sur rendez-vous uniquement',

      'brand.tagline': 'De beaux ongles. Une confiance sans limite.',
      'brand.script': 'Vos ongles, votre art',
      'social.ig': 'Suivez le travail sur Instagram',
      'foot.role': 'Nail Artist',
      'foot.by': 'Site par Mwinda Digital',

      'wa.msg': "Bonjour VO ! J'aimerais réserver une pose. Voici ce que j'ai en tête :",
    },

    en: {
      'meta.desc': "VO Nail Artist in Issaquah, WA — gel, Gel-X, acrylic and hand-painted custom nail art. Private studio, by appointment. Book directly on WhatsApp.",
      'a11y.skip': 'Skip to content',

      'nav.signature': 'Signatures', 'nav.services': 'Services',
      'nav.ritual': 'The ritual', 'nav.gallery': 'Gallery', 'nav.faq': 'FAQ',

      'cta.book': 'Book',
      'cta.bookWa': 'Book on WhatsApp',
      'cta.see': 'See the work',
      'cta.ask': 'Ask a question',

      'hero.eyebrow': 'Issaquah, WA · By appointment',
      'hero.title': 'Art at your <em>fingertips</em>',
      'hero.lede': "Hands people notice before you say a word. Gel, Gel-X, acrylic and hand-painted nail art — shaped to your hands, built to hold three weeks without flinching.",

      'trust.1.k': 'Sterilised', 'trust.1.v': 'Autoclaved tools, single-use files',
      'trust.2.k': '3 weeks',    'trust.2.v': 'Of wear, with no lifting and no chips',
      'trust.3.k': 'Made for you', 'trust.3.v': 'Shape, length and design drawn for your hands',

      'sig.eyebrow': 'The signatures',
      'sig.title': 'Three worlds, <em>one standard</em>',
      'sig.sub': "Every set starts as a conversation: your skin, your hands, your week. The design comes after that.",
      'sig.1.t': 'Espresso Botanical',
      'sig.1.d': "Foliage painted freehand over a milky base, chocolate french in mirror finish. Quiet from across the room, exacting up close.",
      'sig.1.g': 'Gel · Ballerina · Freehand art',
      'sig.2.t': 'Sapphire in Bloom',
      'sig.2.d': "Deep blue, white florals in gradient, crystals set one at a time. The set you save for the nights that matter.",
      'sig.2.g': 'Gel-X · Long square · Crystals · Chrome',
      'sig.3.t': 'Bordeaux Velvet',
      'sig.3.d': "Deep plum, copper glitter and gilded foliage. An autumn palette that carries all year.",
      'sig.3.g': 'Acrylic · Ballerina · Gold · Pearls',

      'srv.eyebrow': 'Services & pricing',
      'srv.title': 'The design is <em>included</em> in the price',
      'srv.sub': "Any model, any nail art. The rate follows length, never how intricate the design is — a full painting costs what a bare colour costs.",
      'srv.hands': 'Hands', 'srv.feet': 'Feet',
      'srv.short': 'Short', 'srv.medium': 'Medium', 'srv.long': 'Long',
      'srv.feetAll': 'All lengths',
      'srv.included': 'Any model · Any nail art included',
      'srv.home.t': 'At home · +$15',
      'srv.home.d': "I come to you with everything. You do not travel and you do not hunt for parking. On request, depending on the area.",
      'srv.home.cta': 'Ask about at-home',
      'srv.note': "Issaquah and nearby. Your slot and the exact rate are confirmed on WhatsApp before the appointment. Payment on site.",

      'rit.eyebrow': 'The ritual',
      'rit.title': 'Four stages, <em>nothing improvised</em>',
      'rit.1.t': 'We talk first',
      'rit.1.d': "Photos, references, what your job allows. Shape, length and budget are settled before a file is picked up.",
      'rit.2.t': 'Clinical prep',
      'rit.2.d': "Tools out of the autoclave in front of you, new files, disinfected station. That part is not negotiable.",
      'rit.3.t': 'The application',
      'rit.3.d': "Structure first, colour next, design last. Every layer is checked under the lamp before the next one goes on.",
      'rit.4.t': 'You leave with',
      'rit.4.d': "Cuticle oil, the habits that make a set last, and your fill already in the calendar.",

      'std.eyebrow': 'The standard',
      'std.title': 'What is <em>never</em> negotiable',
      'std.sub': "A pretty set shows on day one. A good set shows on day twenty.",
      'std.1.t': 'Hygiene first',
      'std.1.d': "Autoclave, single use, gloves. The nail you leave with is healthier than the one you arrived with.",
      'std.2.t': 'The natural nail protected',
      'std.2.d': "No filing down to the bone to save ten minutes. Wear comes from preparation, not from damage.",
      'std.3.t': 'On time means on time',
      'std.3.d': "One appointment at a time. You are not kept waiting, and you are not rushed out.",
      'std.4.t': 'Free repair',
      'std.4.d': "A nail gives way within seven days? It is redone, no argument and no charge.",

      'gal.eyebrow': 'Gallery',
      'gal.title': 'The work, <em>unfiltered</em>',
      'gal.sub': 'Tap to enlarge.',

      'faq.eyebrow': 'Questions',
      'faq.title': 'What I get asked <em>most</em>',
      'faq.1.q': 'How long does it last?',
      'faq.1.a': "Three weeks on average, often four. Regrowth shows before the set moves — that is what sets the date of your fill.",
      'faq.2.q': 'Will it damage my nails?',
      'faq.2.a': "No, when the prep and the removal are done properly. What causes damage is over-filing and picking a set off at home.",
      'faq.3.q': 'Do you work on bitten nails?',
      'faq.3.a': "Yes, and it is one of the most common cases. We rebuild gradually and the surrounding skin settles within two or three sets.",
      'faq.4.q': 'Can I bring a photo?',
      'faq.4.a': "Please do. Send it on WhatsApp beforehand and I will tell you honestly what is reproducible, what needs adapting, and what will not hold on your hands.",
      'faq.5.q': 'How do I book?',
      'faq.5.a': "WhatsApp only, on +1 (425) 864-1421. Confirmation, the exact address and the price all come back in the same message.",
      'faq.7.q': 'Do you come to me?',
      'faq.7.a': "Yes, for $15 more. I arrive with everything, lamp and table included. On request and depending on the area around Issaquah — message me on WhatsApp with your address and I will tell you straight away.",
      'faq.6.q': 'What if I need to cancel?',
      'faq.6.a': "Let me know at least 24 h ahead and the slot is simply moved. That is all that is asked.",

      'book.eyebrow': 'Booking',
      'book.title': 'One message is enough. <em>Truly.</em>',
      'book.sub': "Tell me the date that suits you and what you have in mind. The slot, the price and the address come back in the reply.",
      'book.cta': 'Message on WhatsApp',
      'book.hours': 'Replies within a few hours · By appointment only',

      'brand.tagline': 'Beautiful nails. Endless confidence.',
      'brand.script': 'Your nails, your art',
      'social.ig': 'Follow the work on Instagram',
      'foot.role': 'Nail Artist',
      'foot.by': 'Site by Mwinda Digital',

      'wa.msg': "Hi VO! I'd love to book a set. Here's what I have in mind:",
    },
  };

  /* ---------------- i18n engine ---------------- */
  const STORE = 'vo.lang';
  let current = 'fr';

  function t(key) {
    return (dict[current] && dict[current][key]) || dict.fr[key] || key;
  }

  function apply(lang) {
    if (!dict[lang]) lang = 'fr';
    current = lang;
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const value = t(el.getAttribute('data-i18n'));
      const attr = el.getAttribute('data-i18n-attr');
      if (attr) el.setAttribute(attr, value);
      else if (el.hasAttribute('data-i18n-html')) el.innerHTML = value;
      else el.textContent = value;
    });

    // The href is the real booking link and must survive a broken script, so
    // the markup ships a working wa.me URL; this only adds the prefilled text.
    const href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(t('wa.msg'));
    document.querySelectorAll('[data-wa]').forEach((a) => { a.href = href; });

    document.querySelectorAll('.lang-btn').forEach((b) => {
      const on = b.dataset.lang === lang;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });

    try { localStorage.setItem(STORE, lang); } catch { /* private mode */ }
    window.dispatchEvent(new CustomEvent('vo:lang', { detail: { lang } }));
  }

  let saved = null;
  try { saved = localStorage.getItem(STORE); } catch { /* private mode */ }
  // A stored choice wins. Otherwise follow the browser, defaulting to French:
  // the markup is written in French, so that is the no-JavaScript state too.
  const browser = (navigator.language || 'fr').slice(0, 2).toLowerCase();
  apply(dict[saved] ? saved : (browser === 'en' ? 'en' : 'fr'));

  document.querySelectorAll('.lang-btn').forEach((b) => {
    b.addEventListener('click', () => apply(b.dataset.lang));
  });

  window.vo = { t, apply, current: () => current };

  /* ---------------- nav and mobile dock ---------------- */
  const nav = document.getElementById('nav');
  const burger = nav.querySelector('.burger');
  const dock = document.querySelector('.wa-dock');

  const onScroll = () => {
    nav.classList.toggle('is-stuck', window.scrollY > 24);
    dock.classList.toggle('is-up', window.scrollY > 420);
  };

  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });

  nav.querySelectorAll('.nav-links a').forEach((a) => {
    a.addEventListener('click', () => {
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------- reveal on scroll ---------------- */
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    // Stagger siblings so a grid arrives as a wave rather than a block.
    const seen = new Map();
    items.forEach((el) => {
      const parent = el.parentElement;
      const n = (seen.get(parent) || 0);
      seen.set(parent, n + 1);
      el.style.setProperty('--d', Math.min(n, 5) * 90 + 'ms');
      io.observe(el);
    });
  }

  /* ---------------- lightbox ---------------- */
  const lb = document.querySelector('.lb');
  const lbImg = lb.querySelector('.lb-img');
  const lbX = lb.querySelector('.lb-x');
  let lastFocus = null;

  function openLb(src, alt) {
    lastFocus = document.activeElement;
    lbImg.src = src;
    lbImg.alt = alt || '';
    lb.hidden = false;
    requestAnimationFrame(() => lb.classList.add('is-on'));
    document.body.style.overflow = 'hidden';
    lbX.focus();
  }

  function closeLb() {
    lb.classList.remove('is-on');
    document.body.style.overflow = '';
    // Wait out the fade before hiding, or the image vanishes mid-transition.
    setTimeout(() => { lb.hidden = true; lbImg.src = ''; }, 350);
    if (lastFocus) lastFocus.focus();
  }

  document.querySelectorAll('.gal-i').forEach((b) => {
    b.addEventListener('click', () => {
      const img = b.querySelector('img');
      openLb(b.dataset.full, img ? img.alt : '');
    });
  });

  lbX.addEventListener('click', closeLb);
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !lb.hidden) closeLb();
  });

  /* ---------------- footer year ---------------- */
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
})();
