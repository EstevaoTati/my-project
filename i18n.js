/* ============================================================
   MWINDA DIGITAL — i18n (FR / EN)
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
      'meta.title': "MWINDA DIGITAL — Bringing Light to Your Ideas",
      'meta.desc' : "MWINDA DIGITAL — écosystème du digital et de l'innovation technologique : systèmes agentiques IA, automatisation, formations IA et incubation digitale.",

      'nav.home': "Accueil",
      'nav.about': "À propos",
      'nav.divisions': "Pôles",
      'nav.ecosystem': "Écosystème",
      'nav.impact': "Impact",
      'nav.contact': "Contact",
      'nav.os': "MWINDA OS",
      'nav.cta': "Démarrer un projet",

      'hero.tag': "Écosystème digital & intelligence artificielle",
      'hero.t1': "Bringing", 'hero.t2': "Light", 'hero.t3': "to Your", 'hero.t4': "Ideas",
      'hero.sub': "MWINDA DIGITAL conçoit des systèmes agentiques, des automatisations et des solutions IA qui transforment les idées en produits digitaux de classe mondiale.",
      'hero.cta1': "Découvrir nos pôles",
      'hero.cta2': "Nous contacter",
      'hero.m1': "Pôles d'expertise",
      'hero.m2': "Vision intégrée",
      'hero.m3': "Possibilités",
      'hero.scroll': "Scroll",

      'about.eyebrow': "À propos",
      'about.title': 'Un <em>écosystème</em> intégré, <br/>une <span class="gold-text">vision</span> commune',
      'about.lead': "MWINDA DIGITAL est un <strong>écosystème du monde digital et de l'innovation technologique</strong> — dédié à la promotion des NTIC, à l'intelligence artificielle et au déploiement de systèmes agentiques qui travaillent pour vous.",
      'about.p2': "Notre conviction est simple : <em>l'IA n'est plus un outil, c'est une force de travail</em>. Nous concevons, formons et déployons des intelligences qui exécutent, automatisent et font croître votre organisation — de l'idée à la production.",
      'about.p1.t': "Innovation",
      'about.p1.d': "Technologies émergentes et IA au service de l'humain.",
      'about.p2.t': "Intelligence",
      'about.p2.d': "L'IA agentique au cœur de chaque produit, de la stratégie à l'exécution.",
      'about.p3.t': "Excellence",
      'about.p3.d': "Exigence d'exécution sur chacune de nos verticales.",

      'div.eyebrow': "Nos pôles",
      'div.title': 'Cinq expertises, <span class="gold-text">une seule</span> lumière',
      'div.sub': "Cinq pôles 100% digital et IA, connectés par une même exigence et une même mission : transformer vos idées en systèmes qui travaillent.",

      'd1.name': 'Systèmes <span>Agentiques IA</span>',
      'd1.tag': "Entreprise · B2C",
      'd1.desc': "Des agents IA autonomes qui travaillent pour votre entreprise et vos clients : opérateurs, assistants et copilotes déployés en production, disponibles 24/7.",
      'd1.l1': "Agents d'entreprise", 'd1.l2': "Assistants B2C", 'd1.l3': "Orchestration multi-agents",

      'd2.name': "L'<span>Automatisation</span>",
      'd2.tag': "Workflows · Intégrations",
      'd2.desc': "Vos processus répétitifs, exécutés par des machines : workflows intelligents, intégrations et opérations qui tournent sans erreur pendant que vous créez de la valeur.",
      'd2.l1': "Automatisation de processus", 'd2.l2': "Intégrations API & SaaS", 'd2.l3': "Workflows pilotés par l'IA",

      'd3.name': 'Formations <span>IA</span>',
      'd3.tag': "Talents · Upskilling",
      'd3.desc': "Nous transformons vos équipes en praticiens de l'IA : ateliers pratiques, programmes sur mesure et accompagnement des dirigeants vers les compétences de demain.",
      'd3.l1': "Ateliers pratiques", 'd3.l2': "Programmes entreprise", 'd3.l3': "Coaching dirigeants",

      'd4.name': 'Incubation <span>Digitale</span>',
      'd4.tag': "Startups · Produits",
      'd4.desc': "De l'idée au lancement : nous incubons des produits digitaux avec architecture, design et go-to-market — l'IA comme accélérateur à chaque étape.",
      'd4.l1': "MVP & prototypage", 'd4.l2': "Architecture produit", 'd4.l3': "Go-to-market",

      'd5.name': 'Intelligence <span>Artificielle</span>',
      'd5.tag': "Conseil · R&D · Déploiement",
      'd5.desc': "Stratégie IA de bout en bout : choix des modèles, RAG et données, évaluation, gouvernance et mise en production à coût maîtrisé.",
      'd5.l1': "Stratégie & audit IA", 'd5.l2': "RAG & données", 'd5.l3': "Déploiement & MLOps",

      'eco.eyebrow': "L'écosystème",
      'eco.title': 'Tout est <span class="gold-text">connecté</span>.',
      'eco.sub': "Cinq pôles, une orchestration. Survolez le centre pour voir comment l'intelligence circule dans l'écosystème.",

      'impact.eyebrow': "Impact",
      'impact.title': 'Notre <span class="gold-text">empreinte</span> en chiffres',
      'impact.s1': "Pôles d'expertise",
      'impact.s2': "Projets accompagnés",
      'impact.s3': "Agents & automatisations déployés",
      'impact.s4': "Heures de travail automatisées",
      'impact.quote': "Notre vision : un écosystème où l'intelligence artificielle éclaire chaque idée — et où chaque idée devient un système qui travaille.",
      'impact.author': "— MWINDA DIGITAL",

      'contact.eyebrow': "Contact",
      'contact.title': 'Donnons <span class="gold-text">vie</span> <br/>à votre prochaine idée.',
      'contact.desc': "Que vous soyez une organisation, un entrepreneur ou une institution, nos équipes sont prêtes à concevoir avec vous une solution sur mesure.",
      'contact.email': "Email",
      'contact.phone': "Téléphone",
      'contact.hq': "Siège",
      'contact.hqv': "MWINDA DIGITAL — USA",

      'form.name': "Nom complet",
      'form.email': "Adresse email",
      'form.topic': "Pôle concerné",
      'form.message': "Votre message",
      'form.submit': "Envoyer le message",
      'form.other': "Autre / Partenariat",
      'form.err.empty': "Merci de remplir tous les champs.",
      'form.err.email': "Adresse email invalide.",
      'form.ok': "Merci {name} — WhatsApp s'ouvre avec votre message prêt à envoyer.",

      'footer.tagline': "Bringing Light to Your Ideas. L'écosystème digital & IA qui transforme les idées en systèmes qui travaillent.",
      'footer.h1': "Pôles", 'footer.h2': "Groupe", 'footer.h3': "Légal",
      'footer.about': "À propos", 'footer.eco': "Écosystème", 'footer.os': "MWINDA OS", 'footer.impact': "Impact",
      'footer.careers': "Carrières", 'footer.press': "Presse",
      'footer.legal1': "Mentions légales", 'footer.legal2': "Confidentialité",
      'footer.legal3': "Cookies", 'footer.legal4': "CGU",
      'footer.rights1': "©", 'footer.rights2': "MWINDA DIGITAL. Tous droits réservés.",
      'footer.craft': 'Crafted with <span class="gold-text">light</span> &amp; precision.',
    },

    en: {
      'meta.title': "MWINDA DIGITAL — Bringing Light to Your Ideas",
      'meta.desc' : "MWINDA DIGITAL — an ecosystem of the digital world and technological innovation: agentic AI systems, automation, AI training and digital incubation.",

      'nav.home': "Home",
      'nav.about': "About",
      'nav.divisions': "Divisions",
      'nav.ecosystem': "Ecosystem",
      'nav.impact': "Impact",
      'nav.contact': "Contact",
      'nav.os': "MWINDA OS",
      'nav.cta': "Start a project",

      'hero.tag': "Digital & artificial intelligence ecosystem",
      'hero.t1': "Bringing", 'hero.t2': "Light", 'hero.t3': "to Your", 'hero.t4': "Ideas",
      'hero.sub': "MWINDA DIGITAL designs agentic systems, automations and AI solutions that turn ideas into world-class digital products.",
      'hero.cta1': "Discover our divisions",
      'hero.cta2': "Get in touch",
      'hero.m1': "Expertise poles",
      'hero.m2': "Integrated vision",
      'hero.m3': "Possibilities",
      'hero.scroll': "Scroll",

      'about.eyebrow': "About",
      'about.title': 'An integrated <em>ecosystem</em>, <br/>one shared <span class="gold-text">vision</span>',
      'about.lead': "MWINDA DIGITAL is an <strong>ecosystem of the digital world and technological innovation</strong> — dedicated to advancing ICT, artificial intelligence and the deployment of agentic systems that work for you.",
      'about.p2': "Our conviction is simple: <em>AI is no longer a tool, it is a workforce</em>. We design, train and deploy intelligences that execute, automate and grow your organization — from idea to production.",
      'about.p1.t': "Innovation",
      'about.p1.d': "Emerging technologies and AI in service of people.",
      'about.p2.t': "Intelligence",
      'about.p2.d': "Agentic AI at the heart of every product, from strategy to execution.",
      'about.p3.t': "Excellence",
      'about.p3.d': "Uncompromising execution across every vertical.",

      'div.eyebrow': "Our divisions",
      'div.title': 'Five expertises, <span class="gold-text">one</span> light',
      'div.sub': "Five poles, 100% digital and AI, connected by the same standard and the same mission: turning your ideas into systems that work.",

      'd1.name': 'Agentic AI <span>Systems</span>',
      'd1.tag': "Enterprise · B2C",
      'd1.desc': "Autonomous AI agents working for your business and your customers: operators, assistants and copilots deployed in production, available 24/7.",
      'd1.l1': "Enterprise agents", 'd1.l2': "B2C assistants", 'd1.l3': "Multi-agent orchestration",

      'd2.name': '<span>Automation</span>',
      'd2.tag': "Workflows · Integrations",
      'd2.desc': "Your repetitive processes, executed by machines: intelligent workflows, integrations and operations running error-free while you create value.",
      'd2.l1': "Process automation", 'd2.l2': "API & SaaS integrations", 'd2.l3': "AI-driven workflows",

      'd3.name': 'AI <span>Training</span>',
      'd3.tag': "Talent · Upskilling",
      'd3.desc': "We turn your teams into AI practitioners: hands-on workshops, tailored programs and executive coaching toward the skills of tomorrow.",
      'd3.l1': "Hands-on workshops", 'd3.l2': "Company programs", 'd3.l3': "Executive coaching",

      'd4.name': 'Digital <span>Incubation</span>',
      'd4.tag': "Startups · Products",
      'd4.desc': "From idea to launch: we incubate digital products with architecture, design and go-to-market — AI as the accelerator at every step.",
      'd4.l1': "MVP & prototyping", 'd4.l2': "Product architecture", 'd4.l3': "Go-to-market",

      'd5.name': 'Artificial <span>Intelligence</span>',
      'd5.tag': "Consulting · R&D · Deployment",
      'd5.desc': "End-to-end AI strategy: model selection, RAG and data, evaluation, governance and cost-controlled production deployment.",
      'd5.l1': "AI strategy & audit", 'd5.l2': "RAG & data", 'd5.l3': "Deployment & MLOps",

      'eco.eyebrow': "The ecosystem",
      'eco.title': 'Everything is <span class="gold-text">connected</span>.',
      'eco.sub': "Five poles, one orchestration. Hover the center to see how intelligence flows through the ecosystem.",

      'impact.eyebrow': "Impact",
      'impact.title': 'Our <span class="gold-text">footprint</span> in numbers',
      'impact.s1': "Expertise poles",
      'impact.s2': "Projects supported",
      'impact.s3': "Agents & automations deployed",
      'impact.s4': "Working hours automated",
      'impact.quote': "Our vision: an ecosystem where artificial intelligence lights up every idea — and every idea becomes a system that works.",
      'impact.author': "— MWINDA DIGITAL",

      'contact.eyebrow': "Contact",
      'contact.title': 'Let\'s bring <span class="gold-text">life</span> <br/>to your next idea.',
      'contact.desc': "Whether you are an organization, an entrepreneur or an institution, our teams are ready to design a tailored solution with you.",
      'contact.email': "Email",
      'contact.phone': "Phone",
      'contact.hq': "Headquarters",
      'contact.hqv': "MWINDA DIGITAL — USA",

      'form.name': "Full name",
      'form.email': "Email address",
      'form.topic': "Division",
      'form.message': "Your message",
      'form.submit': "Send message",
      'form.other': "Other / Partnership",
      'form.err.empty': "Please fill in all fields.",
      'form.err.email': "Invalid email address.",
      'form.ok': "Thank you {name} — WhatsApp is opening with your message ready to send.",

      'footer.tagline': "Bringing Light to Your Ideas. The digital & AI ecosystem that turns ideas into systems that work.",
      'footer.h1': "Divisions", 'footer.h2': "Group", 'footer.h3': "Legal",
      'footer.about': "About", 'footer.eco': "Ecosystem", 'footer.os': "MWINDA OS", 'footer.impact': "Impact",
      'footer.careers': "Careers", 'footer.press': "Press",
      'footer.legal1': "Legal Notice", 'footer.legal2': "Privacy",
      'footer.legal3': "Cookies", 'footer.legal4': "Terms",
      'footer.rights1': "©", 'footer.rights2': "MWINDA DIGITAL. All rights reserved.",
      'footer.craft': 'Crafted with <span class="gold-text">light</span> &amp; precision.',
    }
  };

  function detectInitial() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && dict[stored]) return stored;
    // Default to English unless the visitor explicitly chose a language.
    return 'en';
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
