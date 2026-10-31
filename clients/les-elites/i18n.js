/*
 * FR/EN for LES ÉLITES. French is the source language written in the markup;
 * every key lives in BOTH dictionaries.
 *   data-i18n="key"                      → textContent
 *   data-i18n-html                       → innerHTML (string carries <em>/<br>)
 *   data-i18n-attr="placeholder|content|aria-label" → that attribute instead
 * API: window.i18n.t(key, vars), .apply(lang), .current(); fires `le:lang`.
 */
(function () {
  const dict = {
    fr: {
      'meta.title': 'LES ÉLITES PUBLISHING HOUSE — La Maison du Savoir',
      'meta.desc': 'Maison d’édition dédiée à l’excellence intellectuelle et à la transmission du savoir. Publications, auteurs, soumission de manuscrits.',
      'skip': 'Aller au contenu',
      'nav.home': 'Accueil', 'nav.house': 'Notre Maison', 'nav.books': 'Publications', 'nav.authors': 'Auteurs',
      'nav.services': 'Services', 'nav.submit': 'Soumettre un manuscrit', 'nav.contact': 'Contact',
      'nav.publish': 'Publier mon livre', 'nav.menu': 'Menu', 'nav.close': 'Fermer',
      'ui.skipExp': 'Passer l’expérience', 'ui.resumeExp': 'Revenir à l’expérience',
      'ui.motionOff': 'Réduire les animations', 'ui.motionOn': 'Rétablir les animations',
      'ui.progress': 'Progression dans la Maison',
      'sc1': 'Le Parvis des Idées', 'sc2': 'Le Hall de l’Excellence', 'sc3': 'La Grande Bibliothèque', 'sc4': 'L’Atelier des Auteurs', 'sc5': 'L’Observatoire des Générations',

      'hero.kicker': 'House of Editorial Excellence',
      'hero.lead': 'Une maison d’édition dédiée à l’excellence intellectuelle et à la transmission du savoir.',
      'hero.cta1': 'Découvrir notre univers', 'hero.cta2': 'Explorer nos livres',
      'hero.scroll': 'Faites défiler pour entrer',

      'hall.kicker': 'Le Hall de l’Excellence',
      'hall.title': 'Ici, les idées <em>prennent forme</em>.',
      'hall.body': 'LES ÉLITES n’est pas seulement une maison d’édition. C’est un espace où les idées prennent forme, où les livres transmettent le savoir et où les générations rencontrent la connaissance.',
      'hall.axes': 'Nos axes éditoriaux',
      'ax.faith': 'Foi et réflexion contemporaine', 'ax.intel': 'Excellence intellectuelle', 'ax.tech': 'Science, éducation et technologie',
      'ax.lead': 'Leadership et entrepreneuriat', 'ax.wisdom': 'Sagesse et transformation',

      'lib.kicker': 'La Grande Bibliothèque',
      'lib.title': 'Chaque livre est une <em>découverte</em>.',
      'lib.body': 'Sélectionnez un ouvrage sur les rayonnages, ou ouvrez l’une des trois galeries.',
      'lib.poi1': 'Nos publications', 'lib.poi2': 'Nos auteurs', 'lib.poi3': 'Nos collections',
      'lib.all': 'Voir tout le catalogue',

      'lab.kicker': 'L’Atelier des Auteurs',
      'lab.title': 'De l’idée à l’œuvre <em>publiée</em>.',
      'lab.s1': 'Une idée', 'lab.s2': 'Un manuscrit', 'lab.s3': 'Une œuvre', 'lab.s4': 'Une publication',
      'lab.services': 'Ce que nous faisons',
      'lab.servicesMore': 'Le détail de nos prestations éditoriales est communiqué sur demande.',
      'lab.ask': 'Vous avez écrit un livre ?',
      'lab.askBody': 'Donnons à votre manuscrit les moyens de devenir une publication.',
      'lab.submit': 'Soumettre mon manuscrit', 'lab.discover': 'Nous écrire',
      'lab.note': 'Séquence illustrative du processus éditorial — pas une réalisation client.',
      'lab.desk': 'Ouvrir le manuscrit',

      'obs.kicker': 'L’Observatoire des Générations',
      'obs.l1': 'Les grandes idées méritent d’être transmises.',
      'obs.l2': 'Les manuscrits méritent d’être accompagnés.',
      'obs.l3': 'Les générations méritent d’accéder à des œuvres qui nourrissent la pensée.',
      'obs.cta1': 'Publier mon livre', 'obs.cta2': 'Découvrir le catalogue', 'obs.cta3': 'Contacter notre équipe',

      'contact.title': 'Contacter notre équipe',
      'f.name': 'Nom complet', 'f.email': 'Adresse email', 'f.phone': 'Téléphone (facultatif)', 'f.country': 'Pays',
      'f.subject': 'Objet', 'f.message': 'Message', 'f.send': 'Envoyer',
      'f.consent': 'J’accepte que mes données soient utilisées pour traiter ma demande, conformément à la politique de confidentialité.',
      'f.sending': 'Envoi en cours…', 'f.ok': 'Merci. Votre message a bien été reçu. Référence : {ref}',
      'f.err': 'L’envoi a échoué. Merci de réessayer dans un instant.',
      'f.off': 'Le formulaire n’est pas encore activé sur ce site. Il le sera très bientôt.',
      'f.req': 'Champ requis',

      'm.title': 'Soumettre un manuscrit',
      'm.lead': 'Présentez-nous votre projet. Votre fichier est stocké de façon privée et n’est consulté que par l’équipe éditoriale.',
      'm.mtitle': 'Titre du manuscrit', 'm.genre': 'Genre', 'm.lang': 'Langue du manuscrit', 'm.summary': 'Résumé du projet',
      'm.length': 'Nombre de mots ou de pages', 'm.file': 'Fichier du manuscrit (PDF, DOCX, DOC, ODT, RTF — 20 Mo max.)',
      'm.more': 'Message complémentaire', 'm.send': 'Envoyer mon manuscrit',
      'm.ok': 'Manuscrit reçu. Conservez votre référence : {ref}. Statut : REÇU.',
      'm.statusTitle': 'Les étapes de votre soumission',
      'st.received': 'Reçu', 'st.review': 'En évaluation', 'st.info': 'Informations complémentaires', 'st.decision': 'Décision communiquée',
      'm.delay': 'Chaque manuscrit est lu par l’équipe. Nous ne communiquons pas de délai avant d’avoir pris connaissance du projet.',

      'b.by': 'par', 'b.lang': 'Langue', 'b.format': 'Format', 'b.coll': 'Collections', 'b.avail': 'Disponibilité',
      'b.onRequest': 'Sur demande', 'b.request': 'Demander ce livre', 'b.buy': 'Acheter', 'b.details': 'Fiche complète',
      'b.new': 'Nouveauté', 'b.imprint': 'Publié par Les Élites',
      'fmt.hardcover': 'Relié', 'fmt.paperback': 'Broché', 'fmt.ebook': 'Numérique',
      'lang.fr': 'Français', 'lang.en': 'Anglais',
      'a.books': 'Publications', 'a.bioSoon': 'Biographie à venir.',
      's.langs': 'Langues', 's.subjects': 'Disciplines', 's.avail': 'Titres et disponibilité par langue : sur demande.',

      'cat.title': 'Catalogue', 'cat.lead': 'Toutes les publications de la maison.', 'cat.search': 'Rechercher un titre ou un auteur',
      'cat.allColl': 'Toutes les collections', 'cat.allLang': 'Toutes les langues', 'cat.none': 'Aucun livre ne correspond à votre recherche.',
      'cat.count': '{n} publication(s)', 'cat.series': 'Programme éditorial',

      'foot.rights': 'Tous droits réservés.', 'foot.privacy': 'Confidentialité', 'foot.classic': 'Version classique',
      'dlg.close': 'Fermer',
    },
    en: {
      'meta.title': 'LES ÉLITES PUBLISHING HOUSE — The House of Knowledge',
      'meta.desc': 'A publishing house devoted to intellectual excellence and the transmission of knowledge. Books, authors, manuscript submissions.',
      'skip': 'Skip to content',
      'nav.home': 'Home', 'nav.house': 'Our House', 'nav.books': 'Books', 'nav.authors': 'Authors',
      'nav.services': 'Services', 'nav.submit': 'Submit a manuscript', 'nav.contact': 'Contact',
      'nav.publish': 'Publish my book', 'nav.menu': 'Menu', 'nav.close': 'Close',
      'ui.skipExp': 'Skip the experience', 'ui.resumeExp': 'Back to the experience',
      'ui.motionOff': 'Reduce motion', 'ui.motionOn': 'Restore motion',
      'ui.progress': 'Progress through the House',
      'sc1': 'The Forecourt of Ideas', 'sc2': 'The Hall of Excellence', 'sc3': 'The Grand Library', 'sc4': 'The Authors’ Workshop', 'sc5': 'The Observatory of Generations',

      'hero.kicker': 'House of Editorial Excellence',
      'hero.lead': 'A publishing house devoted to intellectual excellence and the transmission of knowledge.',
      'hero.cta1': 'Discover our world', 'hero.cta2': 'Explore our books',
      'hero.scroll': 'Scroll to enter',

      'hall.kicker': 'The Hall of Excellence',
      'hall.title': 'Here, ideas <em>take shape</em>.',
      'hall.body': 'LES ÉLITES is more than a publishing house. It is a place where ideas take shape, where books carry knowledge, and where generations meet it.',
      'hall.axes': 'Our editorial lines',
      'ax.faith': 'Faith and contemporary thought', 'ax.intel': 'Intellectual excellence', 'ax.tech': 'Science, education and technology',
      'ax.lead': 'Leadership and entrepreneurship', 'ax.wisdom': 'Wisdom and transformation',

      'lib.kicker': 'The Grand Library',
      'lib.title': 'Every book is a <em>discovery</em>.',
      'lib.body': 'Pick a book from the shelves, or open one of the three galleries.',
      'lib.poi1': 'Our books', 'lib.poi2': 'Our authors', 'lib.poi3': 'Our collections',
      'lib.all': 'See the full catalogue',

      'lab.kicker': 'The Authors’ Workshop',
      'lab.title': 'From idea to <em>published</em> work.',
      'lab.s1': 'An idea', 'lab.s2': 'A manuscript', 'lab.s3': 'A work', 'lab.s4': 'A publication',
      'lab.services': 'What we do',
      'lab.servicesMore': 'Details of our editorial services are available on request.',
      'lab.ask': 'Have you written a book?',
      'lab.askBody': 'Let us give your manuscript what it needs to become a publication.',
      'lab.submit': 'Submit my manuscript', 'lab.discover': 'Write to us',
      'lab.note': 'Illustrative sequence of the editorial process — not a client project.',
      'lab.desk': 'Open the manuscript',

      'obs.kicker': 'The Observatory of Generations',
      'obs.l1': 'Great ideas deserve to be passed on.',
      'obs.l2': 'Manuscripts deserve to be supported.',
      'obs.l3': 'Generations deserve works that nourish thought.',
      'obs.cta1': 'Publish my book', 'obs.cta2': 'Browse the catalogue', 'obs.cta3': 'Contact our team',

      'contact.title': 'Contact our team',
      'f.name': 'Full name', 'f.email': 'Email address', 'f.phone': 'Phone (optional)', 'f.country': 'Country',
      'f.subject': 'Subject', 'f.message': 'Message', 'f.send': 'Send',
      'f.consent': 'I agree that my data is used to handle my request, in line with the privacy policy.',
      'f.sending': 'Sending…', 'f.ok': 'Thank you. Your message was received. Reference: {ref}',
      'f.err': 'Sending failed. Please try again in a moment.',
      'f.off': 'This form is not switched on yet. It will be very soon.',
      'f.req': 'Required',

      'm.title': 'Submit a manuscript',
      'm.lead': 'Tell us about your project. Your file is stored privately and read only by the editorial team.',
      'm.mtitle': 'Manuscript title', 'm.genre': 'Genre', 'm.lang': 'Manuscript language', 'm.summary': 'Project summary',
      'm.length': 'Word or page count', 'm.file': 'Manuscript file (PDF, DOCX, DOC, ODT, RTF — 20 MB max.)',
      'm.more': 'Additional message', 'm.send': 'Send my manuscript',
      'm.ok': 'Manuscript received. Keep your reference: {ref}. Status: RECEIVED.',
      'm.statusTitle': 'The stages of your submission',
      'st.received': 'Received', 'st.review': 'Under review', 'st.info': 'More information needed', 'st.decision': 'Decision sent',
      'm.delay': 'Every manuscript is read by the team. We do not quote a timeline before we have read the project.',

      'b.by': 'by', 'b.lang': 'Language', 'b.format': 'Format', 'b.coll': 'Collections', 'b.avail': 'Availability',
      'b.onRequest': 'On request', 'b.request': 'Request this book', 'b.buy': 'Buy', 'b.details': 'Full details',
      'b.new': 'New release', 'b.imprint': 'Published by Les Élites',
      'fmt.hardcover': 'Hardcover', 'fmt.paperback': 'Paperback', 'fmt.ebook': 'E-book',
      'lang.fr': 'French', 'lang.en': 'English',
      'a.books': 'Books', 'a.bioSoon': 'Biography coming soon.',
      's.langs': 'Languages', 's.subjects': 'Subjects', 's.avail': 'Titles and availability per language: on request.',

      'cat.title': 'Catalogue', 'cat.lead': 'Every book from the house.', 'cat.search': 'Search a title or an author',
      'cat.allColl': 'All collections', 'cat.allLang': 'All languages', 'cat.none': 'No book matches your search.',
      'cat.count': '{n} book(s)', 'cat.series': 'Editorial programme',

      'foot.rights': 'All rights reserved.', 'foot.privacy': 'Privacy', 'foot.classic': 'Classic version',
      'dlg.close': 'Close',
    },
  };

  const KEY = 'le.lang';
  let lang = 'fr';
  // French is the house's primary language: English only when chosen
  // (stored choice or ?lang=en), never inferred from the browser.
  try { lang = localStorage.getItem(KEY) || 'fr'; } catch (e) {}
  const q = new URLSearchParams(location.search).get('lang');
  if (q) lang = q;
  if (!dict[lang]) lang = 'fr';

  function t(key, vars) {
    let s = (dict[lang] && dict[lang][key]) ?? dict.fr[key] ?? key;
    if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
    return s;
  }

  function apply(next) {
    if (next && dict[next]) {
      lang = next;
      try { localStorage.setItem(KEY, lang); } catch (e) {}
    }
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const s = t(el.dataset.i18n);
      const attr = el.dataset.i18nAttr;
      if (attr) el.setAttribute(attr, s);
      else if (el.hasAttribute('data-i18n-html')) el.innerHTML = s;
      else el.textContent = s;
    });
    document.querySelectorAll('[data-lang-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.langBtn === lang)));
    document.dispatchEvent(new CustomEvent('le:lang', { detail: { lang } }));
  }

  window.i18n = { t, apply, current: () => lang };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang-btn]');
    if (b) apply(b.dataset.langBtn);
  });
  if (document.readyState !== 'loading') apply();
  else document.addEventListener('DOMContentLoaded', () => apply());
})();
