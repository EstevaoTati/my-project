/*
 * Shared UI for every LES ÉLITES page: menu, classic/motion toggles, book /
 * author / collection panels (native <dialog>: focus trap, Esc and focus
 * return come from the platform), and the library shelf.
 * Renders only what data/catalog.js holds — missing facts are omitted.
 */
(function () {
  const D = window.LE_DATA;
  const t = (k, v) => window.i18n.t(k, v);
  const L = () => window.i18n.current();
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const root = document.documentElement;
  // Pages in sub-folders (livres/, auteurs/) set data-base="../".
  const BASE = document.body.dataset.base || '';
  const A = (p) => (p && !/^https?:/.test(p) ? BASE + p : p);

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) root.classList.add('calm');

  /* ---------- menu ---------- */
  const menuBtn = $('#menuBtn'), links = $('#navLinks');
  if (menuBtn && links) {
    const set = (open) => { menuBtn.setAttribute('aria-expanded', String(open)); links.classList.toggle('open', open); };
    menuBtn.addEventListener('click', () => set(menuBtn.getAttribute('aria-expanded') !== 'true'));
    links.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  }

  /* ---------- experience toggles ---------- */
  const store = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
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
    syncToggles();
    document.dispatchEvent(new Event('le:mode'));
    window.scrollTo({ top: 0 });
  });
  motionBtn && motionBtn.addEventListener('click', () => {
    const on = root.classList.toggle('calm');
    store('le.motion', on ? 'off' : null);
    syncToggles();
    document.dispatchEvent(new Event('le:mode'));
  });
  document.addEventListener('le:lang', syncToggles);

  /* ---------- formatting helpers ---------- */
  const langName = (c) => t('lang.' + c);
  const fmtName = (f) => t('fmt.' + f);
  const collName = (id) => { const c = D.collectionById(id); return c ? c[L()] || c.fr : id; };
  const bookUrl = (b) => A('livres/' + b.id + '.html');
  const authorUrl = (a) => A('auteurs/' + a.id + '.html');

  function availability(b) {
    if (b.buy) return `<a class="btn btn-gold" href="${esc(b.buy)}" rel="noopener" target="_blank">${esc(t('b.buy'))}${b.price ? ' — ' + esc(b.price) : ''}</a>`;
    // No confirmed sales channel: route to a real contact request, never a fake cart.
    return `<a class="btn btn-gold" href="${A('index.html')}?sujet=${encodeURIComponent(b.title)}#contact" data-request="${esc(b.title)}">${esc(t('b.request'))}</a>`;
  }

  function bookHTML(b, full) {
    const a = D.authorById(b.author);
    const rows = [
      [t('b.lang'), langName(b.lang)],
      b.formats && b.formats.length ? [t('b.format'), b.formats.map(fmtName).join(', ')] : null,
      [t('b.coll'), b.collections.map(collName).join(' · ')],
      [t('b.avail'), b.buy ? (b.price || '—') : t('b.onRequest')],
    ].filter(Boolean);
    return `<div class="bookx">
      <img src="${A(b.cover)}" alt="${esc(b.title)} — ${esc(a ? a.name : '')}" loading="lazy">
      <div>
        <div class="badges">${b.status === 'new' ? `<span class="badge solid">${esc(t('b.new'))}</span>` : ''}${b.imprint ? `<span class="badge">${esc(t('b.imprint'))}</span>` : ''}${b.kicker ? `<span class="badge">${esc(b.kicker)}</span>` : ''}</div>
        <h2 id="dlgTitle">${esc(b.title)}</h2>
        ${b.subtitle ? `<p class="subt">${esc(b.subtitle)}</p>` : ''}
        ${a ? `<p>${esc(t('b.by'))} <a href="${authorUrl(a)}">${esc(a.name)}</a></p>` : ''}
        ${b.quote ? `<blockquote class="quote">“${esc(b.quote)}”</blockquote>` : ''}
        ${b.description ? `<p class="body">${esc(b.description[L()] || b.description.fr || b.description)}</p>` : ''}
        <dl class="meta">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        <div class="ctas" style="justify-content:flex-start">${availability(b)}${full ? '' : `<a class="btn btn-ghost" href="${bookUrl(b)}">${esc(t('b.details'))}</a>`}</div>
      </div></div>`;
  }

  function card(b) {
    const a = D.authorById(b.author);
    return `<button type="button" class="card" data-book="${b.id}"><img src="${A(b.cover)}" alt="" loading="lazy"><b>${esc(b.title)}</b><small>${esc(a ? a.name : '')} · ${esc(langName(b.lang))}</small></button>`;
  }

  function seriesHTML(s) {
    return `<h3>${esc(s.title[L()])}</h3>
      <div class="series-vis">${s.visuals.map((v) => `<img src="${A(v)}" alt="" loading="lazy">`).join('')}</div>
      <p class="sub">${esc(t('s.subjects'))}</p><div class="pills">${s.subjects[L()].map((x) => `<span class="pill">${esc(x)}</span>`).join('')}</div>
      <p class="sub">${esc(t('s.langs'))}</p><div class="pills">${s.languages.map((x) => `<span class="pill">${esc(x)}</span>`).join('')}</div>
      <p class="fine">${esc(t('s.avail'))}</p>`;
  }

  function authorsHTML() {
    return D.authors.map((a) => {
      const books = D.booksBy(a.id);
      const ph = a.photo ? `<img class="ph" src="${A(a.photo)}" alt="${esc(a.photoAlt ? a.photoAlt[L()] : a.name)}" loading="lazy">` : `<span class="ph" aria-hidden="true">${esc(a.name.split(' ').map((w) => w[0]).slice(0, 2).join(''))}</span>`;
      return `<div class="person">${ph}<div><h3><a href="${authorUrl(a)}">${esc(a.name)}</a></h3>
        <p class="fine">${esc(a.bio ? (a.bio[L()] || a.bio.fr) : t('a.bioSoon'))}</p>
        <div class="thumbs">${books.map((b) => `<button type="button" data-book="${b.id}" aria-label="${esc(b.title)}"><img src="${A(b.cover)}" alt=""></button>`).join('')}</div></div></div>`;
    }).join('');
  }

  function collectionsHTML() {
    return D.collections.map((c) => {
      const s = D.series.find((x) => x.collection === c.id);
      if (s) return `<div class="coll">${seriesHTML(s)}</div>`;
      const books = D.books.filter((b) => b.collections.includes(c.id));
      return `<div class="coll"><h3>${esc(c[L()])}</h3><div class="thumbs">${books.map((b) => `<button type="button" data-book="${b.id}" aria-label="${esc(b.title)}"><img src="${A(b.cover)}" alt=""></button>`).join('')}</div></div>`;
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
    else if (kind === 'series') body.innerHTML = `<p class="kicker">${esc(t('cat.series'))}</p>${seriesHTML(D.series[0]).replace('<h3>', '<h2 id="dlgTitle">').replace('</h3>', '</h2>')}`;
    else if (kind === 'manuscript') body.innerHTML = `<p class="kicker">${esc(t('lab.kicker'))}</p><h2 id="dlgTitle">${esc(t('lab.ask'))}</h2><p class="body">${esc(t('lab.askBody'))}</p><div class="ctas" style="justify-content:flex-start"><a class="btn btn-gold" href="${A('manuscrit.html')}">${esc(t('lab.submit'))}</a><a class="btn btn-ghost" href="#contact" data-close>${esc(t('lab.discover'))}</a></div>`;
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
    document.dispatchEvent(new Event('le:dialog'));
  }
  if (dlg) {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
      const b = e.target.closest('[data-book]');
      if (b) open('book', b.dataset.book);
      const r = e.target.closest('[data-request]');
      if (r && document.getElementById('contact')) { e.preventDefault(); dlg.close(); prefill(r.dataset.request); }
    });
    dlg.addEventListener('close', () => { current = null; document.dispatchEvent(new Event('le:dialog')); });
    document.addEventListener('le:lang', () => { if (dlg.open && current) open(current.kind, current.id); });
  }
  function prefill(title) {
    const s = document.getElementById('contactSubject');
    if (s) s.value = (L() === 'en' ? 'Request: ' : 'Demande : ') + title;
    document.getElementById('contact').scrollIntoView({ behavior: root.classList.contains('calm') ? 'auto' : 'smooth' });
    setTimeout(() => s && s.form.querySelector('[name=name]').focus({ preventScroll: true }), 600);
  }
  const subj = new URLSearchParams(location.search).get('sujet');
  if (subj && document.getElementById('contactSubject')) document.getElementById('contactSubject').value = (L() === 'en' ? 'Request: ' : 'Demande : ') + subj.slice(0, 180);

  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]');
    if (o) open(o.dataset.open, o.dataset.id);
    const b = !dlg || !dlg.contains(e.target) ? e.target.closest('[data-book]') : null;
    if (b) open('book', b.dataset.book);
  });
  const desk = $('#desk');
  desk && desk.addEventListener('click', () => open('manuscript'));

  /* ---------- library shelf ---------- */
  const shelf = $('#shelf');
  function renderShelf() {
    if (!shelf) return;
    const books = D.books.map((b) => {
      const a = D.authorById(b.author);
      return `<button type="button" class="book3d" data-book="${b.id}" style="--spine:${b.spine || '#1f3290'}" aria-label="${esc(b.title)} — ${esc(a ? a.name : '')}">
        <i class="s"></i><i class="e"></i><i class="f" style="background-image:url('${A(b.cover)}')"></i>
        ${b.status === 'new' ? `<span class="tag">${esc(t('b.new'))}</span>` : ''}<span class="lbl">${esc(b.title)}</span></button>`;
    });
    const s = D.series[0];
    if (s) books.push(`<button type="button" class="book3d series" data-open="series" style="--spine:#2c5a3a" aria-label="${esc(s.title[L()])}">
      <i class="s"></i><i class="e"></i><i class="f" style="background-image:url('${A(s.visuals[0])}')"></i><span class="lbl">${esc(s.title[L()])}</span></button>`);
    shelf.innerHTML = books.join('');
  }

  const services = $('#services');
  function renderServices() {
    if (services) services.innerHTML = D.services.filter((s) => s.confirmed).map((s) => `<li>${esc(s[L()])}</li>`).join('');
  }

  renderShelf(); renderServices(); syncToggles();
  document.addEventListener('le:lang', () => { renderShelf(); renderServices(); });
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  window.LE_UI = { open, bookHTML, card, authorsHTML, collectionsHTML, seriesHTML, esc, A, bookUrl, authorUrl, collName, langName };
})();
