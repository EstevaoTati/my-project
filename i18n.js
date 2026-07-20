/* ============================================================
   MWINDA GROUP — i18n (FR / EN)
   Lightweight, no dependency. Reads data-i18n="key" attributes
   on elements and swaps text. Use data-i18n-html on elements
   that contain inline tags (em/span/br) to allow HTML in the
   translated string.
   ============================================================ */
(() => {
  'use strict';

  const STORAGE_KEY = 'mwinda.lang';

  const dict = {
    fr: {
      'meta.title': "MWINDA GROUP LLC — Bringing Light to Your Ideas",
      'meta.desc' : "MWINDA GROUP LLC — Bringing Light to Your Ideas. Holding multi-activités : Digital, Consulting, Events, Publishing, Food & Impact Social.",

      'nav.home': "Accueil",
      'nav.about': "À propos",
      'nav.divisions': "Pôles",
      'nav.ecosystem': "Écosystème",
      'nav.impact': "Impact",
      'nav.contact': "Contact",
      'nav.os': "MWINDA OS",
      'nav.cta': "Démarrer un projet",

      'hero.tag': "Holding entrepreneuriale multi-activités",
      'hero.t1': "Bringing", 'hero.t2': "Light", 'hero.t3': "to Your", 'hero.t4': "Ideas",
      'hero.sub': "MWINDA GROUP LLC combine expertise stratégique, technologie et exécution pour transformer les idées en écosystèmes durables — du digital à l'impact social.",
      'hero.cta1': "Découvrir nos pôles",
      'hero.cta2': "Nous contacter",
      'hero.m1': "Pôles d'activité",
      'hero.m2': "Vision intégrée",
      'hero.m3': "Possibilités",
      'hero.scroll': "Scroll",

      'about.eyebrow': "À propos",
      'about.title': 'Un <em>écosystème</em> intégré, <br/>une <span class="gold-text">vision</span> commune',
      'about.lead': "MWINDA GROUP LLC est structuré comme une <strong>holding de services multi-activités</strong>, avec une orientation forte vers l'innovation, l'impact social et la croissance des entreprises.",
      'about.p2': "Notre cœur repose sur une idée simple : <em>combiner expertise stratégique, technologie et exécution</em> pour accompagner les projets et les organisations vers leur plein potentiel.",
      'about.p1.t': "Innovation",
      'about.p1.d': "Technologies émergentes et IA au service de l'humain.",
      'about.p2.t': "Impact",
      'about.p2.d': "Une croissance économique alignée sur le bien commun.",
      'about.p3.t': "Excellence",
      'about.p3.d': "Exigence d'exécution sur chacune de nos verticales.",

      'div.eyebrow': "Nos pôles",
      'div.title': 'Six expertises, <span class="gold-text">une seule</span> lumière',
      'div.sub': "Chaque pôle est autonome dans son métier, mais connecté par une même exigence et une même mission : faire grandir vos idées.",

      'd1.tag': "AI · Web · Technology",
      'd1.desc': "Développement web, intelligence artificielle et solutions technologiques sur mesure pour transformer vos opérations.",
      'd1.l1': "Web & Mobile Apps", 'd1.l2': "IA & Automatisation", 'd1.l3': "Cloud & DevOps",

      'd2.tag': "Projects & Ideas Management",
      'd2.desc': "Gestion de projets, structuration d'idées et accompagnement stratégique pour entrepreneurs et organisations.",
      'd2.l1': "Stratégie d'entreprise", 'd2.l2': "Project Management", 'd2.l3': "Business Modeling",

      'd3.tag': "Conferences & Event Planning",
      'd3.desc': "Organisation de conférences, sommets et événements professionnels mémorables, du concept à l'exécution.",
      'd3.l1': "Conférences & Sommets", 'd3.l2': "Événements corporate", 'd3.l3': "Production scénique",

      'd4.tag': "Édition & Publication",
      'd4.desc': "Maison d'édition dédiée à la publication de livres, médias et contenus à fort impact intellectuel et culturel.",
      'd4.l1': "Édition de livres", 'd4.l2': "Médias & contenus", 'd4.l3': "Diffusion internationale",

      'd5.tag': "Food & Catering",
      'd5.desc': "Services alimentaires premium et catering pour événements, entreprises et particuliers — « Your smile, our priority ».",
      'd5.l1': "Catering événementiel", 'd5.l2': "Restauration corporate", 'd5.l3': "Cuisine sur mesure",

      'd6.tag': "ONG · Soutien aux sans-abri",
      'd6.desc': "Organisation à but non lucratif engagée dans le soutien, la dignité et la réinsertion des personnes sans-abri.",
      'd6.l1': "Hébergement d'urgence", 'd6.l2': "Programmes de réinsertion", 'd6.l3': "Sensibilisation publique",

      'eco.eyebrow': "L'écosystème",
      'eco.title': 'Tout est <span class="gold-text">connecté</span>.',
      'eco.sub': "Six pôles, une orchestration. Survolez le centre pour voir comment l'expertise circule dans le groupe.",

      'impact.eyebrow': "Impact",
      'impact.title': 'Notre <span class="gold-text">empreinte</span> en chiffres',
      'impact.s1': "Pôles d'activité",
      'impact.s2': "Projets accompagnés",
      'impact.s3': "Événements organisés",
      'impact.s4': "Vies impactées",
      'impact.quote': "Notre vision est de bâtir un écosystème qui répond aux besoins business, technologiques, communicationnels et sociaux — sous une même lumière.",
      'impact.author': "— MWINDA GROUP LLC",

      'contact.eyebrow': "Contact",
      'contact.title': 'Donnons <span class="gold-text">vie</span> <br/>à votre prochaine idée.',
      'contact.desc': "Que vous soyez une organisation, un entrepreneur ou une institution, nos équipes sont prêtes à concevoir avec vous une solution sur mesure.",
      'contact.email': "Email",
      'contact.phone': "Téléphone",
      'contact.hq': "Siège",
      'contact.hqv': "MWINDA GROUP LLC — USA",

      'form.name': "Nom complet",
      'form.email': "Adresse email",
      'form.topic': "Pôle concerné",
      'form.message': "Votre message",
      'form.submit': "Envoyer le message",
      'form.other': "Autre / Partenariat",
      'form.err.empty': "Merci de remplir tous les champs.",
      'form.err.email': "Adresse email invalide.",
      'form.ok': "Merci {name}, votre message a bien été envoyé. Nous reviendrons vers vous très vite.",

      'footer.tagline': "Bringing Light to Your Ideas. Une holding multi-activités au service de l'innovation, de l'impact et de l'excellence.",
      'footer.h1': "Pôles", 'footer.h2': "Groupe", 'footer.h3': "Légal",
      'footer.about': "À propos", 'footer.eco': "Écosystème", 'footer.os': "MWINDA OS", 'footer.impact': "Impact",
      'footer.careers': "Carrières", 'footer.press': "Presse",
      'footer.legal1': "Mentions légales", 'footer.legal2': "Confidentialité",
      'footer.legal3': "Cookies", 'footer.legal4': "CGU",
      'footer.rights1': "©", 'footer.rights2': "MWINDA GROUP LLC. Tous droits réservés.",
      'footer.craft': 'Crafted with <span class="gold-text">light</span> &amp; precision.',
    },

    en: {
      'meta.title': "MWINDA GROUP LLC — Bringing Light to Your Ideas",
      'meta.desc' : "MWINDA GROUP LLC — Bringing Light to Your Ideas. A multi-activity holding: Digital, Consulting, Events, Publishing, Food & Social Impact.",

      'nav.home': "Home",
      'nav.about': "About",
      'nav.divisions': "Divisions",
      'nav.ecosystem': "Ecosystem",
      'nav.impact': "Impact",
      'nav.contact': "Contact",
      'nav.os': "MWINDA OS",
      'nav.cta': "Start a project",

      'hero.tag': "Multi-activity entrepreneurial holding",
      'hero.t1': "Bringing", 'hero.t2': "Light", 'hero.t3': "to Your", 'hero.t4': "Ideas",
      'hero.sub': "MWINDA GROUP LLC combines strategic expertise, technology and execution to turn ideas into sustainable ecosystems — from digital to social impact.",
      'hero.cta1': "Discover our divisions",
      'hero.cta2': "Get in touch",
      'hero.m1': "Business divisions",
      'hero.m2': "Integrated vision",
      'hero.m3': "Possibilities",
      'hero.scroll': "Scroll",

      'about.eyebrow': "About",
      'about.title': 'An integrated <em>ecosystem</em>, <br/>one shared <span class="gold-text">vision</span>',
      'about.lead': "MWINDA GROUP LLC is structured as a <strong>multi-activity services holding</strong>, with a strong focus on innovation, social impact and business growth.",
      'about.p2': "Our core rests on a simple idea: <em>combining strategic expertise, technology and execution</em> to support projects and organizations toward their full potential.",
      'about.p1.t': "Innovation",
      'about.p1.d': "Emerging technologies and AI in service of people.",
      'about.p2.t': "Impact",
      'about.p2.d': "Economic growth aligned with the common good.",
      'about.p3.t': "Excellence",
      'about.p3.d': "Uncompromising execution across every vertical.",

      'div.eyebrow': "Our divisions",
      'div.title': 'Six expertises, <span class="gold-text">one</span> light',
      'div.sub': "Each division is autonomous in its craft, yet connected by the same standard and the same mission: growing your ideas.",

      'd1.tag': "AI · Web · Technology",
      'd1.desc': "Web development, artificial intelligence and tailor-made technology solutions to transform your operations.",
      'd1.l1': "Web & Mobile Apps", 'd1.l2': "AI & Automation", 'd1.l3': "Cloud & DevOps",

      'd2.tag': "Projects & Ideas Management",
      'd2.desc': "Project management, idea structuring and strategic guidance for entrepreneurs and organizations.",
      'd2.l1': "Business Strategy", 'd2.l2': "Project Management", 'd2.l3': "Business Modeling",

      'd3.tag': "Conferences & Event Planning",
      'd3.desc': "Memorable conferences, summits and corporate events — from concept to flawless execution.",
      'd3.l1': "Conferences & Summits", 'd3.l2': "Corporate Events", 'd3.l3': "Stage Production",

      'd4.tag': "Publishing & Editorial",
      'd4.desc': "A publishing house dedicated to high-impact books, media and content with intellectual and cultural reach.",
      'd4.l1': "Book Publishing", 'd4.l2': "Media & Content", 'd4.l3': "International Distribution",

      'd5.tag': "Food & Catering",
      'd5.desc': "Premium food services and catering for events, businesses and individuals — “Your smile, our priority.”",
      'd5.l1': "Event Catering", 'd5.l2': "Corporate Dining", 'd5.l3': "Custom Cuisine",

      'd6.tag': "NGO · Supporting the homeless",
      'd6.desc': "A non-profit organization dedicated to support, dignity and reintegration of homeless people.",
      'd6.l1': "Emergency Shelter", 'd6.l2': "Reintegration Programs", 'd6.l3': "Public Awareness",

      'eco.eyebrow': "The ecosystem",
      'eco.title': 'Everything is <span class="gold-text">connected</span>.',
      'eco.sub': "Six divisions, one orchestration. Hover the center to see how expertise flows through the group.",

      'impact.eyebrow': "Impact",
      'impact.title': 'Our <span class="gold-text">footprint</span> in numbers',
      'impact.s1': "Business divisions",
      'impact.s2': "Projects supported",
      'impact.s3': "Events organized",
      'impact.s4': "Lives impacted",
      'impact.quote': "Our vision is to build an ecosystem that meets business, technology, communication and social needs — under one same light.",
      'impact.author': "— MWINDA GROUP LLC",

      'contact.eyebrow': "Contact",
      'contact.title': 'Let\'s bring <span class="gold-text">life</span> <br/>to your next idea.',
      'contact.desc': "Whether you are an organization, an entrepreneur or an institution, our teams are ready to design a tailored solution with you.",
      'contact.email': "Email",
      'contact.phone': "Phone",
      'contact.hq': "Headquarters",
      'contact.hqv': "MWINDA GROUP LLC — USA",

      'form.name': "Full name",
      'form.email': "Email address",
      'form.topic': "Division",
      'form.message': "Your message",
      'form.submit': "Send message",
      'form.other': "Other / Partnership",
      'form.err.empty': "Please fill in all fields.",
      'form.err.email': "Invalid email address.",
      'form.ok': "Thank you {name}, your message has been sent. We'll get back to you very soon.",

      'footer.tagline': "Bringing Light to Your Ideas. A multi-activity holding serving innovation, impact and excellence.",
      'footer.h1': "Divisions", 'footer.h2': "Group", 'footer.h3': "Legal",
      'footer.about': "About", 'footer.eco': "Ecosystem", 'footer.os': "MWINDA OS", 'footer.impact': "Impact",
      'footer.careers': "Careers", 'footer.press': "Press",
      'footer.legal1': "Legal Notice", 'footer.legal2': "Privacy",
      'footer.legal3': "Cookies", 'footer.legal4': "Terms",
      'footer.rights1': "©", 'footer.rights2': "MWINDA GROUP LLC. All rights reserved.",
      'footer.craft': 'Crafted with <span class="gold-text">light</span> &amp; precision.',
    }
  };

  function detectInitial() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && dict[stored]) return stored;
    const browser = (navigator.language || 'fr').slice(0, 2).toLowerCase();
    return dict[browser] ? browser : 'fr';
  }

  function apply(lang) {
    const d = dict[lang] || dict.fr;

    // <html lang>
    document.documentElement.setAttribute('lang', lang);

    // text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (!(key in d)) return;
      const value = d[key];

      // attribute target (e.g. meta description content)
      const attr = el.getAttribute('data-i18n-attr');
      if (attr) { el.setAttribute(attr, value); return; }

      if (el.hasAttribute('data-i18n-html')) el.innerHTML = value;
      else el.textContent = value;
    });

    // meta title (special case if title isn't tagged)
    if (d['meta.title']) document.title = d['meta.title'];

    // language toggle UI
    document.querySelectorAll('.lang-switch [data-lang]').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === lang);
    });

    localStorage.setItem(STORAGE_KEY, lang);
    window.MWINDA_LANG = lang;

    // dispatch event so other modules can react
    window.dispatchEvent(new CustomEvent('mwinda:lang', { detail: { lang } }));
  }

  function bind() {
    document.querySelectorAll('.lang-switch [data-lang]').forEach(btn => {
      btn.addEventListener('click', () => apply(btn.dataset.lang));
    });
  }

  function init() {
    bind();
    apply(detectInitial());
  }

  // Expose helpers
  window.i18n = {
    t: (key, vars) => {
      const lang = window.MWINDA_LANG || detectInitial();
      let s = (dict[lang] && dict[lang][key]) || (dict.fr[key] || key);
      if (vars) Object.keys(vars).forEach(k => { s = s.replace('{' + k + '}', vars[k]); });
      return s;
    },
    apply,
    current: () => window.MWINDA_LANG || detectInitial(),
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
