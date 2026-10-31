/*
 * LES ÉLITES PUBLISHING HOUSE — editorial data, single source of truth.
 *
 * Read by the browser (window.LE_DATA) AND by scripts/build-pages.mjs, which
 * writes one indexable static page per book and per author.
 *
 * RULE: nothing here may be invented. Every field below was read off an
 * official cover, the logo sheet or a launch poster supplied by the house.
 * Unknown facts are `null` and the UI hides them — it never fills the gap.
 *   - price / buy URL: null until the house confirms the sales channel.
 *   - description: only copy printed on the house's own material.
 *   - services: `confirmed: false` entries are NOT rendered (see services[]).
 * To publish a missing fact, fill the field here and re-run
 *   node scripts/build-pages.mjs
 */
(function (root) {
  const DATA = {
    site: {
      name: 'LES ÉLITES PUBLISHING HOUSE',
      // Canonical origin of the deployed site. Used for canonical/hreflang/
      // sitemap. Change once the production domain is pointed here.
      origin: 'https://leselitespublishinghouse.com',
      // Printed on the house banner.
      signature: 'House of Editorial Excellence',
      pillars: ['FAITH', 'INTELLIGENCE', 'TECHNOLOGY', 'IMPACT'],
      // From the creative brief.
      motto: 'SHAPE. ENLIGHTEN. TRANSFORM.',
      // Contact channels. null = not confirmed yet → the UI does not show it.
      contact: { email: null, whatsapp: null, phone: null, address: null },
      socials: [],
    },

    collections: [
      { id: 'foi', fr: 'Foi et spiritualité', en: 'Faith & spirituality' },
      { id: 'leadership', fr: 'Leadership et entrepreneuriat', en: 'Leadership & entrepreneurship' },
      { id: 'developpement', fr: 'Développement personnel', en: 'Personal growth' },
      { id: 'technologie', fr: 'Technologie et société', en: 'Technology & society' },
      { id: 'science', fr: 'Science dans nos langues', en: 'Science in our languages' },
    ],

    authors: [
      {
        id: 'stephane-taty',
        name: 'Stephane Taty',
        photo: null,
        bio: null, // to be supplied by the author
        links: [],
      },
      {
        id: 'lessa-annette-kuedituka',
        name: 'Lessa Annette Kuedituka',
        photo: 'assets/books/called-to-stand-launch.jpg',
        photoAlt: { fr: 'Affiche de lancement avec l’autrice Lessa Annette Kuedituka', en: 'Launch poster featuring author Lessa Annette Kuedituka' },
        bio: null,
        links: [],
      },
      {
        id: 'syntiche-ndeo-okamba',
        name: 'Syntiche Ndeo Okamba',
        photo: null,
        bio: null,
        links: [],
      },
    ],

    books: [
      {
        id: 'called-to-stand-beside-him',
        title: 'Called to Stand Beside Him',
        subtitle: 'The Journey of a Pastor’s Wife',
        author: 'lessa-annette-kuedituka',
        lang: 'en',
        collections: ['foi'],
        cover: 'assets/books/called-to-stand-beside-him.jpg',
        gallery: ['assets/books/called-to-stand-launch.jpg'],
        imprint: true, // Les Élites logo printed on the cover
        // Printed on the official launch poster.
        quote: 'Recognize God’s sovereignty in your own journey and how He prepared you for this role.',
        description: null,
        formats: ['hardcover'], // the launch poster shows hardcover copies
        price: null,
        buy: null,
        status: 'new', // "New book launch out" on the launch poster
        spine: '#5a1420',
      },
      {
        id: 'chretiente-ere-intelligence-artificielle',
        title: 'La Chrétienté à l’ère de l’Intelligence Artificielle',
        subtitle: null,
        author: 'stephane-taty',
        lang: 'fr',
        collections: ['foi', 'technologie'],
        cover: 'assets/books/chretiente-ere-ia.jpg',
        imprint: true, // "Edition Les Elites" printed on the cover
        quote: null,
        description: null,
        formats: [],
        price: null,
        buy: null,
        spine: '#141a3a',
      },
      {
        id: 'biblical-business-entrepreneurship-model',
        title: 'Biblical Business and Entrepreneurship Model',
        subtitle: null,
        author: 'stephane-taty',
        lang: 'en',
        collections: ['foi', 'leadership'],
        cover: 'assets/books/biblical-business-model.jpg',
        coverIsPhoto: true, // lifestyle photo — a flat official cover is still needed
        imprint: false,
        quote: null,
        description: null,
        formats: ['paperback'], // shown as a paperback in the photo
        price: null,
        buy: null,
        spine: '#163a5f',
      },
      {
        id: 'biblical-politics-leadership-principles',
        title: 'Biblical Politics and Leadership Principles',
        subtitle: null,
        author: 'stephane-taty',
        lang: 'en',
        collections: ['foi', 'leadership'],
        cover: 'assets/books/biblical-politics-leadership.jpg',
        imprint: false,
        quote: null,
        description: null,
        formats: [],
        price: null,
        buy: null,
        spine: '#9c1c18',
      },
      {
        id: 'les-types-des-personnes-qu-on-rencontre',
        title: 'Les Types des personnes qu’on rencontre',
        subtitle: null,
        author: 'syntiche-ndeo-okamba',
        lang: 'fr',
        collections: ['developpement'],
        cover: 'assets/books/types-des-personnes.jpg',
        imprint: false,
        quote: null,
        // Genre line printed on the cover.
        kicker: 'Livre inspirant',
        description: null,
        formats: [],
        price: null,
        buy: null,
        spine: '#2a2523',
      },
    ],

    // A programme, not a single title: the house's posters announce science
    // books in six African languages. Titles, levels and availability per
    // language are not confirmed — the UI says so instead of guessing.
    series: [
      {
        id: 'science-dans-nos-langues',
        collection: 'science',
        title: { fr: 'Science dans nos langues', en: 'Science in Our Languages' },
        subjects: { fr: ['Mathématiques', 'Biologie', 'Chimie', 'Physique', 'Ingénierie'], en: ['Mathematics', 'Biology', 'Chemistry', 'Physics', 'Engineering'] },
        languages: ['Lingala', 'Swahili', 'Kikongo', 'Zulu', 'Wolof', 'Yoruba'],
        visuals: [
          'assets/collections/science-gold.jpg',
          'assets/collections/science-classroom.jpg',
          'assets/collections/science-vivid.jpg',
          'assets/collections/science-kids.jpg',
        ],
      },
    ],

    // Editorial services. Only `confirmed: true` entries are rendered.
    // Flip an entry to true once the house confirms it actually sells it.
    services: [
      { id: 'publication', confirmed: true, fr: 'Publication sous la marque Les Élites', en: 'Publication under the Les Élites imprint' },
      { id: 'evaluation', confirmed: false, fr: 'Évaluation de manuscrit', en: 'Manuscript assessment' },
      { id: 'accompagnement', confirmed: false, fr: 'Accompagnement éditorial', en: 'Editorial coaching' },
      { id: 'correction', confirmed: false, fr: 'Correction et relecture', en: 'Copy-editing and proofreading' },
      { id: 'couverture', confirmed: false, fr: 'Conception de couverture', en: 'Cover design' },
      { id: 'mise-en-page', confirmed: false, fr: 'Mise en page professionnelle', en: 'Professional typesetting' },
      { id: 'formats', confirmed: false, fr: 'Formats imprimés et numériques', en: 'Print and digital formats' },
      { id: 'isbn', confirmed: false, fr: 'Accompagnement ISBN', en: 'ISBN guidance' },
      { id: 'distribution', confirmed: false, fr: 'Distribution', en: 'Distribution' },
      { id: 'promotion', confirmed: false, fr: 'Marketing et promotion du livre', en: 'Book marketing and promotion' },
    ],
  };

  DATA.authorById = (id) => DATA.authors.find((a) => a.id === id) || null;
  DATA.booksBy = (authorId) => DATA.books.filter((b) => b.author === authorId);
  DATA.collectionById = (id) => DATA.collections.find((c) => c.id === id) || null;

  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.LE_DATA = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
