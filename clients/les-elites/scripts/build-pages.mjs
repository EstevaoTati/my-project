#!/usr/bin/env node
// Generates EVERY page of the site from data/catalog.js + content.js, so the
// header, footer, motion layer and i18n hooks are identical everywhere:
//   index.html (immersive journey) · maison.html · services.html ·
//   catalogue.html · contact.html · manuscrit.html · confidentialite.html ·
//   livres/<id>.html · auteurs/<id>.html · sitemap.xml
// Static French text is written into the HTML (SEO, no-JS); every string
// carries data-i18n so the EN switch translates it in place.
// Output is committed (the host stays buildless). Re-run after any change:
//   node scripts/build-pages.mjs          (--check fails if output is stale)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (f, key) => { const sb = { window: {} }; vm.runInNewContext(readFileSync(join(ROOT, f), "utf8"), sb); return sb.window[key]; };
const D = load("data/catalog.js", "LE_DATA");
const C = load("content.js", "LE_CONTENT");
const CHECK = process.argv.includes("--check");
const ORIGIN = D.site.origin.replace(/\/$/, "");
const V = "v=7";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fr = (k) => { const v = C.fr[k]; if (v === undefined) throw new Error("missing content key " + k); return v; };
// <tag data-i18n="key">French</tag>
const T = (tag, key, attrs = "") => `<${tag} data-i18n="${key}"${attrs ? " " + attrs : ""}>${esc(fr(key))}</${tag}>`;
const coll = (id) => D.collectionById(id) || { fr: id, en: id };
const author = (b) => D.authorById(b.author);
const icon = (name) => ({
  quill: '<path d="M20 3c-6 1-11 5-13 11l-2 7 3-3c5-1 9-4 11-9-2 1-4 1-6 1 3-2 5-4 7-7z"/>',
  lens: '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  frame: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h8M8 11h5"/>',
  grid: '<path d="M4 4h16v16H4zM4 10h16M10 10v10"/>',
  seal: '<circle cx="12" cy="10" r="6"/><path d="M9 15l-2 6 5-3 5 3-2-6"/>',
  press: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  spark: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/>',
}[name] || "");
const svg = (name) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${icon(name)}</svg>`;

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

// ---------- the shared shell ----------
const NAV = [
  ["index.html", "nav.home"], ["maison.html", "nav.about"], ["catalogue.html", "nav.books"],
  ["services.html", "nav.services"], ["contact.html", "nav.contact"],
];
function shell({ title, desc, path, base = "", page, body, image, jsonld, scripts = "", immersive = false }) {
  const url = ORIGIN + path;
  const c = D.site.contact;
  const nav = NAV.map(([href, key]) => `<a href="${base}${href}"${page === href ? ' aria-current="page"' : ""} data-i18n="${key}">${esc(C.fr[key] ?? key)}</a>`).join("\n      ");
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="theme-color" content="#101114">
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="fr" href="${url}?lang=fr">
  <link rel="alternate" hreflang="en" href="${url}?lang=en">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${ORIGIN}/${esc(image || "assets/brand/og-banner.jpg")}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/png" sizes="32x32" href="${base}assets/brand/favicon-32.png">
  <link rel="apple-touch-icon" href="${base}assets/brand/favicon-180.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Manrope:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="${base}styles.css?${V}">
  <link rel="stylesheet" href="${base}pages.css?${V}">
  <link rel="stylesheet" href="${base}site.css?${V}">
  <link rel="stylesheet" href="${base}motion.css?${V}">
  <script>document.documentElement.classList.add('js'${immersive ? "" : ",'page'"});try{localStorage.removeItem('le.classic');localStorage.removeItem('le.motion');if(/[?&]mode=immersi/.test(location.search)){sessionStorage.removeItem('le.classic');sessionStorage.removeItem('le.motion')}${immersive ? "if(sessionStorage.getItem('le.classic')==='1')document.documentElement.classList.add('classic');" : ""}if(sessionStorage.getItem('le.motion')==='off')document.documentElement.classList.add('calm')}catch(e){}</script>${jsonld ? `\n  <script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body class="${immersive ? "page-home" : "page-sub"}" data-base="${base}">
  <a class="skip" href="#contenu" data-i18n="skip">Aller au contenu</a>
  <div class="topbar">
    <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>
    <a href="${esc(c.phoneHref)}">${esc(c.phone)}</a>
    <span class="topbar-loc">${esc(c.address)}</span>
  </div>
  <header class="nav" id="nav">
    <a class="brand" href="${base}index.html" aria-label="LES ÉLITES — accueil">
      <img src="${base}assets/brand/emblem-gold.png" alt="" width="44" height="28">
      <span class="brand-word">LES ÉLITES<small>PUBLISHING HOUSE</small></span>
    </a>
    <nav class="nav-links" id="navLinks" aria-label="Navigation principale">
      ${nav}
    </nav>
    <div class="nav-tools">
      <div class="langs" role="group" aria-label="Langue / Language">
        <button type="button" data-lang-btn="fr" aria-pressed="true">FR</button>
        <button type="button" data-lang-btn="en" aria-pressed="false">EN</button>
      </div>
      <a class="btn btn-gold btn-sm nav-cta" href="${base}manuscrit.html" data-i18n="nav.submit">${esc(fr("nav.submit"))}</a>
      <button type="button" class="menu-btn" id="menuBtn" aria-expanded="false" aria-controls="navLinks"><span class="sr" data-i18n="nav.menu">Menu</span><i></i><i></i></button>
    </div>
  </header>
${body}

  <footer class="foot2">
    <div class="wrap foot-grid">
      <div class="foot-brand">
        <img src="${base}assets/brand/emblem-gold.png" alt="" width="72" height="46">
        <p class="foot-name">LES ÉLITES<small>PUBLISHING HOUSE</small></p>
        ${T("p", "foot.tagline", 'class="fine"')}
        <p class="foot-contact"><a href="mailto:${esc(c.email)}">${esc(c.email)}</a><br><a href="${esc(c.phoneHref)}">${esc(c.phone)}</a><br><a href="${esc(c.mapHref)}" target="_blank" rel="noopener">${esc(c.address)}</a></p>
      </div>
      <nav aria-label="La Maison">${T("h4", "foot.house")}<a href="${base}maison.html" data-i18n="nav.about">${esc(fr("nav.about"))}</a><a href="${base}maison.html#mission" data-i18n="nav.mission">${esc(fr("nav.mission"))}</a><a href="${base}contact.html" data-i18n="nav.contact">${esc(fr("nav.contact"))}</a></nav>
      <nav aria-label="Publications">${T("h4", "foot.pubs")}<a href="${base}catalogue.html" data-i18n="pub.all">${esc(fr("pub.all"))}</a>${D.collections.map((cl) => `<a href="${base}catalogue.html?c=${cl.id}" data-coll="${cl.id}">${esc(cl.fr)}</a>`).join("")}</nav>
      <nav aria-label="Services">${T("h4", "foot.svc")}<a href="${base}services.html" data-i18n="nav.services">${esc(fr("nav.services"))}</a><a href="${base}manuscrit.html" data-i18n="nav.submit">${esc(fr("nav.submit"))}</a><a href="${base}confidentialite.html" data-i18n="foot.privacy">Confidentialité</a></nav>
    </div>
    <div class="wrap foot-base">
      <p>© ${new Date().getFullYear()} <span data-i18n="foot.copy">${esc(fr("foot.copy"))}</span></p>
      ${T("p", "foot.founded")}
      ${T("p", "mission.motto", 'class="foot-motto"')}
      ${immersive ? "" : `<button type="button" class="chip" id="motionBtn" data-i18n="ui.motionOff">Réduire les animations</button>`}
    </div>
  </footer>

  <dialog class="dlg" id="dlg" aria-labelledby="dlgTitle"><button type="button" class="dlg-x" data-close><span class="sr" data-i18n="dlg.close">Fermer</span>×</button><div class="dlg-body" id="dlgBody"></div></dialog>
  <script src="${base}data/catalog.js?${V}"></script>
  <script src="${base}i18n.js?${V}"></script>
  <script src="${base}content.js?${V}"></script>
  <script src="${base}ui.js?${V}"></script>
  <script src="${base}motion.js?${V}"></script>
  <script src="${base}forms.js?${V}"></script>${scripts}
</body>
</html>
`;
}

// ---------- reusable blocks ----------
const head = (badgeKey, titleKey, subKey, cls = "") => `<header class="sec-head ${cls}">
        ${T("p", badgeKey, 'class="kicker" data-reveal')}
        ${T("h2", titleKey, 'class="title" data-split')}
        ${subKey ? T("p", subKey, 'class="lead left" data-reveal style="--delay:.2s"') : ""}
      </header>`;
const buyBtn = (b, base) => b.buy
  ? `<a class="btn btn-gold" href="${esc(b.buy.url)}" target="_blank" rel="noopener" data-i18n="pub.buy">${esc(fr("pub.buy"))}</a>`
  : `<a class="btn btn-gold" href="${base}contact.html?type=order&amp;sujet=${encodeURIComponent(b.fr.title)}" data-i18n="pub.order">${esc(fr("pub.order"))}</a>`;
const bookCard = (b, base) => `<a class="bcard" href="${base}livres/${b.id}.html" data-tilt data-c="${b.collections.join(" ")}" data-l="${b.languages.join(" ").toLowerCase()}" data-s="${esc((b.fr.title + " " + b.en.title + " " + author(b).name).toLowerCase())}">
          <span class="bcard-cover"><img src="${base}${b.cover}" alt="" loading="lazy">${b.status === "new" ? '<span class="tag" data-i18n="b.new">Nouveauté</span>' : ""}</span>
          <span class="bcard-genre" data-coll="${b.collections[0]}">${esc(coll(b.collections[0]).fr)}</span>
          <b data-i18n="book.${b.id}.title">${esc(b.fr.title)}</b>
          <small>${esc(author(b).name)}</small>
        </a>`;
const marquee = () => `<div class="marquee" data-marquee aria-label="${esc(fr("mq").join(" · "))}"><div class="mq-track">${fr("mq").map((m, i) => `<span data-i18n-mq="${i}">${esc(m)}</span>`).join("")}</div></div>`;
const dust = () => `<div class="dust" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="--x:${(i * 73) % 100}%;--t:${-(i * 1.7).toFixed(1)}s"></i>`).join("")}</div>`;

// ---------- index.html : the immersive journey ----------
{
  const shelf = D.books.map((b) => `<li><a href="livres/${b.id}.html">${esc(b.fr.title)}</a> — ${esc(author(b).name)}</li>`).join("");
  const scene = (n) => `<div class="scene s${n}" data-scene="${n}"><div class="paint"></div><img class="poster" data-src="media/scene-0${n}.jpg" alt=""><video muted loop playsinline preload="none" data-src="media/scene-0${n}.mp4" data-src-m="media/scene-0${n}-m.mp4"></video></div>`;
  const pillars = [1, 2, 3, 4].map((i) => `<li data-reveal style="--delay:${i * 0.08}s"><b>0${i}</b><span><strong data-i18n="about.p${i}t">${esc(fr(`about.p${i}t`))}</strong><em data-i18n="about.p${i}">${esc(fr(`about.p${i}`))}</em></span></li>`).join("");
  const body = `  <nav class="rail" id="rail" data-i18n="ui.progress" data-i18n-attr="aria-label" aria-label="Progression dans la Maison">
    <a href="#arrivee"><span data-i18n="sc1">Le Parvis des Idées</span></a>
    <a href="#maison"><span data-i18n="sc2">Le Hall de l’Excellence</span></a>
    <a href="#bibliotheque"><span data-i18n="sc3">La Grande Bibliothèque</span></a>
    <a href="#atelier"><span data-i18n="sc4">L’Atelier des Auteurs</span></a>
    <a href="#observatoire"><span data-i18n="sc5">L’Observatoire des Générations</span></a>
    <i class="rail-fill" id="railFill"></i>
  </nav>
  <div class="exp-tools">
    <button type="button" class="chip" id="classicBtn" data-i18n="ui.skipExp">Passer l’expérience</button>
    <button type="button" class="chip" id="motionBtn" data-i18n="ui.motionOff">Réduire les animations</button>
  </div>
  <div class="stage" id="stage" aria-hidden="true">
    ${[1, 2, 3, 4, 5].map(scene).join("\n    ")}
    <div class="vignette"></div>
    ${dust()}
  </div>

  <main id="contenu">
    <section class="chapter" id="arrivee" data-len="2">
      <div class="pin">
        <div class="panel panel-hero">
          <img class="hero-emblem" src="assets/brand/emblem-gold.png" alt="" width="180" height="114">
          ${T("p", "hero.badge", 'class="kicker"')}
          <h1 class="display hero-lines"><span class="hl" data-split data-i18n="hero.l1">${esc(fr("hero.l1"))}</span> <span class="hl" data-split data-i18n="hero.l2">${esc(fr("hero.l2"))}</span> <span class="hl hl-gold" data-split data-i18n="hero.l3">${esc(fr("hero.l3"))}</span><span class="sr">LES ÉLITES PUBLISHING HOUSE</span></h1>
          ${T("p", "hero.quote", 'class="hero-quote"')}
          ${T("p", "hero.sub", 'class="lead"')}
          <div class="ctas">
            <a class="btn btn-gold" href="catalogue.html" data-i18n="hero.cta1">${esc(fr("hero.cta1"))}</a>
            <a class="btn btn-ghost" href="maison.html" data-i18n="hero.cta2">${esc(fr("hero.cta2"))}</a>
          </div>
          <p class="scroll-hint reveal" data-out="0.25"><span data-i18n="hero.scroll">${esc(fr("hero.scroll"))}</span><i></i></p>
        </div>
      </div>
    </section>

    <section class="chapter" id="maison" data-len="2.8">
      <div class="pin">
        <div class="panel panel-side panel-wide">
          ${T("p", "about.badge", 'class="kicker"')}
          ${T("h2", "about.title", 'class="title reveal" data-at="0.04"')}
          ${T("p", "about.quote", 'class="quote reveal" data-at="0.1"')}
          ${T("p", "about.body", 'class="body reveal" data-at="0.16"')}
          <ul class="axes axes-rich">${[1, 2, 3, 4].map((i) => `<li class="reveal" data-at="${(0.24 + i * 0.07).toFixed(2)}"><b>0${i}</b><span><strong data-i18n="about.p${i}t">${esc(fr(`about.p${i}t`))}</strong> <em data-i18n="about.p${i}">${esc(fr(`about.p${i}`))}</em></span></li>`).join("")}</ul>
          <p class="reveal founded" data-at="0.6"><span class="big">2025</span> <span data-i18n="about.founded">${esc(fr("about.founded"))}</span></p>
          <a class="btn btn-ghost reveal" data-at="0.64" href="maison.html#mission" data-i18n="about.cta">${esc(fr("about.cta"))}</a>
        </div>
        <div class="home-mq">${marquee()}</div>
      </div>
    </section>

    <section class="chapter" id="bibliotheque" data-len="3">
      <div class="pin">
        <div class="panel panel-top">
          ${T("p", "pub.badge", 'class="kicker"')}
          ${T("h2", "pub.title", 'class="title reveal" data-at="0.02"')}
          ${T("p", "pub.sub", 'class="body reveal" data-at="0.08"')}
        </div>
        <div class="shelf-wrap reveal" data-at="0.12"><div class="shelf" id="shelf"></div></div>
        <div class="pois reveal" data-at="0.2">
          <button type="button" class="poi" data-open="books"><b>01</b><span data-i18n="lib.poi1">Nos publications</span></button>
          <button type="button" class="poi" data-open="authors"><b>02</b><span data-i18n="lib.poi2">Nos auteurs</span></button>
          <button type="button" class="poi" data-open="collections"><b>03</b><span data-i18n="lib.poi3">Nos collections</span></button>
          <a class="poi poi-link" href="catalogue.html"><span data-i18n="lib.all">Voir tout le catalogue</span> →</a>
        </div>
        <ul class="nojs-list" id="bookList"><!--books-->${shelf}<!--/books--></ul>
      </div>
    </section>

    <section class="chapter" id="atelier" data-len="3">
      <div class="pin">
        <div class="panel panel-side">
          ${T("p", "svc.badge", 'class="kicker"')}
          ${T("h2", "svc.title", 'class="title reveal" data-at="0.02"')}
          <ol class="steps">${[1, 2, 3, 4].map((i) => `<li class="reveal" data-at="${(0.08 + i * 0.12).toFixed(2)}"><b>${["I", "II", "III", "IV"][i - 1]}</b><span data-i18n="svc.s${i}">${esc(fr(`svc.s${i}`))}</span></li>`).join("")}</ol>
          <div class="reveal" data-at="0.62"><ul class="services" id="services">${D.services.map((s) => `<li data-svc="${s.id}">${esc(s.fr[0])}</li>`).join("")}</ul>
          <a class="link-more" href="services.html"><span data-i18n="pub.more">${esc(fr("pub.more"))}</span> →</a></div>
        </div>
        <button type="button" class="desk reveal" data-at="0.05" id="desk" aria-haspopup="dialog">
          <span class="sr" data-i18n="lab.desk">Ouvrir le manuscrit</span>
          <span class="ms" aria-hidden="true"><i class="pg"></i><i class="pg"></i><i class="pg"></i><i class="pg"></i><i class="pg"></i><i class="bk"><i class="bk-front"><img src="assets/brand/emblem-gold.png" alt=""></i><i class="bk-spine"></i></i></span>
        </button>
        <div class="panel panel-cta reveal" data-at="0.72">
          ${T("p", "svc.ctaTitle", 'class="ask"')}
          ${T("p", "svc.ctaDesc", 'class="body"')}
          <div class="ctas"><a class="btn btn-gold" href="manuscrit.html" data-i18n="svc.cta">${esc(fr("svc.cta"))}</a><a class="btn btn-ghost" href="services.html" data-i18n="nav.services">${esc(fr("nav.services"))}</a></div>
          <p class="fine" data-i18n="lab.note">Séquence illustrative du processus éditorial — pas une réalisation client.</p>
        </div>
      </div>
    </section>

    <section class="chapter" id="observatoire" data-len="2">
      <div class="pin">
        <div class="panel panel-final">
          ${T("p", "mission.badge", 'class="kicker"')}
          <p class="final-mark reveal" data-at="0.05">LES ÉLITES</p>
          <p class="motto reveal" data-at="0.1"><span data-i18n="hero.l1">${esc(fr("hero.l1"))}</span> <span data-i18n="hero.l2">${esc(fr("hero.l2"))}</span> <span data-i18n="hero.l3">${esc(fr("hero.l3"))}</span></p>
          ${T("p", "mission.motto", 'class="line reveal" data-at="0.2"')}
          ${T("p", "mission.quote", 'class="line line-sm reveal" data-at="0.3"')}
          <div class="ctas reveal" data-at="0.45">
            <a class="btn btn-gold" href="manuscrit.html" data-i18n="obs.cta1">Publier mon livre</a>
            <a class="btn btn-ghost" href="catalogue.html" data-i18n="obs.cta2">Découvrir le catalogue</a>
            <a class="btn btn-ghost" href="contact.html" data-i18n="obs.cta3">Contacter notre équipe</a>
          </div>
        </div>
      </div>
    </section>

    <section class="plain contact-strip" id="contact">
      <div class="wrap strip-in">
        <div>${T("p", "ct.badge", 'class="kicker" data-reveal')}${T("h2", "ct.title", 'class="title" data-split')}</div>
        <div class="strip-links" data-reveal>
          <a class="strip-link" href="mailto:${esc(D.site.contact.email)}"><small data-i18n="ct.email">Email</small>${esc(D.site.contact.email)}</a>
          <a class="strip-link" href="${esc(D.site.contact.phoneHref)}"><small data-i18n="ct.phone">Téléphone</small>${esc(D.site.contact.phone)}</a>
          <a class="btn btn-gold" href="contact.html" data-i18n="obs.cta3">Contacter notre équipe</a>
        </div>
      </div>
    </section>
  </main>`;
  out("index.html", shell({
    title: "LES ÉLITES PUBLISHING HOUSE — Former. Éveiller. Transformer.",
    desc: fr("hero.sub"), path: "/", page: "index.html", body, immersive: true,
    jsonld: { "@context": "https://schema.org", "@type": "Organization", name: D.site.name, url: ORIGIN + "/", logo: ORIGIN + "/assets/brand/logo-full.png", email: D.site.contact.email, telephone: D.site.contact.phone, foundingDate: String(D.site.founded), address: { "@type": "PostalAddress", addressLocality: "Seattle", addressRegion: "WA", addressCountry: "US" } },
    scripts: `\n  <script src="experience.js?${V}"></script>`,
  }));
}

// ---------- maison.html : about + vision & mission ----------
{
  const body = `  <main id="contenu" class="sub-main sub-dark">
    <section class="hero-sub">
      ${dust()}
      <div class="wrap">
        ${T("p", "about.badge", 'class="kicker" data-reveal')}
        ${T("h1", "about.title", 'class="title title-xl" data-split')}
        ${T("p", "about.quote", 'class="hero-quote left" data-reveal style="--delay:.3s"')}
      </div>
    </section>
    <section class="wrap split-2">
      <div data-reveal="left">
        <figure class="framed" data-tilt><img src="assets/scenes/hall.jpg" alt="" loading="lazy" onerror="this.closest('figure').classList.add('noimg')"><figcaption><span class="big" data-count="2025">2025</span><span data-i18n="about.founded">${esc(fr("about.founded"))}</span></figcaption></figure>
      </div>
      <div data-reveal="right">
        ${T("p", "about.body", 'class="body body-lg"')}
        <ul class="pillars" data-stagger>${[1, 2, 3, 4].map((i) => `<li data-reveal style="--i:${i}"><b>0${i}</b><h3 data-i18n="about.p${i}t">${esc(fr(`about.p${i}t`))}</h3><p data-i18n="about.p${i}">${esc(fr(`about.p${i}`))}</p></li>`).join("")}</ul>
      </div>
    </section>
    ${marquee()}
    <section class="wrap" id="mission">
      ${head("mission.badge", "mission.title", "mission.sub")}
      <ol class="mission-grid" data-stagger>${[1, 2, 3, 4].map((i) => `<li data-reveal style="--i:${i}" data-tilt><span class="num">0${i}</span><h3 data-i18n="mission.m${i}t">${esc(fr(`mission.m${i}t`))}</h3><p data-i18n="mission.m${i}">${esc(fr(`mission.m${i}`))}</p></li>`).join("")}</ol>
      ${T("blockquote", "mission.motto", 'class="big-quote" data-reveal="zoom"')}
    </section>
    <section class="wrap split-2 readership">
      <div>
        ${T("p", "read.badge", 'class="kicker" data-reveal')}
        ${T("h2", "read.title", 'class="title" data-split')}
        ${T("p", "mission.quote", 'class="quote" data-reveal')}
      </div>
      <ul class="read-list" data-stagger>${fr("read.items").map((r, i) => `<li data-reveal="right" style="--i:${i}" data-i18n-arr="read.items" data-idx="${i}">${esc(r)}</li>`).join("")}</ul>
    </section>
    <section class="cta-band" data-reveal="zoom">
      <div class="wrap">
        ${T("h2", "svc.ctaTitle", 'class="title"')}
        ${T("p", "svc.ctaDesc", 'class="lead"')}
        <div class="ctas"><a class="btn btn-gold" href="manuscrit.html" data-i18n="svc.cta">${esc(fr("svc.cta"))}</a><a class="btn btn-ghost" href="catalogue.html" data-i18n="hero.cta1">${esc(fr("hero.cta1"))}</a></div>
      </div>
    </section>
  </main>`;
  out("maison.html", shell({ title: "À Propos & Mission — LES ÉLITES PUBLISHING HOUSE", desc: fr("about.body"), path: "/maison", page: "maison.html", body }));
}

// ---------- services.html ----------
{
  const body = `  <main id="contenu" class="sub-main sub-dark">
    <section class="hero-sub">
      ${dust()}
      <div class="wrap">
        ${T("p", "svc.badge", 'class="kicker" data-reveal')}
        ${T("h1", "svc.title", 'class="title title-xl" data-split')}
        ${T("p", "svc.sub", 'class="lead left" data-reveal style="--delay:.3s"')}
      </div>
    </section>
    <section class="wrap">
      <ul class="svc-grid" data-stagger>${D.services.map((s, i) => `<li class="svc" data-reveal style="--i:${i % 3}" data-tilt id="${s.id}">${svg(s.icon)}<span class="num">${String(i + 1).padStart(2, "0")}</span><h3 data-i18n="svc.${s.id}.t">${esc(s.fr[0])}</h3><p data-i18n="svc.${s.id}.d">${esc(s.fr[1])}</p></li>`).join("")}</ul>
    </section>
    <section class="wrap path">
      ${T("h2", "svc.path", 'class="title" data-split')}
      <ol class="path-line" data-stagger>${[1, 2, 3, 4].map((i) => `<li data-reveal style="--i:${i}"><span class="dot"></span><b>${["I", "II", "III", "IV"][i - 1]}</b><span data-i18n="svc.s${i}">${esc(fr(`svc.s${i}`))}</span></li>`).join("")}</ol>
    </section>
    <section class="cta-band" data-reveal="zoom">
      <div class="wrap">
        ${T("h2", "svc.ctaTitle", 'class="title"')}
        ${T("p", "svc.ctaDesc", 'class="lead"')}
        <div class="ctas"><a class="btn btn-gold" href="manuscrit.html" data-i18n="svc.cta">${esc(fr("svc.cta"))}</a><a class="btn btn-ghost" href="contact.html?type=services" data-i18n="ct.t2">${esc(fr("ct.t2"))}</a></div>
      </div>
    </section>
  </main>`;
  out("services.html", shell({ title: "Services éditoriaux — LES ÉLITES PUBLISHING HOUSE", desc: fr("svc.sub"), path: "/services", page: "services.html", body }));
}

// ---------- catalogue.html ----------
{
  const feat = D.books.find((b) => b.featured);
  const langs = [...new Set(D.books.flatMap((b) => b.languages))];
  const body = `  <main id="contenu" class="sub-main sub-dark">
    <section class="hero-sub">
      ${dust()}
      <div class="wrap">
        ${T("p", "pub.badge", 'class="kicker" data-reveal')}
        ${T("h1", "pub.title", 'class="title title-xl" data-split')}
        ${T("p", "pub.sub", 'class="lead left" data-reveal style="--delay:.3s"')}
      </div>
    </section>
    ${feat ? `<section class="wrap featured" data-reveal>
      <div class="book-stage" data-book3d tabindex="0" role="img" aria-label="${esc(feat.fr.title)}" style="--spine:${feat.spine}">
        <div class="b3"><div class="b-front" style="background-image:url('${feat.cover}')"></div><div class="b-back"><img src="assets/brand/emblem-gold.png" alt=""></div><div class="b-spine"><span>${esc(feat.en.title)}</span></div><div class="b-pages"></div><div class="b-top"></div></div>
        <span class="b-shadow"></span>
      </div>
      <div>
        ${T("p", "pub.featured", 'class="kicker"')}
        <h2 class="title" data-i18n="book.${feat.id}.title">${esc(feat.fr.title)}</h2>
        <p class="byline"><span data-i18n="pub.by">par</span> <a href="auteurs/${feat.author}.html">${esc(author(feat).name)}</a></p>
        <p class="body" data-i18n="book.${feat.id}.desc">${esc(feat.fr.desc)}</p>
        <div class="ctas left">${buyBtn(feat, "")}<a class="btn btn-ghost" href="livres/${feat.id}.html" data-i18n="pub.more">${esc(fr("pub.more"))}</a></div>
      </div>
    </section>` : ""}
    <section class="wrap" id="tous">
      <div class="filters" role="search">
        <label class="sr" for="q" data-i18n="cat.search">Rechercher un titre ou un auteur</label>
        <input id="q" type="search" data-i18n="cat.search" data-i18n-attr="placeholder" placeholder="Rechercher un titre ou un auteur" autocomplete="off">
        <select id="fl" aria-label="Langue"><option value="" data-i18n="cat.allLang">Toutes les langues</option>${langs.map((l) => `<option value="${l.toLowerCase()}">${esc(l)}</option>`).join("")}</select>
      </div>
      <div class="chips" role="group" aria-label="Collections">
        <button type="button" class="fchip" data-f="" aria-pressed="true" data-i18n="pub.all">${esc(fr("pub.all"))}</button>
        ${D.collections.map((c) => `<button type="button" class="fchip" data-f="${c.id}" aria-pressed="false" data-coll="${c.id}">${esc(c.fr)}</button>`).join("")}
      </div>
      <p class="count" id="count" role="status" aria-live="polite"></p>
      <div class="bgrid" id="grid" data-stagger>${D.books.map((b) => bookCard(b, "")).join("")}</div>
      <p class="fine" id="none" hidden data-i18n="cat.none">Aucun livre ne correspond à votre recherche.</p>
    </section>
    <section class="wrap" id="auteurs">
      ${T("h2", "nav.authors", 'class="section-h" data-split')}
      <div class="author-row" data-stagger>${D.authors.map((a, i) => `<a class="acard" href="auteurs/${a.id}.html" data-reveal style="--i:${i}" data-tilt>${a.photo ? `<img src="${a.photo}" alt="" loading="lazy">` : `<span class="ph">${esc(a.name.split(" ").map((w) => w[0]).slice(0, 2).join(""))}</span>`}<b>${esc(a.name)}</b><small>${D.booksBy(a.id).length} <span data-i18n="a.books">Publications</span></small></a>`).join("")}</div>
    </section>
  </main>`;
  const scripts = `
  <script>
  (function(){var q=document.getElementById('q'),fl=document.getElementById('fl'),chips=[].slice.call(document.querySelectorAll('.fchip')),cards=[].slice.call(document.querySelectorAll('#grid .bcard')),cnt=document.getElementById('count'),none=document.getElementById('none');
  var f=new URLSearchParams(location.search).get('c')||'';
  function norm(s){return (s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'')}
  function run(){var t=norm(q.value.trim()),l=fl.value,n=0;chips.forEach(function(c){c.setAttribute('aria-pressed',String(c.dataset.f===f))});
  cards.forEach(function(el){var ok=(!t||norm(el.dataset.s).indexOf(t)>-1)&&(!f||el.dataset.c.split(' ').indexOf(f)>-1)&&(!l||el.dataset.l.split(' ').indexOf(l)>-1);el.hidden=!ok;if(ok)n++});cnt.textContent=window.i18n.t('cat.count',{n:n});none.hidden=n>0}
  chips.forEach(function(c){c.addEventListener('click',function(){f=c.dataset.f;run()})});[q,fl].forEach(function(el){el.addEventListener('input',run)});document.addEventListener('le:lang',run);run()})();
  </script>`;
  out("catalogue.html", shell({
    title: "Publications — LES ÉLITES PUBLISHING HOUSE", desc: fr("pub.sub"), path: "/catalogue", page: "catalogue.html", body, scripts,
    jsonld: { "@context": "https://schema.org", "@type": "ItemList", itemListElement: D.books.map((b, i) => ({ "@type": "ListItem", position: i + 1, url: `${ORIGIN}/livres/${b.id}` })) },
  }));
}

// ---------- book pages ----------
for (const b of D.books) {
  const a = author(b);
  const others = D.books.filter((x) => x.id !== b.id && (x.author === b.author || x.collections.some((c) => b.collections.includes(c)))).slice(0, 4);
  const body = `  <main id="contenu" class="sub-main sub-dark">
    <div class="wrap">
      <p class="crumbs"><a href="../catalogue.html" data-i18n="nav.books">Publications</a> / <span data-i18n="book.${b.id}.title">${esc(b.fr.title)}</span></p>
      <article class="book-hero">
        <div>
          <div class="book-stage" data-book3d tabindex="0" role="img" aria-label="${esc(b.fr.title)} — ${esc(a.name)}" style="--spine:${b.spine}">
            <div class="b3${b.poster ? " b3-poster" : ""}"><div class="b-front" style="background-image:url('../${b.cover}')"></div><div class="b-back"><img src="../assets/brand/emblem-gold.png" alt=""></div><div class="b-spine"><span>${esc(b.en.title)}</span></div><div class="b-pages"></div><div class="b-top"></div></div>
            <span class="b-shadow"></span>
          </div>
          <p class="book-hint" data-i18n="pub.drag">${esc(fr("pub.drag"))}</p>
        </div>
        <div class="book-info">
          <div class="badges">${b.status === "new" ? '<span class="badge solid" data-i18n="b.new">Nouveauté</span>' : ""}${b.imprint ? '<span class="badge" data-i18n="b.imprint">Publié par Les Élites</span>' : ""}${b.kicker ? `<span class="badge">${esc(b.kicker)}</span>` : ""}</div>
          <h1 class="title" data-split data-i18n="book.${b.id}.title">${esc(b.fr.title)}</h1>
          ${b.fr.title !== b.en.title ? `<p class="orig" lang="en">${esc(b.en.title)}</p>` : ""}
          <p class="byline"><span data-i18n="pub.by">par</span> <a href="../auteurs/${a.id}.html">${esc(a.name)}</a></p>
          ${b.fr.desc ? `<p class="body body-lg" data-reveal data-i18n="book.${b.id}.desc">${esc(b.fr.desc)}</p>` : `<p class="fine" data-i18n="pub.descSoon">${esc(fr("pub.descSoon"))}</p>`}
          ${b.fr.statement ? `<blockquote class="quote" data-reveal>${esc(b.fr.statement)}</blockquote>` : ""}
          ${b.quote ? `<blockquote class="quote" data-reveal lang="en">“${esc(b.quote)}”</blockquote>` : ""}
          ${b.tags ? `<div class="pills">${b.tags.fr.map((t, i) => `<span class="pill" data-i18n="book.${b.id}.tag${i}">${esc(t)}</span>`).join("")}</div>` : ""}
          <dl class="meta">
            <dt data-i18n="pub.genre">${esc(fr("pub.genre"))}</dt><dd>${b.collections.map((c) => `<a href="../catalogue.html?c=${c}" data-coll="${c}">${esc(coll(c).fr)}</a>`).join(" · ")}</dd>
            <dt data-i18n="pub.langs">${esc(fr("pub.langs"))}</dt><dd>${esc(b.languages.join(", "))}</dd>
          </dl>
          <div class="ctas left">${buyBtn(b, "../")}<a class="btn btn-ghost" href="../auteurs/${a.id}.html">${esc(a.name)}</a></div>
          ${b.gallery ? `<div class="thumbs" style="margin-top:26px">${b.gallery.map((g) => `<img src="../${g}" alt="" loading="lazy" style="width:150px">`).join("")}</div>` : ""}
        </div>
      </article>
      ${others.length ? `<h2 class="section-h" data-split data-i18n="pub.related">${esc(fr("pub.related"))}</h2><div class="bgrid" data-stagger>${others.map((x) => bookCard(x, "../")).join("")}</div>` : ""}
    </div>
  </main>`;
  const jsonld = {
    "@context": "https://schema.org", "@type": "Book", name: b.en.title, alternateName: b.fr.title !== b.en.title ? b.fr.title : undefined,
    description: b.en.desc || undefined, inLanguage: b.languages, image: `${ORIGIN}/${b.cover}`, url: `${ORIGIN}/livres/${b.id}`,
    author: { "@type": a.house ? "Organization" : "Person", name: a.name },
    ...(b.imprint ? { publisher: { "@type": "Organization", name: D.site.name } } : {}),
    ...(b.buy ? { offers: { "@type": "Offer", url: b.buy.url } } : {}),
  };
  out(`livres/${b.id}.html`, shell({ title: `${b.fr.title} — ${a.name} | LES ÉLITES`, desc: b.fr.desc || `${b.fr.title}, ${a.name}. LES ÉLITES PUBLISHING HOUSE.`, path: `/livres/${b.id}`, base: "../", page: "catalogue.html", body, image: b.cover, jsonld }));
}

// ---------- author pages ----------
for (const a of D.authors) {
  const books = D.booksBy(a.id);
  const body = `  <main id="contenu" class="sub-main sub-dark">
    <div class="wrap">
      <p class="crumbs"><a href="../catalogue.html#auteurs" data-i18n="nav.authors">Auteurs</a> / ${esc(a.name)}</p>
      <div class="author-hero">
        ${a.photo ? `<img class="ph" src="../${a.photo}" alt="${esc(a.photoAlt ? a.photoAlt.fr : a.name)}" data-reveal="zoom">` : `<span class="ph ph-xl" aria-hidden="true">${esc(a.name.split(" ").map((w) => w[0]).slice(0, 2).join(""))}</span>`}
        <div><h1 class="title title-xl" data-split>${esc(a.name)}</h1>${a.bio ? `<p class="body">${esc(a.bio.fr || a.bio)}</p>` : `<p class="fine" data-i18n="a.bioSoon">Biographie à venir.</p>`}</div>
      </div>
      <h2 class="section-h" data-split data-i18n="a.books">Publications</h2>
      <div class="bgrid" data-stagger>${books.map((x) => bookCard(x, "../")).join("")}</div>
    </div>
  </main>`;
  out(`auteurs/${a.id}.html`, shell({ title: `${a.name} | LES ÉLITES`, desc: `${a.name} — ${books.map((b) => b.fr.title).join(", ")}. LES ÉLITES PUBLISHING HOUSE.`, path: `/auteurs/${a.id}`, base: "../", page: "catalogue.html", body,
    jsonld: { "@context": "https://schema.org", "@type": a.house ? "Organization" : "Person", name: a.name, url: `${ORIGIN}/auteurs/${a.id}` } }));
}

// ---------- contact.html ----------
const contactForm = () => `<form class="form" id="contactForm" data-kind="contact" novalidate>
          <div class="grid2">
            <label><span data-i18n="f.name">Nom complet</span><input name="name" required maxlength="120" autocomplete="name"></label>
            <label><span data-i18n="f.email">Adresse email</span><input name="email" type="email" required maxlength="200" autocomplete="email"></label>
          </div>
          <div class="grid2">
            <label><span data-i18n="f.phone">Téléphone (facultatif)</span><input name="phone" type="tel" maxlength="40" autocomplete="tel"></label>
            <label><span data-i18n="ct.type">${esc(fr("ct.type"))}</span><select name="type" id="contactType">
              <option value="manuscript" data-i18n="ct.t1">${esc(fr("ct.t1"))}</option><option value="services" data-i18n="ct.t2">${esc(fr("ct.t2"))}</option><option value="partnership" data-i18n="ct.t3">${esc(fr("ct.t3"))}</option><option value="order" data-i18n="ct.t4">${esc(fr("ct.t4"))}</option><option value="other" data-i18n="ct.t5">${esc(fr("ct.t5"))}</option>
            </select></label>
          </div>
          <label><span data-i18n="ct.subject">${esc(fr("ct.subject"))}</span><input name="subject" id="contactSubject" required maxlength="200"></label>
          <label><span data-i18n="f.message">Message</span><textarea name="message" required maxlength="4000" rows="6" data-i18n="ct.msgPh" data-i18n-attr="placeholder" placeholder="${esc(fr("ct.msgPh"))}"></textarea></label>
          <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
          <label class="check"><input type="checkbox" name="consent" required><span data-i18n="f.consent">J’accepte que mes données soient utilisées pour traiter ma demande, conformément à la politique de confidentialité.</span></label>
          <button class="btn btn-gold" type="submit" data-i18n="f.send">Envoyer</button>
          <p class="form-status" role="status" aria-live="polite"></p>
          ${T("p", "ct.privacy", 'class="fine"')}
        </form>`;
{
  const c = D.site.contact;
  const body = `  <main id="contenu" class="sub-main sub-dark">
    <section class="hero-sub">
      ${dust()}
      <div class="wrap">
        ${T("p", "ct.badge", 'class="kicker" data-reveal')}
        ${T("h1", "ct.title", 'class="title title-xl" data-split')}
      </div>
    </section>
    <section class="wrap contact-grid">
      <aside class="contact-panel" data-reveal="left">
        ${T("h2", "ct.panelTitle", 'class="title title-sm"')}
        ${T("p", "ct.panelDesc", 'class="body"')}
        <a class="cline" href="mailto:${esc(c.email)}"><small data-i18n="ct.email">Email</small><span>${esc(c.email)}</span></a>
        <a class="cline" href="${esc(c.phoneHref)}"><small data-i18n="ct.phone">Téléphone</small><span>${esc(c.phone)}</span></a>
        <a class="cline" href="${esc(c.mapHref)}" target="_blank" rel="noopener"><small data-i18n="ct.address">Adresse</small><span>${esc(c.address)}</span></a>
        <a class="btn btn-ghost" href="manuscrit.html" data-i18n="nav.submit">${esc(fr("nav.submit"))}</a>
      </aside>
      <div data-reveal="right">${contactForm()}</div>
    </section>
  </main>`;
  out("contact.html", shell({ title: "Contact — LES ÉLITES PUBLISHING HOUSE", desc: fr("ct.panelDesc"), path: "/contact", page: "contact.html", body,
    jsonld: { "@context": "https://schema.org", "@type": "ContactPage", url: ORIGIN + "/contact", mainEntity: { "@type": "Organization", name: D.site.name, email: c.email, telephone: c.phone } } }));
}

// ---------- manuscrit.html ----------
{
  const body = `  <main id="contenu" class="sub-main sub-dark">
    <section class="hero-sub">
      ${dust()}
      <div class="wrap narrow">
        <p class="kicker" data-reveal data-i18n="lab.kicker">L’Atelier des Auteurs</p>
        <h1 class="title title-xl" data-split data-i18n="m.title">Soumettre un manuscrit</h1>
        ${T("p", "ct.panelDesc", 'class="lead left" data-reveal style="--delay:.3s"')}
      </div>
    </section>
    <section class="wrap narrow" data-reveal>
      <form class="form" id="msForm" data-kind="manuscript" novalidate>
        <div class="grid2">
          <label><span data-i18n="f.name">Nom complet</span><input name="name" required maxlength="120" autocomplete="name"></label>
          <label><span data-i18n="f.email">Adresse email</span><input name="email" type="email" required maxlength="200" autocomplete="email"></label>
        </div>
        <div class="grid2">
          <label><span data-i18n="f.phone">Téléphone (facultatif)</span><input name="phone" type="tel" maxlength="40" autocomplete="tel"></label>
          <label><span data-i18n="f.country">Pays</span><input name="country" required maxlength="80" autocomplete="country-name"></label>
        </div>
        <label><span data-i18n="m.mtitle">Titre du manuscrit</span><input name="title" required maxlength="200"></label>
        <div class="grid2">
          <label><span data-i18n="m.genre">Genre</span><input name="genre" required maxlength="80" list="genres"></label>
          <label><span data-i18n="m.lang">Langue du manuscrit</span><input name="language" required maxlength="60" list="langs"></label>
        </div>
        <datalist id="genres">${D.collections.map((c) => `<option value="${esc(c.fr)}">`).join("")}<option value="Essai"><option value="Témoignage / Biographie"><option value="Théologie"></datalist>
        <datalist id="langs"><option value="Français"><option value="English"><option value="Lingala"><option value="Swahili"><option value="Kikongo"><option value="Português"></datalist>
        <label><span data-i18n="m.summary">Résumé du projet</span><textarea name="summary" required maxlength="3000" rows="6"></textarea></label>
        <div class="grid2">
          <label><span data-i18n="m.length">Nombre de mots ou de pages</span><input name="length" maxlength="60"></label>
          <label><span data-i18n="m.file">Fichier du manuscrit (PDF, DOCX, DOC, ODT, RTF — 20 Mo max.)</span><input name="file" type="file" required accept=".pdf,.docx,.doc,.odt,.rtf"></label>
        </div>
        <label><span data-i18n="m.more">Message complémentaire</span><textarea name="message" maxlength="3000" rows="3"></textarea></label>
        <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
        <label class="check"><input type="checkbox" name="consent" required><span><span data-i18n="f.consent">J’accepte que mes données soient utilisées pour traiter ma demande, conformément à la politique de confidentialité.</span> <a href="confidentialite.html" data-i18n="foot.privacy">Confidentialité</a></span></label>
        <button class="btn btn-gold" type="submit" data-i18n="m.send">Envoyer mon manuscrit</button>
        <p class="form-status" role="status" aria-live="polite"></p>
      </form>
      <h2 class="sub" data-i18n="m.statusTitle">Les étapes de votre soumission</h2>
      <ol class="status-track"><li data-i18n="st.received">Reçu</li><li data-i18n="st.review">En évaluation</li><li data-i18n="st.info">Informations complémentaires</li><li data-i18n="st.decision">Décision communiquée</li></ol>
      ${T("p", "ct.privacy", 'class="fine"')}
    </section>
  </main>`;
  out("manuscrit.html", shell({ title: "Soumettre un manuscrit — LES ÉLITES PUBLISHING HOUSE", desc: fr("ct.panelDesc"), path: "/manuscrit", page: "manuscrit.html", body }));
}

// ---------- confidentialite.html ----------
{
  const c = D.site.contact;
  const body = `  <main id="contenu" class="sub-main sub-dark"><div class="wrap narrow prose">
    <h1 class="title" data-split>Confidentialité</h1>
    <p class="fine">LES ÉLITES Publishing House · ${esc(c.address)} · <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>
    <h2>Ce que nous collectons</h2><p>Uniquement ce que vous saisissez dans nos formulaires : nom, adresse email, téléphone (facultatif), pays, votre message et, pour une soumission, les informations sur le manuscrit et le fichier joint.</p>
    <h2>Pourquoi</h2><p>Pour répondre à votre demande (réponse sous 5 jours ouvrables) et, pour un manuscrit, pour l’évaluer. Rien n’est revendu ni utilisé à des fins publicitaires.</p>
    <h2>Où et comment</h2><p>Les données sont stockées dans une base de données et un espace de stockage privés, accessibles uniquement à l’équipe éditoriale autorisée. Les manuscrits ne sont jamais publics. Votre adresse IP n’est pas conservée : seule une empreinte irréversible sert à limiter les envois abusifs.</p>
    <h2>Combien de temps</h2><p>Le temps nécessaire au traitement de votre demande ou à l’évaluation de votre manuscrit. Vous pouvez demander la suppression de vos données à tout moment.</p>
    <h2>Vos droits</h2><p>Accès, rectification, suppression : écrivez à <a href="mailto:${esc(c.email)}">${esc(c.email)}</a> ou via la <a href="contact.html">page contact</a>.</p>
    <p class="fine">Ce site n’utilise ni cookie publicitaire ni outil de suivi. Vos préférences d’affichage (langue, animations) restent dans votre navigateur.</p>
  </div></main>`;
  out("confidentialite.html", shell({ title: "Confidentialité — LES ÉLITES PUBLISHING HOUSE", desc: "Comment LES ÉLITES traite les données de ses formulaires.", path: "/confidentialite", page: "", body }));
}

// ---------- sitemap ----------
{
  const paths = ["/", "/maison", "/catalogue", "/services", "/contact", "/manuscrit", "/confidentialite", ...D.books.map((b) => `/livres/${b.id}`), ...D.authors.map((a) => `/auteurs/${a.id}`)];
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
