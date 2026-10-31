#!/usr/bin/env node
// Prerenders the indexable pages from data/catalog.js:
//   catalogue.html, livres/<id>.html, auteurs/<id>.html, sitemap.xml
// The output is committed (the site stays buildless on the host). Re-run
// after any change to data/catalog.js:   node scripts/build-pages.mjs
// `--check` fails if the committed output is stale (use before committing).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Evaluate the browser file exactly as the browser does (window.LE_DATA).
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(join(ROOT, "data/catalog.js"), "utf8"), sandbox);
const D = sandbox.window.LE_DATA;
const CHECK = process.argv.includes("--check");
const ORIGIN = D.site.origin.replace(/\/$/, "");
const V = "v=1";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const langFr = { fr: "Français", en: "Anglais" };
const fmtFr = { hardcover: "Relié", paperback: "Broché", ebook: "Numérique" };
const collFr = (id) => (D.collectionById(id) || { fr: id }).fr;

let stale = [];
const outputs = new Set();
function out(rel, html) {
  const p = join(ROOT, rel);
  outputs.add(rel);
  const prev = existsSync(p) ? readFileSync(p, "utf8") : null;
  if (prev === html) return;
  if (CHECK) { stale.push(rel); return; }
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, html);
  console.log("wrote", rel);
}

function shell({ title, desc, path, base = "", body, image, jsonld, scripts = "" }) {
  const url = ORIGIN + path;
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="theme-color" content="#101114">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${ORIGIN}/${esc(image || "assets/brand/og-banner.jpg")}">
  <link rel="icon" type="image/png" sizes="32x32" href="${base}assets/brand/favicon-32.png">
  <link rel="apple-touch-icon" href="${base}assets/brand/favicon-180.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Manrope:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="${base}styles.css?${V}">
  <link rel="stylesheet" href="${base}pages.css?${V}">
  <script>document.documentElement.classList.add('js','classic')</script>${jsonld ? `\n  <script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body class="page-sub" data-base="${base}">
  <a class="skip" href="#contenu" data-i18n="skip">Aller au contenu</a>
  <header class="nav" id="nav">
    <a class="brand" href="${base || "./"}"><img src="${base}assets/brand/emblem-gold.png" alt="" width="44" height="28"><span class="brand-word">LES ÉLITES<small>PUBLISHING HOUSE</small></span></a>
    <nav class="nav-links" id="navLinks" aria-label="Navigation principale">
      <a href="${base || "./"}" data-i18n="nav.home">Accueil</a>
      <a href="${base}catalogue.html" data-i18n="nav.books">Publications</a>
      <a href="${base}catalogue.html#auteurs" data-i18n="nav.authors">Auteurs</a>
      <a href="${base}manuscrit.html" data-i18n="nav.submit">Soumettre un manuscrit</a>
      <a href="${base}index.html#contact" data-i18n="nav.contact">Contact</a>
    </nav>
    <div class="nav-tools">
      <div class="langs" role="group" aria-label="Langue / Language"><button type="button" data-lang-btn="fr" aria-pressed="true">FR</button><button type="button" data-lang-btn="en" aria-pressed="false">EN</button></div>
      <a class="btn btn-gold btn-sm nav-cta" href="${base}manuscrit.html" data-i18n="nav.publish">Publier mon livre</a>
      <button type="button" class="menu-btn" id="menuBtn" aria-expanded="false" aria-controls="navLinks"><span class="sr" data-i18n="nav.menu">Menu</span><i></i><i></i></button>
    </div>
  </header>
  <main id="contenu" class="sub-main">
${body}
  </main>
  <footer class="foot"><div class="wrap foot-in"><img src="${base}assets/brand/emblem-gold.png" alt="" width="64" height="40"><p class="foot-name">LES ÉLITES PUBLISHING HOUSE</p><p class="foot-pillars">FAITH · INTELLIGENCE · TECHNOLOGY · IMPACT</p><p class="foot-links"><a href="${base}catalogue.html" data-i18n="nav.books">Publications</a> · <a href="${base}manuscrit.html" data-i18n="nav.submit">Soumettre un manuscrit</a> · <a href="${base}confidentialite.html" data-i18n="foot.privacy">Confidentialité</a></p></div></footer>
  <dialog class="dlg" id="dlg" aria-labelledby="dlgTitle"><button type="button" class="dlg-x" data-close><span class="sr" data-i18n="dlg.close">Fermer</span>×</button><div class="dlg-body" id="dlgBody"></div></dialog>
  <script src="${base}data/catalog.js?${V}"></script>
  <script src="${base}i18n.js?${V}"></script>
  <script src="${base}ui.js?${V}"></script>${scripts}
</body>
</html>
`;
}

const author = (b) => D.authorById(b.author);

// ---------- book pages ----------
for (const b of D.books) {
  const a = author(b);
  const rows = [
    ["Langue", langFr[b.lang]],
    b.formats.length ? ["Format", b.formats.map((f) => fmtFr[f]).join(", ")] : null,
    ["Collections", b.collections.map(collFr).join(" · ")],
    ["Disponibilité", b.buy ? b.price || "—" : "Sur demande"],
  ].filter(Boolean);
  const cta = b.buy
    ? `<a class="btn btn-gold" href="${esc(b.buy)}" rel="noopener" target="_blank">Acheter${b.price ? " — " + esc(b.price) : ""}</a>`
    : `<a class="btn btn-gold" href="../index.html?sujet=${encodeURIComponent(b.title)}#contact" data-i18n="b.request">Demander ce livre</a>`;
  const others = D.books.filter((x) => x.id !== b.id && (x.author === b.author || x.collections.some((c) => b.collections.includes(c)))).slice(0, 4);
  const body = `    <div class="wrap">
      <p class="crumbs"><a href="../catalogue.html" data-i18n="cat.title">Catalogue</a> / ${esc(b.title)}</p>
      <article class="book-page">
        <img src="../${b.cover}" alt="${esc(b.title)} — ${esc(a.name)}" width="600" height="900" style="width:100%;height:auto;box-shadow:0 30px 60px rgba(0,0,0,.55)">
        <div>
          <div class="badges">${b.status === "new" ? '<span class="badge solid" data-i18n="b.new">Nouveauté</span>' : ""}${b.imprint ? '<span class="badge" data-i18n="b.imprint">Publié par Les Élites</span>' : ""}${b.kicker ? `<span class="badge">${esc(b.kicker)}</span>` : ""}</div>
          <h1 class="title">${esc(b.title)}</h1>
          ${b.subtitle ? `<p class="subt" style="font:italic 400 22px/1.3 var(--f-display);color:var(--ivory-2);margin:0 0 14px">${esc(b.subtitle)}</p>` : ""}
          <p><span data-i18n="b.by">par</span> <a href="../auteurs/${a.id}.html">${esc(a.name)}</a></p>
          ${b.quote ? `<blockquote class="quote">“${esc(b.quote)}”</blockquote>` : ""}
          ${b.description ? `<p class="body">${esc(b.description.fr || b.description)}</p>` : ""}
          <dl class="meta">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
          <div class="ctas" style="justify-content:flex-start">${cta}</div>
          ${b.gallery ? `<div class="thumbs" style="margin-top:26px">${b.gallery.map((g) => `<img src="../${g}" alt="" loading="lazy" style="width:140px;aspect-ratio:auto">`).join("")}</div>` : ""}
        </div>
      </article>
      ${others.length ? `<h2 class="section-h">À découvrir aussi</h2><div class="cards">${others.map((x) => `<a class="card" href="${x.id}.html"><img src="../${x.cover}" alt="" loading="lazy"><b>${esc(x.title)}</b><small>${esc(author(x).name)}</small></a>`).join("")}</div>` : ""}
    </div>`;
  const jsonld = {
    "@context": "https://schema.org", "@type": "Book", name: b.title, inLanguage: b.lang,
    author: { "@type": "Person", name: a.name, url: `${ORIGIN}/auteurs/${a.id}` },
    image: `${ORIGIN}/${b.cover}`, url: `${ORIGIN}/livres/${b.id}`,
    ...(b.imprint ? { publisher: { "@type": "Organization", name: D.site.name } } : {}),
    ...(b.formats.length ? { bookFormat: b.formats.map((f) => ({ hardcover: "https://schema.org/Hardcover", paperback: "https://schema.org/Paperback", ebook: "https://schema.org/EBook" }[f])) } : {}),
  };
  out(`livres/${b.id}.html`, shell({
    title: `${b.title} — ${a.name} | LES ÉLITES`, desc: `${b.title}${b.subtitle ? " — " + b.subtitle : ""}, par ${a.name}. ${langFr[b.lang]}. LES ÉLITES PUBLISHING HOUSE.`,
    path: `/livres/${b.id}`, base: "../", body, image: b.cover, jsonld,
  }));
}

// ---------- author pages ----------
for (const a of D.authors) {
  const books = D.booksBy(a.id);
  const body = `    <div class="wrap">
      <p class="crumbs"><a href="../catalogue.html#auteurs" data-i18n="nav.authors">Auteurs</a> / ${esc(a.name)}</p>
      <div class="person" style="grid-template-columns:${a.photo ? "180px" : "96px"} 1fr;border:0">
        ${a.photo ? `<img class="ph" style="width:180px" src="../${a.photo}" alt="${esc(a.photoAlt ? a.photoAlt.fr : a.name)}">` : `<span class="ph" aria-hidden="true">${esc(a.name.split(" ").map((w) => w[0]).slice(0, 2).join(""))}</span>`}
        <div><h1 class="title">${esc(a.name)}</h1><p class="fine">${a.bio ? esc(a.bio.fr || a.bio) : '<span data-i18n="a.bioSoon">Biographie à venir.</span>'}</p>
        ${a.links.length ? `<p>${a.links.map((l) => `<a href="${esc(l.url)}" rel="noopener">${esc(l.label)}</a>`).join(" · ")}</p>` : ""}</div>
      </div>
      <h2 class="section-h" data-i18n="a.books">Publications</h2>
      <div class="cards">${books.map((x) => `<a class="card" href="../livres/${x.id}.html"><img src="../${x.cover}" alt="" loading="lazy"><b>${esc(x.title)}</b><small>${esc(langFr[x.lang])}</small></a>`).join("")}</div>
    </div>`;
  out(`auteurs/${a.id}.html`, shell({
    title: `${a.name} — Auteur | LES ÉLITES`, desc: `${a.name} : publications chez LES ÉLITES PUBLISHING HOUSE — ${books.map((b) => b.title).join(", ")}.`,
    path: `/auteurs/${a.id}`, base: "../", body,
    jsonld: { "@context": "https://schema.org", "@type": "Person", name: a.name, url: `${ORIGIN}/auteurs/${a.id}` },
  }));
}

// ---------- catalogue ----------
{
  const s = D.series[0];
  const langs = [...new Set(D.books.map((b) => b.lang))];
  // Header: a slow Higgsfield loop along the shelves. Poster first; the video
  // is attached only when motion is welcome (not reduced-motion / Save-Data).
  const body = `    <header class="cat-hero">
      <img src="media/catalogue-loop.jpg" alt="" onerror="this.remove()">
      <video muted loop playsinline preload="none" data-src="media/catalogue-loop.mp4" aria-hidden="true"></video>
      <div class="wrap">
        <h1 class="title" data-i18n="cat.title">Catalogue</h1>
        <p class="lead left" data-i18n="cat.lead">Toutes les publications de la maison.</p>
      </div>
    </header>
    <div class="wrap">
      <div class="filters" role="search">
        <label class="sr" for="q" data-i18n="cat.search">Rechercher un titre ou un auteur</label>
        <input id="q" type="search" data-i18n="cat.search" data-i18n-attr="placeholder" placeholder="Rechercher un titre ou un auteur" autocomplete="off">
        <select id="fc" aria-label="Collection"><option value="" data-i18n="cat.allColl">Toutes les collections</option>${D.collections.filter((c) => D.books.some((b) => b.collections.includes(c.id))).map((c) => `<option value="${c.id}">${esc(c.fr)}</option>`).join("")}</select>
        <select id="fl" aria-label="Langue"><option value="" data-i18n="cat.allLang">Toutes les langues</option>${langs.map((l) => `<option value="${l}" data-i18n="lang.${l}">${langFr[l]}</option>`).join("")}</select>
      </div>
      <p class="count" id="count" role="status" aria-live="polite"></p>
      <div class="cards" id="grid">${D.books.map((b) => `<a class="card" href="livres/${b.id}.html" data-c="${b.collections.join(" ")}" data-l="${b.lang}" data-s="${esc((b.title + " " + (b.subtitle || "") + " " + author(b).name).toLowerCase())}"><img src="${b.cover}" alt="" loading="lazy"><b>${esc(b.title)}</b><small>${esc(author(b).name)} · <span data-i18n="lang.${b.lang}">${langFr[b.lang]}</span></small></a>`).join("")}</div>
      <p class="fine" id="none" hidden data-i18n="cat.none">Aucun livre ne correspond à votre recherche.</p>
      ${s ? `<h2 class="section-h" id="collections"><span data-i18n="cat.series">Programme éditorial</span> — ${esc(s.title.fr)}</h2>
      <div class="series-vis">${s.visuals.map((v) => `<img src="${v}" alt="" loading="lazy">`).join("")}</div>
      <p class="sub" data-i18n="s.subjects">Disciplines</p><div class="pills">${s.subjects.fr.map((x) => `<span class="pill">${esc(x)}</span>`).join("")}</div>
      <p class="sub" data-i18n="s.langs">Langues</p><div class="pills">${s.languages.map((x) => `<span class="pill">${esc(x)}</span>`).join("")}</div>
      <p class="fine" data-i18n="s.avail">Titres et disponibilité par langue : sur demande.</p>` : ""}
      <h2 class="section-h" id="auteurs" data-i18n="nav.authors">Auteurs</h2>
      <div>${D.authors.map((a) => `<div class="person">${a.photo ? `<img class="ph" src="${a.photo}" alt="${esc(a.name)}" loading="lazy">` : `<span class="ph" aria-hidden="true">${esc(a.name.split(" ").map((w) => w[0]).slice(0, 2).join(""))}</span>`}<div><h3><a href="auteurs/${a.id}.html">${esc(a.name)}</a></h3><div class="thumbs">${D.booksBy(a.id).map((b) => `<a href="livres/${b.id}.html" aria-label="${esc(b.title)}"><img src="${b.cover}" alt=""></a>`).join("")}</div></div></div>`).join("")}</div>
    </div>`;
  const scripts = `
  <script>
  (function(){var v=document.querySelector('.cat-hero video'),c=navigator.connection||{};if(!v||matchMedia('(prefers-reduced-motion: reduce)').matches||c.saveData)return;v.addEventListener('playing',function(){v.classList.add('ready')},{once:true});v.addEventListener('error',function(){v.remove()},{once:true});v.src=v.dataset.src;var p=v.play();p&&p.catch(function(){})})();
  </script>
  <script>
  (function(){var q=document.getElementById('q'),fc=document.getElementById('fc'),fl=document.getElementById('fl'),cards=[].slice.call(document.querySelectorAll('#grid .card')),cnt=document.getElementById('count'),none=document.getElementById('none');
  function norm(s){return (s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'')}
  function run(){var t=norm(q.value.trim()),c=fc.value,l=fl.value,n=0;cards.forEach(function(el){var ok=(!t||norm(el.dataset.s).indexOf(t)>-1)&&(!c||el.dataset.c.split(' ').indexOf(c)>-1)&&(!l||el.dataset.l===l);el.hidden=!ok;if(ok)n++});cnt.textContent=window.i18n.t('cat.count',{n:n});none.hidden=n>0}
  [q,fc,fl].forEach(function(el){el.addEventListener('input',run)});document.addEventListener('le:lang',function(){[].slice.call(fc.options).forEach(function(o){var c=window.LE_DATA.collectionById(o.value);if(c)o.textContent=c[window.i18n.current()]});run()});run()})();
  </script>`;
  out("catalogue.html", shell({
    title: "Catalogue — LES ÉLITES PUBLISHING HOUSE", desc: "Toutes les publications de LES ÉLITES PUBLISHING HOUSE : foi, leadership, technologie, développement personnel et science dans nos langues.",
    path: "/catalogue", body, scripts,
    jsonld: { "@context": "https://schema.org", "@type": "ItemList", itemListElement: D.books.map((b, i) => ({ "@type": "ListItem", position: i + 1, url: `${ORIGIN}/livres/${b.id}` })) },
  }));
}

// ---------- index.html: prerendered book list (no-JS + crawlers) ----------
{
  const p = join(ROOT, "index.html");
  const html = readFileSync(p, "utf8");
  const list = D.books.map((b) => `<li><a href="livres/${b.id}.html">${esc(b.title)}</a> — ${esc(author(b).name)}</li>`).join("");
  out("index.html", html.replace(/<!--books-->[\s\S]*?<!--\/books-->/, `<!--books-->${list}<!--/books-->`));
}

// ---------- sitemap ----------
{
  const paths = ["/", "/catalogue", "/manuscrit", "/confidentialite", ...D.books.map((b) => `/livres/${b.id}`), ...D.authors.map((a) => `/auteurs/${a.id}`)];
  out("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${ORIGIN}${p}</loc></url>`).join("\n")}
</urlset>
`);
}

// Remove pages for books/authors that no longer exist in the data.
for (const dir of ["livres", "auteurs"]) {
  const p = join(ROOT, dir);
  if (!existsSync(p)) continue;
  for (const f of readdirSync(p)) {
    if (!outputs.has(`${dir}/${f}`)) { if (CHECK) stale.push(`${dir}/${f} (orphan)`); else { unlinkSync(join(p, f)); console.log("removed", `${dir}/${f}`); } }
  }
}

if (CHECK && stale.length) { console.error("stale generated pages:\n  " + stale.join("\n  ") + "\nrun: node scripts/build-pages.mjs"); process.exit(1); }
if (CHECK) console.log("generated pages are up to date");
