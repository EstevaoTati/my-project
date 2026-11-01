/*
 * LES ÉLITES PUBLISHING HOUSE — editorial data, single source of truth.
 *
 * Read by the browser (window.LE_DATA) AND by scripts/build-pages.mjs, which
 * writes one indexable static page per book and per author.
 *
 * SOURCE: the house's own live site (leselitespublishinghouse.com), crawled
 * 2026-11-01 into docs/source-site/ — titles, FR/EN descriptions, genres,
 * languages, purchase links, contact details and services are copied from
 * it verbatim. The official covers supplied by the founder complete it.
 * RULE: nothing invented. Unknown = null, and the UI hides it.
 */
(function (root) {
  const DATA = {
    site: {
      name: 'LES ÉLITES PUBLISHING HOUSE',
      origin: 'https://leselitespublishinghouse.com',
      founded: 2025,
      contact: {
        email: 'estevaomacumba@gmail.com',
        phone: '+1 706 572 5957',
        phoneHref: 'tel:+17065725957',
        address: 'Seattle, WA, USA',
        mapHref: 'https://maps.google.com/?q=Seattle,WA,USA',
      },
      // The live site shows FB/IG/LI/YT icons pointing to "#": no real URL is
      // known, so none is rendered here. Add { label, url } when confirmed.
      socials: [],
      replyDays: 5, // "Notre équipe vous répondra dans les 5 jours ouvrables."
    },

    collections: [
      { id: 'foi', fr: 'Foi & Inspiration', en: 'Faith & Inspiration' },
      { id: 'leadership', fr: 'Leadership & Affaires', en: 'Leadership & Business' },
      { id: 'technologie', fr: 'Foi & Technologie', en: 'Faith & Technology' },
      { id: 'developpement', fr: 'Développement Personnel', en: 'Personal Development' },
      { id: 'science', fr: 'Science en Langues Africaines', en: 'Science in African Languages' },
    ],

    authors: [
      { id: 'lessa-annette-kuedituka', name: 'Lessa Annette Kuedituka', photo: 'assets/books/called-to-stand-launch.jpg',
        photoAlt: { fr: 'Affiche de lancement avec l’autrice Lessa Annette Kuedituka', en: 'Launch poster featuring author Lessa Annette Kuedituka' }, bio: null, links: [] },
      { id: 'stephane-taty', name: 'Stephane Taty', photo: null, bio: null, links: [] },
      { id: 'syntiche-ndeo-okamba', name: 'Syntiche Ndeo Okamba', photo: null, bio: null, links: [] },
      { id: 'les-elites', name: 'LES ÉLITES Publishing House', house: true, photo: 'assets/brand/emblem-gold.png', bio: null, links: [] },
    ],

    books: [
      {
        id: 'called-to-stand-beside-him',
        author: 'lessa-annette-kuedituka',
        fr: { title: 'Appelée à Rester à Ses Côtés : Le Voyage d’une Femme de Pasteur', desc: 'Un témoignage puissant de foi, de résilience et de partenariat. Ce parcours inspirant explore l’appel unique d’une femme de pasteur et la grâce qui la soutient à chaque saison.' },
        en: { title: 'Called to Stand Beside Him: The Journey of a Pastor’s Wife', desc: 'A powerful testament to faith, resilience, and partnership. This inspiring journey explores the unique calling of a pastor’s wife and the grace that sustains her through every season.' },
        // Printed on the official launch poster.
        quote: 'Recognize God’s sovereignty in your own journey and how He prepared you for this role.',
        collections: ['foi'],
        languages: ['English', 'French'],
        cover: 'assets/books/called-to-stand-beside-him.jpg',
        gallery: ['assets/books/called-to-stand-launch.jpg'],
        imprint: true, featured: true, status: 'new',
        buy: { label: 'Amazon', url: 'https://a.co/d/0h9yuEtI' },
        spine: '#5a1420',
      },
      {
        id: 'chretiente-ere-intelligence-artificielle',
        author: 'stephane-taty',
        fr: { title: 'Le Christianisme à l’Ère de l’Intelligence Artificielle', desc: 'Une exploration audacieuse de la rencontre entre la foi chrétienne et l’intelligence artificielle — un appel aux croyants à s’engager, discerner et diriger à l’ère numérique.',
              statement: 'Publier ce livre n’est pas un hasard. C’est une déclaration : l’Église ne doit pas subir l’avenir, elle doit le comprendre et y prendre part. LES ÉLITES croit que les chrétiens doivent être parmi les penseurs, les bâtisseurs et les gardiens éthiques des nouvelles puissances.' },
        en: { title: 'Christianity in the Age of Artificial Intelligence', desc: 'A bold exploration of how Christian faith intersects with the rise of artificial intelligence — a call for believers to engage, discern, and lead in the digital age.' },
        tags: { fr: ['Intelligence Artificielle', 'Foi Chrétienne', 'Éthique', 'Innovation'], en: ['Artificial Intelligence', 'Christian Faith', 'Ethics', 'Innovation'] },
        collections: ['technologie', 'foi'],
        languages: ['English', 'French'],
        cover: 'assets/books/chretiente-ere-ia.jpg',
        imprint: true, buy: null, spine: '#141a3a',
      },
      {
        id: 'biblical-business-entrepreneurship-model',
        author: 'stephane-taty',
        fr: { title: 'Modèle Biblique d’Entreprise et d’Entrepreneuriat', desc: 'Un cadre transformateur pour bâtir des entreprises fondées sur les principes bibliques — alliant foi, stratégie et excellence entrepreneuriale.' },
        en: { title: 'Biblical Business and Entrepreneurship Model', desc: 'A transformative framework for building businesses grounded in biblical principles — combining faith, strategy, and entrepreneurial excellence.' },
        collections: ['leadership', 'foi'],
        languages: ['English', 'French'],
        cover: 'assets/books/biblical-business-model.jpg',
        imprint: false, buy: null, spine: '#163a5f',
      },
      {
        // On the founder's cover sheet, not yet on the live site.
        id: 'biblical-politics-leadership-principles',
        author: 'stephane-taty',
        fr: { title: 'Biblical Politics and Leadership Principles', desc: null },
        en: { title: 'Biblical Politics and Leadership Principles', desc: null },
        collections: ['leadership'],
        languages: ['English'],
        cover: 'assets/books/biblical-politics-leadership.jpg',
        imprint: false, buy: null, spine: '#9c1c18',
      },
      {
        id: 'les-types-des-personnes-qu-on-rencontre',
        author: 'syntiche-ndeo-okamba',
        fr: { title: 'Les Types des Personnes qu’on Rencontre', desc: 'Un guide inspirant pour comprendre les différentes personnalités que nous rencontrons dans la vie, et naviguer les relations avec sagesse et grâce.' },
        en: { title: 'Les Types des Personnes qu’on Rencontre', desc: 'An inspiring guide to understanding the different personalities we encounter in life, and how to navigate relationships with wisdom and grace.' },
        kicker: 'Livre inspirant',
        collections: ['developpement'],
        languages: ['French'],
        cover: 'assets/books/types-des-personnes.jpg',
        imprint: false, buy: null, spine: '#2a2523',
      },
      {
        id: 'livres-de-sciences-en-langues-africaines',
        author: 'les-elites',
        fr: { title: 'Livres de Sciences en Langues Africaines', desc: 'Éducation scientifique complète en Mathématiques, Biologie, Chimie, Physique et Ingénierie disponible en Lingala, Swahili, Kikongo, Zulu, Wolof et Yoruba.' },
        en: { title: 'Science Books in African Languages', desc: 'Comprehensive science education in Mathematics, Biology, Chemistry, Physics, and Engineering available in Lingala, Swahili, Kikongo, Zulu, Wolof, and Yoruba.' },
        collections: ['science'],
        languages: ['Lingala', 'Swahili', 'Kikongo', 'Zulu', 'Wolof', 'Yoruba'],
        cover: 'assets/collections/science-vivid.jpg', poster: true,
        imprint: true, buy: null, spine: '#7a1f4a',
      },
      {
        id: 'apprendre-les-sciences-dans-votre-langue',
        author: 'les-elites',
        fr: { title: 'Apprendre les Sciences dans Votre Langue', desc: 'Découvrez la science dans votre langue maternelle. Mathématiques, Biologie, Chimie, Physique et Ingénierie rendus accessibles en langues africaines.' },
        en: { title: 'Learn Science in Your Language', desc: 'Discover science through your native language. Mathematics, Biology, Chemistry, Physics, and Engineering made accessible in African languages.' },
        collections: ['science'],
        languages: ['Lingala', 'Swahili', 'Kikongo', 'Zulu', 'Wolof', 'Yoruba'],
        cover: 'assets/collections/science-kids.jpg', poster: true,
        imprint: true, buy: null, spine: '#3a6a8a',
      },
      {
        id: 'decouvrir-la-science-en-langues-africaines',
        author: 'les-elites',
        fr: { title: 'Découvrir la Science : Livres Disponibles en Langues Africaines', desc: 'Ressources éducatives scientifiques premium couvrant Mathématiques, Biologie, Chimie, Physique et Ingénierie en Lingala, Swahili, Kikongo, Zulu, Wolof et Yoruba.' },
        en: { title: 'Discover Science: Books Available in African Languages', desc: 'Premium science education resources covering Mathematics, Biology, Chemistry, Physics, and Engineering in Lingala, Swahili, Kikongo, Zulu, Wolof, and Yoruba.' },
        collections: ['science'],
        languages: ['Lingala', 'Swahili', 'Kikongo', 'Zulu', 'Wolof', 'Yoruba'],
        cover: 'assets/collections/science-classroom.jpg', poster: true,
        imprint: true, buy: null, spine: '#2c5a3a',
      },
    ],

    // From the live site's "Nos Services" section — all offered by the house.
    services: [
      { id: 'accompagnement', icon: 'quill', fr: ['Accompagnement Éditorial', 'Un suivi personnalisé de votre premier jet au manuscrit final. Nos éditeurs travaillent avec vous pour faire émerger le meilleur de votre voix.'], en: ['Editorial Mentoring', 'Personalized support from your first draft to the final manuscript. Our editors work with you to bring out the best of your voice.'] },
      { id: 'evaluation', icon: 'lens', fr: ['Évaluation de Manuscrit', 'Une analyse rigoureuse et constructive de votre manuscrit. Nous identifions les forces, les axes d’amélioration et le potentiel éditorial.'], en: ['Manuscript Evaluation', 'Rigorous and constructive analysis of your manuscript. We identify strengths, areas for improvement, and publishing potential.'] },
      { id: 'correction', icon: 'check', fr: ['Correction Professionnelle', 'Relecture et correction approfondie de votre texte : orthographe, grammaire, syntaxe et cohérence stylistique.'], en: ['Professional Proofreading', 'Thorough proofreading and correction of your text: spelling, grammar, syntax, and stylistic consistency.'] },
      { id: 'couverture', icon: 'frame', fr: ['Conception de Couverture', 'Création d’une couverture professionnelle qui capte l’essence de votre œuvre et attire votre lectorat cible.'], en: ['Cover Design', 'Creation of a professional cover that captures the essence of your work and attracts your target readership.'] },
      { id: 'mise-en-page', icon: 'grid', fr: ['Mise en Page Intérieure', 'Mise en page typographique professionnelle de votre livre pour les formats imprimé et numérique (PDF, ePub, Kindle).'], en: ['Interior Layout', 'Professional typographic layout of your book for print and digital formats (PDF, ePub, Kindle).'] },
      { id: 'isbn', icon: 'seal', fr: ['ISBN & Dépôt Légal', 'Gestion complète des formalités administratives : enregistrement ISBN, dépôt légal, protection des droits d’auteur.'], en: ['ISBN & Legal Deposit', 'Complete management of administrative formalities: ISBN registration, legal deposit, copyright protection.'] },
      { id: 'impression', icon: 'press', fr: ['Impression & Numérique', 'Impression de qualité et distribution en formats numériques. Votre livre disponible en librairie et sur les grandes plateformes.'], en: ['Print & Digital', 'High-quality printing and distribution in digital formats. Your book available in bookstores and on major platforms.'] },
      { id: 'distribution', icon: 'globe', fr: ['Distribution Internationale', 'Accès à notre réseau de distributeurs dans 12+ pays en Afrique, Europe et Amérique du Nord.'], en: ['International Distribution', 'Access to our network of distributors in 12+ countries in Africa, Europe, and North America.'] },
      { id: 'promotion', icon: 'spark', fr: ['Marketing & Promotion', 'Stratégie de communication sur mesure : réseaux sociaux, communiqués de presse, événements de lancement et promotion de l’auteur.'], en: ['Marketing & Promotion', 'Tailored communication strategy: social media, press releases, launch events, and author promotion.'] },
    ],
  };

  DATA.authorById = (id) => DATA.authors.find((a) => a.id === id) || null;
  DATA.booksBy = (authorId) => DATA.books.filter((b) => b.author === authorId);
  DATA.collectionById = (id) => DATA.collections.find((c) => c.id === id) || null;
  DATA.t = (b, lang) => b[lang] && b[lang].title ? b[lang] : b.fr;

  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.LE_DATA = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
