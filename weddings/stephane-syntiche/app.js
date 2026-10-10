/* STEPHANE & SYNTICHE — guest site behaviour.
 *
 * Content comes from /api/content (bundled defaults + dashboard edits), with
 * /content.json as the fallback so the page renders even with no backend.
 * Every value that is null is shown as "to be announced" — never invented.
 * All user-supplied text is written with textContent, never innerHTML.
 * Animation lives in motion.js; this file works with or without it.
 */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var t = function (k, v) { return window.i18n.t(k, v); };
  var lang = function () { return window.i18n.current(); };

  var C = null;            // site content
  var invite = null;       // the guest's own invitation (guest view)
  var token = null;        // CODE.SIG
  var backend = true;      // false once the API says "not configured"
  var rsvpEditing = false;

  // ------------------------------------------------------------- helpers --
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (attrs[k] == null || attrs[k] === false) continue;
      if (k === "text") el.textContent = attrs[k];
      else if (k === "class") el.className = attrs[k];
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }

  /** A bilingual field {en, fr} → the current language, falling back to the other. */
  function L(v) {
    if (v == null) return null;
    if (typeof v === "string") return v || null;
    return v[lang()] || v[lang() === "fr" ? "en" : "fr"] || null;
  }

  function api(path, body) {
    return fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {})
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) { data._status = r.status; return data; });
      });
  }

  function storage(kind) { try { return window[kind]; } catch (e) { return null; } }
  function sget(kind, k) { var s = storage(kind); try { return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function sset(kind, k, v) { var s = storage(kind); try { if (s) v == null ? s.removeItem(k) : s.setItem(k, v); } catch (e) { /* ignore */ } }

  // -------------------------------------------------------- date & time --
  function ymd(s) { var p = String(s).split("-").map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)); }
  function fmtDate(s, withWeekday) {
    var o = { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" };
    if (withWeekday) o.weekday = "long";
    var out = new Intl.DateTimeFormat(lang() === "fr" ? "fr-FR" : "en-US", o).format(ymd(s));
    return lang() === "fr" ? out.charAt(0).toUpperCase() + out.slice(1) : out;
  }
  function fmtTime(hhmm) {
    if (!hhmm) return null;
    var p = hhmm.split(":").map(Number);
    if (lang() === "fr") return p[0] + " h " + String(p[1]).padStart(2, "0");
    var h12 = p[0] % 12 || 12;
    return h12 + ":" + String(p[1]).padStart(2, "0") + " " + (p[0] < 12 ? "AM" : "PM");
  }
  /** Local wall-clock time in a zone → the UTC instant (handles DST). */
  function zonedToUtc(date, time, tz) {
    var d = date.split("-").map(Number), tm = (time || "00:00").split(":").map(Number);
    var guess = Date.UTC(d[0], d[1] - 1, d[2], tm[0], tm[1]);
    var parts = {};
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(guess)).forEach(function (p) { parts[p.type] = p.value; });
    var asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    return new Date(guess - (asLocal - guess));
  }
  function rsvpClosed() {
    var dl = C.rsvp && C.rsvp.deadline;
    if (!dl) return false;
    return Date.now() > zonedToUtc(dl, "23:59", C.timezone).getTime() + 59000;
  }

  // ------------------------------------------------------------- photos --
  function photo(id) {
    for (var i = 0; i < C.photos.length; i++) if (C.photos[i].id === id) return C.photos[i];
    return C.photos[0];
  }
  function setImg(img, p, sizes) {
    if (!p) return;
    if (/^https?:/.test(p.src)) { img.src = p.src; img.removeAttribute("srcset"); }
    else {
      var base = p.src.replace(/^\//, "");   // relative: works at / and under a sub-path
      img.srcset = base + "-720.webp 720w, " + base + "-1400.webp 1400w";
      img.sizes = sizes || "100vw";
      img.src = base + "-1400.webp";
    }
    if (p.w && p.h) { img.width = p.w; img.height = p.h; }
    img.style.objectPosition = p.focus || "50% 50%";
  }

  // ------------------------------------------------------------- render --
  function fills() {
    var place = C.city + ", " + C.region;
    var vals = {
      dateLong: fmtDate(C.date),
      dateFull: fmtDate(C.date, true),
      placeShort: place,
      placeLong: place + ", " + (lang() === "fr" && C.country === "USA" ? "États-Unis" : C.country),
      welcome: invite ? t("welcome", { name: invite.greeting || invite.label }) : ""
    };
    $$("[data-fill]").forEach(function (el) {
      var k = el.getAttribute("data-fill");
      if (k === "welcome") { el.hidden = !invite; }
      if (vals[k] != null) el.textContent = vals[k];
    });
    $$("[data-couple]").forEach(function (el) { el.textContent = C.couple[el.getAttribute("data-couple")]; });
    document.title = C.couple.a + " & " + C.couple.b + " — " + t("hero.subtitle");
  }

  function scenes() {
    $$("img[data-scene]").forEach(function (img) {
      var p = photo(C.scenes[img.getAttribute("data-scene")]);
      setImg(img, p, img.closest(".soul, .crystal") ? "(min-width: 900px) 40vw, 80vw" : "100vw");
    });
  }

  var STORY_FX = ["curtain", "focus", "slide", "iris", "zoom"];
  function renderStory() {
    var list = $("#storyList"); list.textContent = "";
    var roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
    C.story.forEach(function (m, i) {
      var p = photo(m.photo);
      var img = h("img", { alt: L(p.alt) || "", loading: "lazy", decoding: "async" });
      setImg(img, p, "(min-width: 900px) 45vw, 92vw");
      var text = L(m.text);
      list.appendChild(h("li", { class: "milestone", "data-fx": STORY_FX[i % STORY_FX.length] }, [
        h("div", { class: "ms-media" }, [h("div", { class: "ms-img" }, [img])]),
        h("div", { class: "ms-copy" }, [
          h("span", { class: "ms-num", "aria-hidden": "true", text: roman[i] || String(i + 1) }),
          m.when ? h("p", { class: "eyebrow", text: fmtDate(m.when) }) : null,
          h("h3", { class: "ms-title", text: L(m.title) }),
          h("p", { class: text ? "ms-text" : "ms-text ms-text--pending", text: text || t("story.pending") })
        ])
      ]));
    });
  }

  function calendarLinks(kind) {
    var ev = C[kind], title = C.couple.a + " & " + C.couple.b + " — " + t(kind === "ceremony" ? "ev.ceremony" : "ev.reception");
    var where = [ev.venue, ev.address].filter(Boolean).join(", ") || C.city + ", " + C.region;
    var compact = C.date.replace(/-/g, "");
    var gDates, icsStart, icsEnd;
    function utcStamp(d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
    if (ev.start) {
      var s = zonedToUtc(C.date, ev.start, C.timezone), e = ev.end ? zonedToUtc(C.date, ev.end, C.timezone) : s;
      gDates = utcStamp(s) + "/" + utcStamp(e);
      icsStart = "DTSTART:" + utcStamp(s); icsEnd = ev.end ? "DTEND:" + utcStamp(e) : null;
    } else {
      var next = new Date(ymd(C.date).getTime() + 864e5).toISOString().slice(0, 10).replace(/-/g, "");
      gDates = compact + "/" + next;
      icsStart = "DTSTART;VALUE=DATE:" + compact; icsEnd = "DTEND;VALUE=DATE:" + next;
    }
    var google = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(title) +
      "&dates=" + gDates + "&location=" + encodeURIComponent(where) + "&details=" + encodeURIComponent(location.origin + "/");
    var esc = function (s) { return String(s).replace(/([,;\\])/g, "\\$1"); };
    var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Stephane & Syntiche//Wedding//EN", "BEGIN:VEVENT",
      "UID:" + kind + "-" + compact + "@stephane-syntiche", "DTSTAMP:" + utcStamp(new Date()), icsStart, icsEnd,
      "SUMMARY:" + esc(title), "LOCATION:" + esc(where), "URL:" + location.origin + "/", "END:VEVENT", "END:VCALENDAR"]
      .filter(Boolean).join("\r\n");
    return { google: google, ics: "data:text/calendar;charset=utf-8," + encodeURIComponent(ics) };
  }

  function renderEvents() {
    var grid = $("#eventGrid"); grid.textContent = "";
    ["ceremony", "reception"].forEach(function (kind) {
      var ev = C[kind], cal = calendarLinks(kind);
      var time = ev.start ? fmtTime(ev.start) + (ev.end ? " – " + fmtTime(ev.end) : "") : null;
      var q = encodeURIComponent([ev.venue, ev.address].filter(Boolean).join(", "));
      var menu = h("details", { class: "dd" }, [
        h("summary", { class: "btn btn--ghost btn--sm", text: t("ev.calendar") }),
        h("div", { class: "dd-menu" }, [
          h("a", { href: cal.google, target: "_blank", rel: "noopener", text: t("ev.google") }),
          h("a", { href: cal.ics, download: kind + ".ics", text: t("ev.ics") })
        ])
      ]);
      var dirs = ev.address
        ? h("details", { class: "dd" }, [
            h("summary", { class: "btn btn--navy btn--sm", text: t("ev.directions") }),
            h("div", { class: "dd-menu" }, [
              h("a", { href: "https://www.google.com/maps/search/?api=1&query=" + q, target: "_blank", rel: "noopener", text: t("ev.maps") }),
              h("a", { href: "https://maps.apple.com/?q=" + q, target: "_blank", rel: "noopener", text: t("ev.apple") })
            ])
          ])
        : h("p", { class: "ev-hint", text: t("ev.noAddr") });
      grid.appendChild(h("article", { class: "event-card" }, [
        h("span", { class: "ev-icon", "aria-hidden": "true", text: kind === "ceremony" ? "◇" : "✦" }),
        h("h3", { class: "ev-title", text: t(kind === "ceremony" ? "ev.ceremony" : "ev.reception") }),
        h("p", { class: "ev-venue" + (ev.venue ? "" : " tba"), text: ev.venue || t("ev.venueTba") }),
        h("p", { class: "ev-line" + (ev.address ? "" : " tba"), text: ev.address || t("ev.addrTba") }),
        h("p", { class: "ev-line ev-time" + (time ? "" : " tba"), text: time || t("ev.timeTba") }),
        L(ev.note) ? h("p", { class: "ev-note", text: L(ev.note) }) : null,
        h("div", { class: "ev-actions" }, [dirs, menu, h("a", { class: "btn btn--ghost btn--sm", href: "#program", text: t("ev.program") })])
      ]));
    });

    var facts = $("#facts"); facts.textContent = "";
    var contact = C.contact && [C.contact.name, C.contact.phone, C.contact.email].filter(Boolean).join(" · ");
    [["facts.dress", L(C.dress_code)], ["facts.deadline", C.rsvp && C.rsvp.deadline ? fmtDate(C.rsvp.deadline) : null], ["facts.contact", contact || null]]
      .forEach(function (f) {
        facts.appendChild(h("div", { class: "fact" }, [h("dt", { text: t(f[0]) }), h("dd", { class: f[1] ? "" : "tba", text: f[1] || t("facts.tba") })]));
      });
  }

  function renderProgram() {
    var list = $("#programList"); list.textContent = "";
    var items = (C.program || []).slice().sort(function (a, b) { return String(a.time || "").localeCompare(String(b.time || "")); });
    $("#program .program-wrap").classList.toggle("is-empty", !items.length);
    if (!items.length) { list.appendChild(h("li", { class: "pg-empty", text: t("program.empty") })); return; }
    items.forEach(function (it) {
      list.appendChild(h("li", { class: "pg-item" }, [
        h("span", { class: "pg-dot", "aria-hidden": "true" }),
        h("p", { class: "pg-time", text: fmtTime(it.time) || "" }),
        h("h3", { class: "pg-title", text: L(it.title) || "" }),
        L(it.text) ? h("p", { class: "pg-text", text: L(it.text) }) : null,
        L(it.place) ? h("p", { class: "pg-place", text: L(it.place) }) : null
      ]));
    });
  }

  function renderGifts() {
    var g = C.gifts || {};
    $("#gifts").hidden = g.enabled === false;
    $("#giftMsg").textContent = L(g.message) || "";
    var box = $("#giftActions"); box.textContent = "";
    if (g.registry_url) box.appendChild(h("a", { class: "btn btn--navy", href: g.registry_url, target: "_blank", rel: "noopener", text: t("gifts.registry") }));
    if (g.fund_url) box.appendChild(h("a", { class: "btn btn--gold", href: g.fund_url, target: "_blank", rel: "noopener", text: L(g.fund_label) || t("gifts.fund") }));
    box.appendChild(h("a", { class: "btn btn--ghost", href: "#guestbook", text: t("gifts.message") }));
    if (!g.registry_url && !g.fund_url) box.appendChild(h("p", { class: "gift-soon", text: t("gifts.soon") }));
  }

  // ------------------------------------------------------------ gallery --
  var galFilter = "all", galItems = [], lbIndex = 0;
  function renderGallery() {
    var cats = ["all"];
    C.photos.forEach(function (p) { if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category); });
    var f = $("#galFilters"); f.textContent = "";
    cats.forEach(function (c) {
      f.appendChild(h("button", { type: "button", class: "chip", "aria-pressed": String(c === galFilter), text: t("gal." + c),
        onclick: function () { galFilter = c; renderGallery(); } }));
    });
    var grid = $("#galGrid"); grid.textContent = "";
    galItems = C.photos.filter(function (p) { return galFilter === "all" || p.category === galFilter; });
    galItems.forEach(function (p, i) {
      var img = h("img", { alt: L(p.alt) || "", loading: "lazy", decoding: "async" });
      setImg(img, p, "(min-width: 1100px) 30vw, (min-width: 640px) 45vw, 92vw");
      grid.appendChild(h("li", { class: "gal-item" }, [
        h("button", { type: "button", "aria-label": t("gal.open", { alt: L(p.alt) || "" }), onclick: function () { openLightbox(i); } }, [img])
      ]));
    });
    document.dispatchEvent(new Event("ss:gallery"));
  }
  function openLightbox(i) {
    var lb = $("#lightbox"); lbIndex = (i + galItems.length) % galItems.length;
    var p = galItems[lbIndex], img = $("img", lb);
    setImg(img, p, "100vw"); img.alt = L(p.alt) || "";
    $("figcaption", lb).textContent = L(p.alt) || "";
    if (!lb.open) { lb.showModal ? lb.showModal() : lb.setAttribute("open", ""); }
  }
  function initLightbox() {
    var lb = $("#lightbox");
    $(".lb-prev", lb).addEventListener("click", function () { openLightbox(lbIndex - 1); });
    $(".lb-next", lb).addEventListener("click", function () { openLightbox(lbIndex + 1); });
    $(".lb-close", lb).addEventListener("click", function () { lb.close ? lb.close() : lb.removeAttribute("open"); });
    lb.addEventListener("click", function (e) { if (e.target === lb) lb.close(); });
    lb.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") openLightbox(lbIndex - 1);
      if (e.key === "ArrowRight") openLightbox(lbIndex + 1);
    });
    var x0 = null;
    lb.addEventListener("pointerdown", function (e) { x0 = e.clientX; });
    lb.addEventListener("pointerup", function (e) {
      if (x0 == null) return; var dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) openLightbox(lbIndex + (dx < 0 ? 1 : -1));
    });
  }

  // ---------------------------------------------------------------- FAQ --
  function autoAnswer(kind) {
    var dl = C.rsvp && C.rsvp.deadline ? fmtDate(C.rsvp.deadline) : null;
    switch (kind) {
      case "when": return C.ceremony.start ? t("faq.auto.whenTime", { date: fmtDate(C.date, true), time: fmtTime(C.ceremony.start) }) : t("faq.auto.when", { date: fmtDate(C.date, true) });
      case "where": return C.ceremony.venue && C.ceremony.address ? t("faq.auto.where", { venue: C.ceremony.venue, address: C.ceremony.address }) : t("faq.auto.whereTba");
      case "rsvp": return dl ? t("faq.auto.rsvpBy", { date: dl }) : t("faq.auto.rsvp");
      case "dress": return L(C.dress_code);
      case "registry": return C.gifts && C.gifts.enabled !== false && (C.gifts.registry_url || C.gifts.fund_url) ? t("faq.auto.registry") : null;
      case "update": return C.rsvp && C.rsvp.allow_update === false ? t("faq.auto.updateNo") : dl ? t("faq.auto.updateBy", { date: dl }) : t("faq.auto.update");
      case "contact":
        var c = C.contact || {};
        return [c.name, c.phone, c.email].filter(Boolean).join(" · ") || null;
    }
    return null;
  }
  function renderFaq() {
    var box = $("#faqList"), open = {};
    $$("details", box).forEach(function (d) { if (d.open) open[d.dataset.id] = true; });
    box.textContent = "";
    (C.faq || []).forEach(function (f) {
      var a = L(f.a) || (f.auto ? autoAnswer(f.auto) : null);
      box.appendChild(h("details", { class: "faq-item", "data-id": f.id, open: open[f.id] || null }, [
        h("summary", {}, [h("span", { text: L(f.q) }), h("i", { class: "pm", "aria-hidden": "true" })]),
        h("div", { class: "faq-a" }, [h("p", { class: a ? "" : "tba", text: a || t("faq.tba") })])
      ]));
    });
  }

  // ---------------------------------------------------------- countdown --
  var cdTimer = 0;
  function countdown() {
    var target = zonedToUtc(C.date, C.ceremony.start || "00:00", C.timezone).getTime();
    $("#cdNote").textContent = C.ceremony.start ? t("cd.to", { time: fmtTime(C.ceremony.start) }) : t("cd.noTime");
    var els = { d: $("[data-cd=d]"), h: $("[data-cd=h]"), m: $("[data-cd=m]"), s: $("[data-cd=s]") };
    function set(el, v) { if (el.textContent !== v) { el.textContent = v; el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick"); } }
    function tick() {
      var ms = target - Date.now();
      if (ms <= 0) {
        $("#cd").hidden = true; $("#cdDone").hidden = false; $("#cdNote").hidden = true;
        clearInterval(cdTimer); return;
      }
      var s = Math.floor(ms / 1000);
      set(els.d, String(Math.floor(s / 86400)));
      set(els.h, String(Math.floor(s % 86400 / 3600)).padStart(2, "0"));
      set(els.m, String(Math.floor(s % 3600 / 60)).padStart(2, "0"));
      set(els.s, String(s % 60).padStart(2, "0"));
    }
    clearInterval(cdTimer); tick(); cdTimer = setInterval(tick, 1000);
  }

  // ---------------------------------------------------------- invitation --
  function readInviteFromUrl() {
    var u = new URL(location.href), tk = u.searchParams.get("invite");
    if (tk) {
      sset("localStorage", "ss.invite", tk);
      // Keep the secret half out of the address bar, screenshots and history.
      u.searchParams.delete("invite");
      history.replaceState(null, "", u.pathname + (u.search ? u.search : "") + u.hash);
    }
    return tk || sget("localStorage", "ss.invite");
  }

  function openInvite(tk) {
    showPane("loading");
    return api("/api/invite", { action: "open", token: tk }).then(function (r) {
      if (r._status === 200 && r.invitation) {
        token = tk; invite = r.invitation; sset("localStorage", "ss.invite", tk);
        if (invite.lang && !window.i18n.chosen() && invite.lang !== lang()) window.i18n.apply(invite.lang, { persist: false });
        else personalize();
        return true;
      }
      // 501 = not configured; no "error" field = no API at all (static hosting).
      if (r._status === 501 || !r.error) backend = false;
      if (r._status === 404) sset("localStorage", "ss.invite", null);
      invite = null; token = null; personalize();
      return r._status;
    }).catch(function () { backend = false; personalize(); return 0; });
  }

  function personalize() {
    fills();
    var name = invite ? invite.greeting || invite.label : null;
    $("#invGreet").textContent = name ? t("inv.dearName", { name: name }) : t("inv.dear");
    var pm = $("#invPersonal"); pm.hidden = !(invite && invite.personal_message);
    pm.textContent = invite && invite.personal_message || "";
    renderRsvp();
  }

  // ---------------------------------------------------------------- RSVP --
  function showPane(name) {
    $$("#rsvpCard .rsvp-pane").forEach(function (p) { p.hidden = p.getAttribute("data-pane") !== name; });
  }

  function errorText(r) {
    var e = r && r.error;
    if (e === "too_many_guests") return t("err.too_many_guests", { max: r.max });
    var k = "err." + e;
    return window.i18n.dict.en[k] ? t(k) : t("err.generic");
  }

  function attendeeRow(i, a) {
    var meals = (C.rsvp && C.rsvp.meals) || [];
    var row = h("li", { class: "attendee" }, [
      h("p", { class: "att-n", text: t("rsvp.guestN", { n: i + 1 }) }),
      h("label", { class: "field" }, [h("span", { text: t("rsvp.name") }), h("input", { name: "att-name", value: a.name || "", maxlength: "120", autocomplete: i === 0 ? "name" : "off", required: true })])
    ]);
    if (meals.length) {
      var sel = h("select", { name: "att-meal" }, [h("option", { value: "", text: t("rsvp.mealChoose") })]);
      meals.forEach(function (m) { sel.appendChild(h("option", { value: m.id, text: L(m.label) || m.id, selected: a.meal === m.id || null })); });
      row.appendChild(h("label", { class: "field" }, [h("span", { text: t("rsvp.meal") }), sel]));
    }
    if (!C.rsvp || C.rsvp.ask_dietary !== false) {
      row.appendChild(h("label", { class: "field" }, [h("span", { text: t("rsvp.dietary") }), h("input", { name: "att-diet", value: a.dietary || "", maxlength: "200" })]));
    }
    if (i > 0) row.appendChild(h("button", { type: "button", class: "att-remove", text: t("rsvp.remove"), onclick: function () { var list = readAttendees(); list.splice(i, 1); drawAttendees(list); } }));
    return row;
  }
  function readAttendees() {
    return $$("#attendeeList .attendee").map(function (li) {
      var m = $("[name=att-meal]", li), d = $("[name=att-diet]", li);
      return { name: $("[name=att-name]", li).value, meal: m ? m.value : null, dietary: d ? d.value : "" };
    });
  }
  function drawAttendees(list) {
    var ol = $("#attendeeList"); ol.textContent = "";
    list.forEach(function (a, i) { ol.appendChild(attendeeRow(i, a)); });
    $("#addAttendee").hidden = list.length >= invite.max_guests;
    $("#seatsNote").textContent = invite.max_guests > 1 ? t("rsvp.seatsN", { n: invite.max_guests }) : t("rsvp.seats1");
  }
  function initialAttendees() {
    if (invite.rsvp.attendees && invite.rsvp.attendees.length) return invite.rsvp.attendees.slice();
    var names = invite.party && invite.party.length ? invite.party : [invite.label];
    return names.slice(0, invite.max_guests).map(function (n) { return { name: n }; });
  }

  function renderRsvp() {
    var dl = C.rsvp && C.rsvp.deadline;
    $("#rsvpDeadline").textContent = dl ? t("rsvp.deadline", { date: fmtDate(dl) }) : "";
    if (C.rsvp && C.rsvp.enabled === false) return showPane("soon");
    if (!invite) return showPane(backend ? "code" : "soon");

    var answered = invite.rsvp.status !== "pending";
    if (answered && !rsvpEditing) return renderDone();
    if (rsvpClosed()) return showPane("closed");

    $("#rsvpHello").textContent = t("rsvp.hello", { name: invite.greeting || invite.label });
    var form = $("#rsvpForm");
    if (form.getAttribute("data-for") !== token) {   // first draw for this invitation
      form.setAttribute("data-for", token);
      if (answered) $$("[name=attending]", form).forEach(function (r) { r.checked = (r.value === "yes") === (invite.rsvp.status === "attending"); });
      form.elements.message.value = invite.rsvp.message || "";
      drawAttendees(initialAttendees());
    } else {
      drawAttendees(readAttendees());                 // language switch: keep what was typed
    }
    $("#attendeesBox").hidden = !$("[name=attending][value=yes]", form).checked;
    showPane("form");
  }

  function renderDone() {
    var yes = invite.rsvp.status === "attending";
    $("#doneTitle").textContent = t(yes ? "rsvp.yesDone" : "rsvp.noDone");
    $("#doneSummary").textContent = yes
      ? t("rsvp.summaryYes", { n: invite.rsvp.seats, names: invite.rsvp.attendees.map(function (a) { return a.name; }).join(", ") })
      : t("rsvp.summaryNo");
    $("#changeRsvp").hidden = (C.rsvp && C.rsvp.allow_update === false) || rsvpClosed();
    showPane("done");
  }

  function initRsvp() {
    var form = $("#rsvpForm"), err = $(".form-error", form);
    form.addEventListener("change", function (e) {
      if (e.target.name === "attending") $("#attendeesBox").hidden = e.target.value !== "yes";
    });
    $("#addAttendee").addEventListener("click", function () {
      var list = readAttendees(); if (list.length >= invite.max_guests) return;
      list.push({ name: "" }); drawAttendees(list);
      var inputs = $$("#attendeeList [name=att-name]"); inputs[inputs.length - 1].focus();
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault(); err.hidden = true;
      var choice = $("[name=attending]:checked", form);
      if (!choice) { err.textContent = t("rsvp.choose"); err.hidden = false; return; }
      var attending = choice.value === "yes";
      var attendees = attending ? readAttendees().map(function (a) { return { name: a.name.trim(), meal: a.meal || null, dietary: a.dietary.trim() }; }) : [];
      if (attending && attendees.some(function (a) { return !a.name; })) { err.textContent = t("rsvp.nameReq"); err.hidden = false; return; }
      var btn = $("button[type=submit]", form); btn.disabled = true; btn.textContent = t("rsvp.sending");
      api("/api/invite", { action: "rsvp", token: token, attending: attending, attendees: attendees, message: form.elements.message.value })
        .then(function (r) {
          if (r._status === 200 && r.invitation) {
            invite = r.invitation; rsvpEditing = false; renderDone();
            $("[data-pane=done]").focus();
            document.dispatchEvent(new CustomEvent("ss:rsvp", { detail: { attending: attending } }));
          } else { err.textContent = errorText(r); err.hidden = false; }
        })
        .catch(function () { err.textContent = t("err.generic"); err.hidden = false; })
        .then(function () { btn.disabled = false; btn.textContent = t("rsvp.send"); });
    });
    $("#changeRsvp").addEventListener("click", function () { rsvpEditing = true; renderRsvp(); });

    var cf = $("#codeForm"), cerr = $(".form-error", cf);
    cf.addEventListener("submit", function (e) {
      e.preventDefault(); cerr.hidden = true;
      var raw = cf.elements.code.value.trim(), tk = raw;
      try { tk = new URL(raw).searchParams.get("invite") || raw; } catch (x) { /* plain code */ }
      var parts = tk.split(".");
      if (parts.length === 2) tk = parts[0].toUpperCase() + "." + parts[1];
      openInvite(tk).then(function (ok) {
        if (ok === true) return;
        showPane(backend ? "code" : "soon");
        cerr.textContent = ok === 429 ? t("err.rate_limited") : t("rsvp.codeBad"); cerr.hidden = !backend;
      });
    });
  }

  // ------------------------------------------------------------ guestbook --
  function loadGuestbook() {
    api("/api/guestbook").then(function (r) { drawGuestbook(r.entries || []); }).catch(function () { drawGuestbook([]); });
  }
  function drawGuestbook(entries) {
    var ul = $("#gbCards"); ul.textContent = "";
    if (!entries.length) { ul.appendChild(h("li", { class: "gb-empty", text: t("gb.empty") })); return; }
    entries.forEach(function (e) {
      ul.appendChild(h("li", { class: "gb-card" }, [h("p", { class: "gb-msg", text: e.message }), h("p", { class: "gb-name", text: "— " + e.name })]));
    });
    document.dispatchEvent(new Event("ss:guestbook"));
  }
  function initGuestbook() {
    var form = $("#gbForm"), err = $(".form-error", form), ok = $(".form-ok", form), started = Date.now();
    form.addEventListener("submit", function (e) {
      e.preventDefault(); err.hidden = true; ok.hidden = true;
      var name = form.elements.name.value.trim(), msg = form.elements.message.value.trim();
      if (!name || msg.length < 2) { err.textContent = t("gb.required"); err.hidden = false; return; }
      var btn = $("button[type=submit]", form); btn.disabled = true;
      api("/api/guestbook", { name: name, message: msg, website: form.elements.website.value, elapsed: Date.now() - started, token: token, lang: lang() })
        .then(function (r) {
          if (r._status === 200) { ok.hidden = false; form.elements.message.value = ""; }
          else { err.textContent = errorText(r); err.hidden = false; }
        })
        .catch(function () { err.textContent = t("err.generic"); err.hidden = false; })
        .then(function () { btn.disabled = false; });
    });
  }

  // ------------------------------------------------------- intro & nav --
  function initIntro() {
    var intro = $("#intro");
    var seen = sget("sessionStorage", "ss.intro");
    if (seen || (location.hash && location.hash.length > 1)) return false;
    intro.hidden = false;
    document.documentElement.classList.add("intro-open");
    function leave() {
      sset("sessionStorage", "ss.intro", "1");
      intro.classList.add("is-leaving");
      document.documentElement.classList.remove("intro-open");
      document.dispatchEvent(new Event("ss:enter"));
      setTimeout(function () { intro.hidden = true; $("#heroNames").setAttribute("tabindex", "-1"); $("#heroNames").focus({ preventScroll: true }); }, 900);
    }
    $("#enterBtn").addEventListener("click", leave);
    $("#skipBtn").addEventListener("click", leave);
    intro.addEventListener("keydown", function (e) { if (e.key === "Escape") leave(); });
    setTimeout(function () { $("#skipBtn").focus({ preventScroll: true }); }, 50);
    return true;
  }

  function initNav() {
    var nav = $("#nav"), burger = $("#burger"), links = $("#navLinks");
    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") !== "true";
      burger.setAttribute("aria-expanded", String(open)); nav.classList.toggle("is-open", open);
    });
    links.addEventListener("click", function (e) { if (e.target.closest("a")) { burger.setAttribute("aria-expanded", "false"); nav.classList.remove("is-open"); } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && nav.classList.contains("is-open")) { burger.click(); burger.focus(); } });
    var onScroll = function () { nav.classList.toggle("is-solid", window.scrollY > window.innerHeight * 0.6); };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

    if ("IntersectionObserver" in window) {
      var map = { home: "home", couple: "home", story: "story", promise: "story", reveal: "wedding", countdown: "wedding", wedding: "wedding", program: "wedding", invitation: "wedding", rsvp: "rsvp", gifts: "gifts", gallery: "gallery", guestbook: "gifts", faq: "faq", finale: "rsvp" };
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          var id = map[e.target.id];
          $$("#navLinks a").forEach(function (a) { a.toggleAttribute("aria-current", a.getAttribute("href") === "#" + id); });
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      $$("main > section").forEach(function (s) { io.observe(s); });
    }
    $$("[data-lang]").forEach(function (b) { b.addEventListener("click", function () { window.i18n.apply(b.getAttribute("data-lang")); }); });
  }

  function initEnvelope() {
    var env = $("#envelope"), seal = $("#envSeal");
    // Without scroll motion nothing would open it on arrival: start open.
    if (!window.gsap || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { env.classList.add("is-open"); seal.setAttribute("aria-expanded", "true"); }
    seal.addEventListener("click", function () {
      var open = !env.classList.contains("is-open");
      env.classList.toggle("is-open", open); seal.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("ss:envelope", function () { env.classList.add("is-open"); seal.setAttribute("aria-expanded", "true"); });
  }

  function initSound() {
    var src = C.music && C.music.src, btn = $("#soundBtn");
    if (!src) return;
    btn.hidden = false;
    var audio = null;
    btn.addEventListener("click", function () {
      if (!audio) { audio = new Audio(src); audio.loop = true; audio.volume = 0.45; }
      if (audio.paused) { audio.play().catch(function () {}); btn.setAttribute("aria-pressed", "true"); }
      else { audio.pause(); btn.setAttribute("aria-pressed", "false"); }
    });
  }

  function credit() {
    var el = $("#photoCredit");
    el.hidden = !C.photo_credit; el.textContent = C.photo_credit ? t("footer.credit", { credit: C.photo_credit }) : "";
  }

  function renderAll() {
    fills(); renderStory(); renderEvents(); renderProgram(); renderGifts(); renderGallery(); renderFaq(); credit();
    countdown(); personalize();
  }

  // ---------------------------------------------------------------- boot --
  function loadContent() {
    return api("/api/content").then(function (r) { if (r._status !== 200 || !r.photos) throw 0; return r; })
      .catch(function () { return fetch("content.json").then(function (r) { return r.json(); }); });
  }

  window.i18n.init();
  var introShown = initIntro();
  initNav(); initLightbox(); initRsvp(); initGuestbook(); initEnvelope();

  loadContent().then(function (content) {
    C = content;
    scenes(); renderAll(); initSound(); loadGuestbook();
    document.addEventListener("ss:lang", function () { renderAll(); document.dispatchEvent(new Event("ss:relayout")); });
    var tk = readInviteFromUrl();
    var ready = tk ? openInvite(tk) : Promise.resolve();
    ready.then(function () {
      document.documentElement.classList.add("is-ready");
      document.dispatchEvent(new CustomEvent("ss:ready", { detail: { intro: introShown } }));
    });
  });

  window.SS = { content: function () { return C; }, invite: function () { return invite; } };
})();
