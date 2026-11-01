/*
 * Shared UI for every LES ÉLITES page: menu, classic/motion toggles, the
 * library shelf, book / author / collection panels (native <dialog>), and the
 * bilingual data hooks (book titles, descriptions, services, marquee).
 * Renders only what data/catalog.js holds — missing facts are omitted.
 */
(function () {
  const D = window.LE_DATA;
  const t = (k, v) => window.i18n.t(k, v);
  const L = () => window.i18n.current();
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const root = document.documentElement;
  const BASE = document.body.dataset.base || '';
  const A = (p) => (p && !/^https?:/.test(p) ? BASE + p : p);
  const T = (b) => D.t(b, L());

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) root.classList.add('os-reduce');

  /* ---------- register the catalogue's bilingual strings with i18n ---------- */
  const more = { fr: {}, en: {} };
  D.books.forEach((b) => ['fr', 'en'].forEach((l) => {
    const x = b[l] && b[l].title ? b[l] : b.fr;
    more[l][`book.${b.id}.title`] = x.title;
    if (x.desc) more[l][`book.${b.id}.desc`] = x.desc;
    (b.tags ? b.tags[l] || b.tags.fr : []).forEach((tg, i) => { more[l][`book.${b.id}.tag${i}`] = tg; });
  }));
  D.services.forEach((s) => ['fr', 'en'].forEach((l) => { more[l][`svc.${s.id}.t`] = s[l][0]; more[l][`svc.${s.id}.d`] = s[l][1]; }));
  window.i18n.extend(more);
  // Elements whose text comes from arrays or collections.
  function applyExtras() {
    const C = window.LE_CONTENT && window.LE_CONTENT[L()];
    if (C) {
      document.querySelectorAll('[data-i18n-mq]').forEach((el) => { el.textContent = C.mq[+el.dataset.i18nMq]; });
      document.querySelectorAll('[data-i18n-arr]').forEach((el) => { el.textContent = C[el.dataset.i18nArr][+el.dataset.idx]; });
    }
    document.querySelectorAll('[data-coll]').forEach((el) => { const c = D.collectionById(el.dataset.coll); if (c) el.textContent = c[L()] || c.fr; });
    document.querySelectorAll('[data-svc]').forEach((el) => { const s = D.services.find((x) => x.id === el.dataset.svc); if (s) el.textContent = s[L()][0]; });
  }
  document.addEventListener('le:lang', applyExtras);

  /* ---------- menu ---------- */
  const menuBtn = $('#menuBtn'), links = $('#navLinks');
  if (menuBtn && links) {
    const set = (open) => { menuBtn.setAttribute('aria-expanded', String(open)); links.classList.toggle('open', open); document.body.classList.toggle('menu-open', open); };
    menuBtn.addEventListener('click', () => set(menuBtn.getAttribute('aria-expanded') !== 'true'));
    links.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  }
  // Header turns solid once the page scrolls.
  const nav = $('#nav');
  const onScroll = () => nav && nav.classList.toggle('is-solid', scrollY > 30);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- experience toggles (opt-outs last for this tab only) ---------- */
  const store = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) {} };
  const classicBtn = $('#classicBtn'), motionBtn = $('#motionBtn');
  function syncToggles() {
    if (classicBtn) classicBtn.dataset.i18n = root.classList.contains('classic') ? 'ui.resumeExp' : 'ui.skipExp';
    if (motionBtn) {
      motionBtn.dataset.i18n = root.classList.contains('calm') ? 'ui.motionOn' : 'ui.motionOff';
      motionBtn.setAttribute('aria-pressed', String(root.classList.contains('calm')));
      motionBtn.hidden = root.classList.contains('classic');
    }
    [classicBtn, motionBtn].forEach((b) => b && (b.textContent = t(b.dataset.i18n)));
  }
  classicBtn && classicBtn.addEventListener('click', () => {
    const on = root.classList.toggle('classic');
    store('le.classic', on ? '1' : null);
    syncToggles(); document.dispatchEvent(new Event('le:mode')); window.scrollTo({ top: 0 });
  });
  motionBtn && motionBtn.addEventListener('click', () => {
    const on = root.classList.toggle('calm');
    store('le.motion', on ? 'off' : null);
    syncToggles(); document.dispatchEvent(new Event('le:mode'));
  });
  document.addEventListener('le:lang', syncToggles);

  /* ---------- helpers ---------- */
  const collName = (id) => { const c = D.collectionById(id); return c ? c[L()] || c.fr : id; };
  const bookUrl = (b) => A('livres/' + b.id + '.html');
  const authorUrl = (a) => A('auteurs/' + a.id + '.html');
  function buy(b) {
    if (b.buy) return `<a class="btn btn-gold" href="${esc(b.buy.url)}" target="_blank" rel="noopener">${esc(t('pub.buy'))}</a>`;
    return `<a class="btn btn-gold" href="${A('contact.html')}?type=order&sujet=${encodeURIComponent(T(b).title)}">${esc(t('pub.order'))}</a>`;
  }
  function bookHTML(b) {
    const a = D.authorById(b.author), x = T(b);
    return `<div class="bookx">
      <img src="${A(b.cover)}" alt="${esc(x.title)} — ${esc(a.name)}" loading="lazy">
      <div>
        <div class="badges">${b.status === 'new' ? `<span class="badge solid">${esc(t('b.new'))}</span>` : ''}${b.imprint ? `<span class="badge">${esc(t('b.imprint'))}</span>` : ''}</div>
        <h2 id="dlgTitle">${esc(x.title)}</h2>
        <p>${esc(t('pub.by'))} <a href="${authorUrl(a)}">${esc(a.name)}</a></p>
        ${x.desc ? `<p class="body">${esc(x.desc)}</p>` : ''}
        ${b.quote ? `<blockquote class="quote">“${esc(b.quote)}”</blockquote>` : ''}
        <dl class="meta"><dt>${esc(t('pub.genre'))}</dt><dd>${b.collections.map(collName).join(' · ')}</dd><dt>${esc(t('pub.langs'))}</dt><dd>${esc(b.languages.join(', '))}</dd></dl>
        <div class="ctas" style="justify-content:flex-start">${buy(b)}<a class="btn btn-ghost" href="${bookUrl(b)}">${esc(t('pub.more'))}</a></div>
      </div></div>`;
  }
  const card = (b) => `<button type="button" class="card" data-book="${b.id}"><img src="${A(b.cover)}" alt="" loading="lazy"><b>${esc(T(b).title)}</b><small>${esc(D.authorById(b.author).name)}</small></button>`;
  function authorsHTML() {
    return D.authors.map((a) => {
      const books = D.booksBy(a.id);
      const ph = a.photo ? `<img class="ph" src="${A(a.photo)}" alt="" loading="lazy">` : `<span class="ph" aria-hidden="true">${esc(a.name.split(' ').map((w) => w[0]).slice(0, 2).join(''))}</span>`;
      return `<div class="person">${ph}<div><h3><a href="${authorUrl(a)}">${esc(a.name)}</a></h3>
        <p class="fine">${esc(a.bio ? (a.bio[L()] || a.bio.fr) : t('a.bioSoon'))}</p>
        <div class="thumbs">${books.map((b) => `<button type="button" data-book="${b.id}" aria-label="${esc(T(b).title)}"><img src="${A(b.cover)}" alt=""></button>`).join('')}</div></div></div>`;
    }).join('');
  }
  function collectionsHTML() {
    return D.collections.map((c) => {
      const books = D.books.filter((b) => b.collections.includes(c.id));
      return `<div class="coll"><h3><a href="${A('catalogue.html')}?c=${c.id}">${esc(c[L()])}</a></h3><div class="thumbs">${books.map((b) => `<button type="button" data-book="${b.id}" aria-label="${esc(T(b).title)}"><img src="${A(b.cover)}" alt=""></button>`).join('')}</div></div>`;
    }).join('');
  }

  /* ---------- dialog ---------- */
  const dlg = $('#dlg'), body = $('#dlgBody');
  let current = null;
  function open(kind, id) {
    if (!dlg) return;
    current = { kind, id };
    if (kind === 'book') body.innerHTML = bookHTML(D.books.find((b) => b.id === id));
    else if (kind === 'books') body.innerHTML = `<h2 id="dlgTitle">${esc(t('lib.poi1'))}</h2><div class="cards">${D.books.map(card).join('')}</div>`;
    else if (kind === 'authors') body.innerHTML = `<h2 id="dlgTitle">${esc(t('lib.poi2'))}</h2>${authorsHTML()}`;
    else if (kind === 'collections') body.innerHTML = `<h2 id="dlgTitle">${esc(t('lib.poi3'))}</h2>${collectionsHTML()}`;
    else if (kind === 'manuscript') body.innerHTML = `<p class="kicker">${esc(t('lab.kicker'))}</p><h2 id="dlgTitle">${esc(t('svc.ctaTitle'))}</h2><p class="body">${esc(t('svc.ctaDesc'))}</p><div class="ctas" style="justify-content:flex-start"><a class="btn btn-gold" href="${A('manuscrit.html')}">${esc(t('svc.cta'))}</a><a class="btn btn-ghost" href="${A('services.html')}">${esc(t('nav.services'))}</a></div>`;
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
    document.dispatchEvent(new Event('le:dialog'));
  }
  if (dlg) {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
      const b = e.target.closest('[data-book]');
      if (b) open('book', b.dataset.book);
    });
    dlg.addEventListener('close', () => { current = null; document.dispatchEvent(new Event('le:dialog')); });
    document.addEventListener('le:lang', () => { if (dlg.open && current) open(current.kind, current.id); });
  }
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]');
    if (o) open(o.dataset.open, o.dataset.id);
    const b = !dlg || !dlg.contains(e.target) ? e.target.closest('button[data-book]') : null;
    if (b) open('book', b.dataset.book);
  });
  const desk = $('#desk');
  desk && desk.addEventListener('click', () => open('manuscript'));

  /* ---------- contact form prefill from the URL (?type=order&sujet=…) ---------- */
  const qs = new URLSearchParams(location.search);
  const subj = $('#contactSubject'), type = $('#contactType');
  if (type && qs.get('type') && [...type.options].some((o) => o.value === qs.get('type'))) type.value = qs.get('type');
  if (subj && qs.get('sujet')) subj.value = qs.get('sujet').slice(0, 190);

  /* ---------- library shelf (home) ---------- */
  const shelf = $('#shelf');
  function renderShelf() {
    if (!shelf) return;
    shelf.innerHTML = D.books.map((b) => {
      const a = D.authorById(b.author), x = T(b);
      return `<button type="button" class="book3d" data-book="${b.id}" style="--spine:${b.spine || '#1f3290'}" aria-label="${esc(x.title)} — ${esc(a.name)}">
        <i class="s"></i><i class="e"></i><i class="f" style="background-image:url('${A(b.cover)}')"></i>
        ${b.status === 'new' ? `<span class="tag">${esc(t('b.new'))}</span>` : ''}<span class="lbl">${esc(x.title)}</span></button>`;
    }).join('');
  }

  renderShelf(); syncToggles(); applyExtras();
  document.addEventListener('le:lang', renderShelf);
  // i18n applied before these keys existed on first paint: re-apply once.
  if (L() !== 'fr') window.i18n.apply(L());

  window.LE_UI = { open, bookHTML, esc, A, bookUrl, authorUrl, collName };
})();
