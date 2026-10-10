/* Wedding dashboard — guests, invitations, content, guestbook, seating.
 * Talks only to /api/admin with the ADMIN_KEY held in sessionStorage.
 * Every value from the database is written with textContent. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var KEY = "ss.admin";
  var key = null, guests = [], tables = [], content = null, integ = {};

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "text") el.textContent = v;
      else if (k === "class") el.className = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    (kids || []).forEach(function (c) { if (c != null && c !== false) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }

  function api(action, extra) {
    var body = Object.assign({ key: key, action: action }, extra || {});
    return fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (r.status === 403) { signOut(); throw new Error("Signed out — key refused."); }
          if (!r.ok) throw new Error(d.error || ("HTTP " + r.status));
          return d;
        });
      });
  }

  var toastT;
  function toast(msg, bad) {
    var t = $("#toast"); t.textContent = msg; t.className = "toast" + (bad ? " toast--bad" : ""); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3800);
  }
  function fail(e) { toast(e.message || String(e), true); }

  // ------------------------------------------------------------ sign in --
  function signOut() { try { sessionStorage.removeItem(KEY); } catch (e) {} key = null; $("#app").hidden = true; $("#login").hidden = false; }
  function signIn(k) {
    key = k;
    return api("integrations").then(function (d) {
      integ = d;
      try { sessionStorage.setItem(KEY, k); } catch (e) {}
      $("#login").hidden = true; $("#app").hidden = false;
      boot();
    });
  }
  $("#loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("#loginForm .error"); err.hidden = true;
    signIn(e.target.elements.key.value.trim()).catch(function (x) {
      err.textContent = /too_many/.test(x.message) ? "Too many attempts — wait 15 minutes." : "That key was not accepted.";
      err.hidden = false; $("#login").hidden = false; $("#app").hidden = true;
    });
  });
  $("#logout").addEventListener("click", signOut);

  // --------------------------------------------------------------- tabs --
  $$("[data-tab]").forEach(function (b) {
    b.addEventListener("click", function () {
      $$("[data-tab]").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
      $$("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== b.getAttribute("data-tab"); });
      var tab = b.getAttribute("data-tab");
      if (tab === "overview") loadOverview();
      if (tab === "guests" || tab === "seating") loadGuests();
      if (tab === "content") loadContent();
      if (tab === "guestbook") loadGuestbook();
    });
  });

  // ----------------------------------------------------------- overview --
  function loadOverview() {
    api("stats").then(function (d) {
      var s = d.stats;
      var date = content ? content.date : "2027-03-13";
      // March 13, 2027 is still Pacific Standard Time (DST starts the 14th).
      $("#daysLeft").textContent = Math.max(0, Math.ceil((Date.parse(date + "T00:00:00-08:00") - Date.now()) / 864e5));
      var tiles = [["Invitations", s.invitations], ["Seats offered", s.invited_seats], ["Shared", s.sent], ["Opened", s.opened],
        ["Attending", s.attending + " · " + s.confirmed_seats + " guests"], ["Declined", s.declined], ["Awaiting reply", s.pending],
        ["Checked in", s.checked_in], ["Guestbook to review", s.guestbook_pending]];
      var box = $("#tiles"); box.textContent = "";
      tiles.forEach(function (t) { box.appendChild(h("div", { class: "tile" }, [h("p", { class: "eyebrow", text: t[0] }), h("p", { class: "tile-n", text: String(t[1]) })])); });
      var n = Math.max(1, s.invitations);
      var bars = $$("#rsvpBar i");
      bars[0].style.width = (s.attending / n * 100) + "%"; bars[1].style.width = (s.declined / n * 100) + "%"; bars[2].style.width = (s.pending / n * 100) + "%";
      var lg = $("#rsvpLegend"); lg.textContent = "";
      [["b-yes", "Attending", s.attending], ["b-no", "Declined", s.declined], ["b-wait", "Pending", s.pending]].forEach(function (l) {
        lg.appendChild(h("li", {}, [h("i", { class: l[0] }), l[1] + " " + l[2]]));
      });
      $("#gbBadge").hidden = !s.guestbook_pending; $("#gbBadge").textContent = s.guestbook_pending;
    }).catch(fail);

    var checks = [
      [integ.database, "Database connected (Supabase)", "Set SUPABASE_URL and SUPABASE_SERVICE_KEY, run the migration."],
      [integ.invite_links, "Personal invitation links enabled", "Set INVITE_SECRET (32+ random characters)."],
      [integ.staff_key, "Door staff key set", "Set STAFF_KEY so staff can check guests in without the admin key."],
      [integ.email, "Email sending (Resend)", "Optional: set RESEND_API_KEY and MAIL_FROM. Without it, share by WhatsApp, SMS or your own email."]
    ];
    var ul = $("#checks"); ul.textContent = "";
    checks.forEach(function (c) { ul.appendChild(h("li", { class: c[0] ? "ok" : "todo" }, [h("strong", { text: (c[0] ? "✓ " : "○ ") + c[1] }), c[0] ? null : h("span", { text: " — " + c[2] })])); });
  }

  // ------------------------------------------------------------- guests --
  var STATUS = { pending: "Pending", attending: "Attending", declined: "Declined" };
  function fmtWhen(iso) { return iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"; }

  function loadGuests() {
    return api("guests.list").then(function (d) {
      guests = d.guests; tables = d.tables || [];
      if (!d.links_enabled) toast("Invitation links are off until INVITE_SECRET is set.", true);
      drawGuests(); drawSeating(); fillGroupOptions(); fillTableOptions();
    }).catch(fail);
  }

  function fillGroupOptions() {
    var groups = Array.from(new Set(guests.map(function (g) { return g.group_name; }).filter(Boolean))).sort();
    var sel = $("#fGroup"), cur = sel.value; sel.length = 1;
    groups.forEach(function (g) { sel.appendChild(h("option", { value: g, text: g })); }); sel.value = cur;
    var dl = $("#groups"); dl.textContent = ""; groups.forEach(function (g) { dl.appendChild(h("option", { value: g })); });
  }
  function fillTableOptions() {
    var sel = $("#guestForm [name=table_id]"); sel.length = 1;
    tables.forEach(function (t) { sel.appendChild(h("option", { value: t.id, text: t.name })); });
  }

  function filtered() {
    var q = $("#q").value.trim().toLowerCase(), st = $("#fStatus").value, gr = $("#fGroup").value;
    return guests.filter(function (g) {
      if (st && g.rsvp_status !== st) return false;
      if (gr && g.group_name !== gr) return false;
      if (!q) return true;
      return [g.label, g.greeting, g.group_name, g.email, g.phone, (g.party || []).join(" ")].join(" ").toLowerCase().indexOf(q) >= 0;
    });
  }

  function inviteText(g) {
    var fr = g.lang === "fr", c = content || { couple: { a: "Stephane", b: "Syntiche" }, date: "2027-03-13", city: "Sumner", region: "Washington" };
    var names = c.couple.a + " & " + c.couple.b, where = c.city + ", " + c.region;
    var when = new Intl.DateTimeFormat(fr ? "fr-FR" : "en-US", { timeZone: "UTC", dateStyle: "long" }).format(new Date(c.date + "T12:00:00Z"));
    return fr
      ? "Bonjour " + (g.greeting || g.label) + ",\n\n" + names + " ont la joie de vous inviter à leur mariage, le " + when + " à " + where + ".\n\nVotre invitation personnelle : " + g.link + "\n\nCe lien vous est personnel."
      : "Dear " + (g.greeting || g.label) + ",\n\n" + names + " joyfully invite you to their wedding on " + when + " in " + where + ".\n\nYour personal invitation: " + g.link + "\n\nThis link is personal to you.";
  }

  function markShared(g, via) {
    api("guests.mark", { ids: [g.id], via: via }).then(function () { g.sent_at = new Date().toISOString(); g.sent_via = via; drawGuests(); }).catch(fail);
  }

  function drawGuests() {
    var tb = $("#guestTable tbody"); tb.textContent = "";
    var list = filtered();
    var seats = list.reduce(function (n, g) { return n + g.max_guests; }, 0);
    $("#guestCount").textContent = list.length + " invitation(s) · " + seats + " seat(s) offered";
    var tname = {}; tables.forEach(function (t) { tname[t.id] = t.name; });
    list.forEach(function (g) {
      var digits = (g.phone || "").replace(/[^\d]/g, "");
      var share = g.link ? [
        h("button", { class: "mini", type: "button", title: "Copy link", text: "Link", onclick: function () {
          navigator.clipboard.writeText(g.link).then(function () { toast("Link copied for " + g.label); markShared(g, "link"); }, function () { prompt("Copy this link:", g.link); });
        } }),
        h("a", { class: "mini", href: "https://wa.me/" + digits + "?text=" + encodeURIComponent(inviteText(g)), target: "_blank", rel: "noopener", text: "WhatsApp", onclick: function () { markShared(g, "whatsapp"); } }),
        g.phone ? h("a", { class: "mini", href: "sms:" + g.phone + "?&body=" + encodeURIComponent(inviteText(g)), text: "SMS", onclick: function () { markShared(g, "sms"); } }) : null,
        g.email ? h("a", { class: "mini", href: "mailto:" + g.email + "?subject=" + encodeURIComponent("Stephane & Syntiche") + "&body=" + encodeURIComponent(inviteText(g)), text: "Email", onclick: function () { markShared(g, "email"); } }) : null,
        h("button", { class: "mini", type: "button", text: "QR", onclick: function () { showQr(g); } })
      ] : [h("span", { class: "muted small", text: "links off" })];
      var who = (g.rsvp_attendees || []).map(function (a) { return a.name + (a.dietary ? " (" + a.dietary + ")" : "") + (a.meal ? " — " + a.meal : ""); }).join(", ");
      tb.appendChild(h("tr", {}, [
        h("td", {}, [h("input", { type: "checkbox", class: "sel", "data-id": g.id, "aria-label": "Select " + g.label })]),
        h("td", {}, [h("strong", { text: g.label }), h("div", { class: "muted small", text: [g.kind, g.group_name, g.lang.toUpperCase()].filter(Boolean).join(" · ") }),
          who ? h("div", { class: "small", text: who }) : null, g.rsvp_message ? h("div", { class: "small quote", text: "“" + g.rsvp_message + "”" }) : null]),
        h("td", { text: (g.rsvp_status === "attending" ? g.rsvp_seats + " / " : "") + g.max_guests }),
        h("td", {}, [h("span", { class: "chip chip--" + g.rsvp_status, text: STATUS[g.rsvp_status] })]),
        h("td", { class: "small", text: g.sent_at ? fmtWhen(g.sent_at) + " · " + (g.sent_via || "") + (g.send_status === "accepted_by_provider" ? " ✓" : "") : "—" }),
        h("td", { class: "small", text: fmtWhen(g.opened_at) }),
        h("td", { class: "small", text: tname[g.table_id] || "—" }),
        h("td", { class: "r actions" }, share.concat([
          h("button", { class: "mini", type: "button", text: "Edit", onclick: function () { editGuest(g); } }),
          h("button", { class: "mini mini--bad", type: "button", text: "Delete", onclick: function () {
            if (!confirm("Delete the invitation for " + g.label + "? Their link stops working.")) return;
            api("guests.delete", { id: g.id }).then(function () { toast("Deleted."); loadGuests(); }).catch(fail);
          } })
        ]))
      ]));
    });
    updateSel();
  }
  ["#q", "#fStatus", "#fGroup"].forEach(function (s) { $(s).addEventListener("input", drawGuests); });
  function selected() { return $$("#guestTable .sel:checked").map(function (c) { return c.getAttribute("data-id"); }); }
  function updateSel() { $("#emailSel").disabled = !integ.email || !selected().length; $("#emailSel").title = integ.email ? "" : "Email sending is not configured"; }
  $("#guestTable").addEventListener("change", function (e) {
    if (e.target.id === "selAll") $$("#guestTable .sel").forEach(function (c) { c.checked = e.target.checked; });
    updateSel();
  });
  $("#emailSel").addEventListener("click", function () {
    var ids = selected(); if (!ids.length) return;
    if (!confirm("Send the invitation email to " + ids.length + " guest(s)?")) return;
    api("email.send", { ids: ids }).then(function (d) {
      var ok = d.results.filter(function (r) { return r.ok; }).length;
      toast(ok + " accepted by the email provider, " + (d.results.length - ok) + " not sent.", ok < d.results.length);
      loadGuests();
    }).catch(fail);
  });

  // editor
  var editing = null;
  function editGuest(g) {
    editing = g || null;
    var f = $("#guestForm"); f.reset();
    $("#guestModalTitle").textContent = g ? "Edit invitation" : "New invitation";
    if (g) {
      ["label", "greeting", "kind", "max_guests", "lang", "group_name", "email", "phone", "personal_message", "notes"].forEach(function (k) { f.elements[k].value = g[k] == null ? "" : g[k]; });
      f.elements.table_id.value = g.table_id || "";
      f.elements.party.value = (g.party || []).join("\n");
      f.elements.rsvp_seats.value = g.rsvp_seats || "";
    }
    $("#guestModal").showModal();
  }
  $("#addGuest").addEventListener("click", function () { editGuest(null); });
  $("#guestForm").addEventListener("submit", function (e) {
    if (e.submitter && e.submitter.value === "cancel") return;
    e.preventDefault();
    var f = e.target, g = {};
    ["label", "greeting", "kind", "max_guests", "lang", "group_name", "email", "phone", "personal_message", "notes", "table_id"].forEach(function (k) { g[k] = f.elements[k].value; });
    g.party = f.elements.party.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    if (f.elements.rsvp_status.value) { g.rsvp_status = f.elements.rsvp_status.value; g.rsvp_seats = f.elements.rsvp_seats.value; }
    else if (editing) { g.rsvp_status = editing.rsvp_status; g.rsvp_seats = editing.rsvp_seats; }
    if (editing) g.id = editing.id;
    api("guests.save", { guest: g }).then(function () { $("#guestModal").close(); toast("Saved."); loadGuests(); }).catch(fail);
  });

  // QR
  function showQr(g) {
    var qr = window.qrcode(0, "M"); qr.addData(g.link); qr.make();
    var n = qr.getModuleCount(), cell = 8, pad = 4 * cell, size = n * cell + pad * 2;
    var cv = document.createElement("canvas"); cv.width = cv.height = size;
    var ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size); ctx.fillStyle = "#0B1426";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(pad + c * cell, pad + r * cell, cell, cell);
    var box = $("#qrBox"); box.textContent = ""; cv.setAttribute("aria-label", "QR code for " + g.label); box.appendChild(cv);
    $("#qrTitle").textContent = g.label; $("#qrCode").textContent = g.token;
    $("#qrDownload").href = cv.toDataURL("image/png"); $("#qrDownload").download = "invitation-" + g.code + ".png";
    $("#qrModal").showModal();
  }
  $("#qrClose").addEventListener("click", function () { $("#qrModal").close(); });

  // CSV
  function csvParse(text) {
    var rows = [], row = [], f = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
      else if (ch === '"') q = true;
      else if (ch === ",") { row.push(f); f = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
      else f += ch;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return c.trim(); }); });
  }
  function csvCell(v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function download(name, text) {
    var a = h("a", { href: URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" })), download: name });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  $("#importCsv").addEventListener("change", function (e) {
    var file = e.target.files[0]; if (!file) return;
    file.text().then(function (text) {
      var rows = csvParse(text.replace(/^﻿/, ""));
      var head = rows.shift().map(function (s) { return s.trim().toLowerCase(); });
      if (head.indexOf("label") < 0) throw new Error("The CSV needs a 'label' column.");
      var out = rows.map(function (r) {
        var o = {}; head.forEach(function (k, i) { o[k] = (r[i] || "").trim(); });
        return { label: o.label, greeting: o.greeting, kind: o.kind, party: (o.party || "").split(";").map(function (s) { return s.trim(); }).filter(Boolean),
          max_guests: o.max_guests, lang: o.lang, group_name: o.group || o.group_name, email: o.email, phone: o.phone, personal_message: o.personal_message, notes: o.notes };
      }).filter(function (o) { return o.label; });
      if (!confirm("Import " + out.length + " invitation(s)?")) return;
      return api("guests.import", { rows: out }).then(function (d) { toast(d.imported + " invitation(s) imported."); loadGuests(); });
    }).catch(fail).then(function () { e.target.value = ""; });
  });
  $("#exportCsv").addEventListener("click", function () {
    var cols = ["label", "greeting", "kind", "group_name", "lang", "email", "phone", "max_guests", "rsvp_status", "rsvp_seats", "attendees", "rsvp_message", "sent_at", "sent_via", "opened_at", "table", "checked_in_count", "link"];
    var tname = {}; tables.forEach(function (t) { tname[t.id] = t.name; });
    var lines = [cols.join(",")].concat(guests.map(function (g) {
      var row = Object.assign({}, g, { table: tname[g.table_id] || "", attendees: (g.rsvp_attendees || []).map(function (a) { return a.name + (a.meal ? " [" + a.meal + "]" : "") + (a.dietary ? " (" + a.dietary + ")" : ""); }).join("; ") });
      return cols.map(function (c) { return csvCell(row[c]); }).join(",");
    }));
    download("guests-" + new Date().toISOString().slice(0, 10) + ".csv", lines.join("\n"));
  });

  // ------------------------------------------------------------ seating --
  function drawSeating() {
    var box = $("#seating"); if (!box) return; box.textContent = "";
    var attending = guests.filter(function (g) { return g.rsvp_status !== "declined"; });
    function seatsOf(g) { return g.rsvp_status === "attending" ? g.rsvp_seats : g.max_guests; }
    function assign(g, tableId) {
      var payload = Object.assign({}, g, { table_id: tableId || null });
      api("guests.save", { guest: payload }).then(function () { g.table_id = tableId || null; drawSeating(); drawGuests(); }).catch(fail);
    }
    function picker(g) {
      var sel = h("select", { "aria-label": "Table for " + g.label, onchange: function () { assign(g, sel.value); } }, [h("option", { value: "", text: "Unassigned" })]);
      tables.forEach(function (t) { sel.appendChild(h("option", { value: t.id, text: t.name, selected: g.table_id === t.id || null })); });
      return sel;
    }
    var cols = tables.map(function (t) {
      var here = attending.filter(function (g) { return g.table_id === t.id; });
      var used = here.reduce(function (n, g) { return n + seatsOf(g); }, 0);
      return h("div", { class: "table-card" + (used > t.capacity ? " over" : "") }, [
        h("div", { class: "tc-head" }, [h("strong", { text: t.name }), h("span", { class: "small", text: used + " / " + t.capacity }),
          h("button", { class: "mini mini--bad", type: "button", text: "Remove", onclick: function () {
            if (!confirm("Remove " + t.name + "? Its guests become unassigned.")) return;
            api("tables.delete", { id: t.id }).then(loadGuests).catch(fail);
          } })]),
        h("ul", {}, here.map(function (g) { return h("li", {}, [h("span", { text: g.label + " (" + seatsOf(g) + ")" }), picker(g)]); }))
      ]);
    });
    var free = attending.filter(function (g) { return !g.table_id; });
    box.appendChild(h("div", { class: "table-card unassigned" }, [h("div", { class: "tc-head" }, [h("strong", { text: "Not seated yet" }), h("span", { class: "small", text: String(free.length) })]),
      h("ul", {}, free.map(function (g) { return h("li", {}, [h("span", { text: g.label + " (" + seatsOf(g) + (g.rsvp_status === "pending" ? ", pending" : "") + ")" }), picker(g)]); }))]));
    cols.forEach(function (c) { box.appendChild(c); });
  }
  $("#tableForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target;
    api("tables.save", { table: { name: f.elements.name.value, capacity: f.elements.capacity.value, sort: tables.length } })
      .then(function () { f.reset(); loadGuests(); }).catch(fail);
  });
  $("#exportSeating").addEventListener("click", function () {
    var lines = ["table,capacity,invitation,seats,attendees"];
    tables.forEach(function (t) {
      guests.filter(function (g) { return g.table_id === t.id && g.rsvp_status !== "declined"; }).forEach(function (g) {
        lines.push([t.name, t.capacity, g.label, g.rsvp_seats || g.max_guests, (g.rsvp_attendees || []).map(function (a) { return a.name; }).join("; ")].map(csvCell).join(","));
      });
    });
    download("seating.csv", lines.join("\n"));
  });

  // ---------------------------------------------------------- guestbook --
  function loadGuestbook() {
    api("guestbook.list").then(function (d) {
      var ul = $("#gbAdmin"); ul.textContent = "";
      if (!d.entries.length) ul.appendChild(h("li", { class: "muted", text: "No messages yet." }));
      d.entries.forEach(function (e) {
        ul.appendChild(h("li", { class: e.approved ? "approved" : "" }, [
          h("p", { class: "gb-m", text: e.message }),
          h("p", { class: "small muted", text: "— " + e.name + " · " + new Date(e.created_at).toLocaleString() + (e.invitation_id ? " · verified guest" : "") }),
          h("div", { class: "actions" }, [
            h("button", { class: "mini", type: "button", text: e.approved ? "Hide" : "Approve", onclick: function () { api("guestbook.set", { id: e.id, approved: !e.approved }).then(loadGuestbook).catch(fail); } }),
            h("button", { class: "mini mini--bad", type: "button", text: "Delete", onclick: function () { if (confirm("Delete this message?")) api("guestbook.delete", { id: e.id }).then(loadGuestbook).catch(fail); } })
          ])
        ]));
      });
    }).catch(fail);
  }

  // ------------------------------------------------------------ content --
  // A small schema → form renderer. Paths are dotted ("ceremony.venue");
  // "bi" fields edit {en, fr}; lists edit arrays of objects.
  var SCHEMA = [
    { title: "Ceremony", fields: [["ceremony.venue", "Venue name"], ["ceremony.address", "Street address"], ["ceremony.start", "Start time", "time"], ["ceremony.end", "End time", "time"], ["ceremony.note", "Note", "bi"]] },
    { title: "Reception", fields: [["reception.venue", "Venue name"], ["reception.address", "Street address"], ["reception.start", "Start time", "time"], ["reception.end", "End time", "time"], ["reception.note", "Note", "bi"]] },
    { title: "Guests' practical details", fields: [["dress_code", "Dress code", "bi"], ["contact.name", "Contact name"], ["contact.phone", "Contact phone"], ["contact.email", "Contact email"], ["photo_credit", "Photographer credit"]] },
    { title: "RSVP", fields: [["rsvp.enabled", "Accept responses", "bool"], ["rsvp.deadline", "Deadline (end of day, Pacific)", "date"], ["rsvp.allow_update", "Guests may change their response", "bool"], ["rsvp.ask_dietary", "Ask about dietary needs", "bool"],
      ["rsvp.meals", "Meal choices (leave empty for none)", "list", [["id", "Code"], ["label", "Label", "bi"]]]] },
    { title: "Gifts", fields: [["gifts.enabled", "Show the gifts section", "bool"], ["gifts.registry_url", "Wish-list link", "url"], ["gifts.fund_url", "Gift / honeymoon fund link", "url"], ["gifts.fund_label", "Fund button label", "bi"], ["gifts.message", "Message", "bi-long"]] },
    { title: "Program of the day", fields: [["program", "", "list", [["time", "Time", "time"], ["title", "Title", "bi"], ["text", "Description", "bi"], ["place", "Place", "bi"]]]] },
    { title: "Our story", fields: [["story", "", "list", [["photo", "Photo", "photo"], ["when", "Date", "date"], ["title", "Title", "bi"], ["text", "Story", "bi-long"]]]] },
    { title: "FAQ", note: "Questions marked “auto” answer themselves from the details above unless you write an answer.", fields: [["faq", "", "list", [["q", "Question", "bi"], ["a", "Answer", "bi-long"]]]] },
    { title: "Photos & scenes", fields: [["scenes", "Which photo plays each scene", "scenes"], ["photos", "Photo library", "photos"]] },
    { title: "Music", note: "Only use music you hold a licence for. Nothing plays until a guest presses the sound button.", fields: [["music.src", "Audio file URL (mp3)", "url"], ["music.title", "Title"], ["music.license", "Licence / source"]] }
  ];

  function get(o, path) { return path.split(".").reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); }
  function set(o, path, v) { var ks = path.split("."), last = ks.pop(); var t = ks.reduce(function (a, k) { if (a[k] == null || typeof a[k] !== "object") a[k] = {}; return a[k]; }, o); t[last] = v; }
  var nul = function (v) { v = typeof v === "string" ? v.trim() : v; return v === "" || v == null ? null : v; };

  function field(obj, path, label, type, sub) {
    var v = get(obj, path);
    var wrap = h("div", { class: "cf" + (type === "list" || type === "photos" || type === "scenes" ? " cf--wide" : "") });
    if (label) wrap.appendChild(h("p", { class: "cf-label", text: label }));
    if (type === "bi" || type === "bi-long") {
      var row = h("div", { class: "bi" });
      ["en", "fr"].forEach(function (lg) {
        var tag = type === "bi-long" ? "textarea" : "input";
        var inp = h(tag, { "aria-label": label + " (" + lg + ")", placeholder: lg.toUpperCase(), rows: type === "bi-long" ? "3" : null, oninput: function () { set(obj, path + "." + lg, nul(inp.value)); } });
        inp.value = v && v[lg] || "";
        row.appendChild(h("label", { class: "lg" }, [h("span", { text: lg.toUpperCase() }), inp]));
      });
      wrap.appendChild(row); return wrap;
    }
    if (type === "bool") {
      var cb = h("input", { type: "checkbox", onchange: function () { set(obj, path, cb.checked); } }); cb.checked = v !== false;
      wrap.textContent = ""; wrap.appendChild(h("label", { class: "check" }, [cb, " " + label])); return wrap;
    }
    if (type === "list") {
      var arr = Array.isArray(v) ? v : []; set(obj, path, arr);
      var ul = h("ol", { class: "cf-list" });
      var redraw = function () {
        ul.textContent = "";
        arr.forEach(function (item, i) {
          var li = h("li", { class: "cf-item" }, [h("div", { class: "cf-item-head" }, [
            h("span", { class: "small muted", text: "#" + (i + 1) + (item.auto ? " · auto" : "") }),
            h("button", { class: "mini", type: "button", text: "↑", "aria-label": "Move up", disabled: i === 0 || null, onclick: function () { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); redraw(); } }),
            h("button", { class: "mini", type: "button", text: "↓", "aria-label": "Move down", disabled: i === arr.length - 1 || null, onclick: function () { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); redraw(); } }),
            h("button", { class: "mini mini--bad", type: "button", text: "Remove", onclick: function () { arr.splice(i, 1); redraw(); } })
          ])]);
          sub.forEach(function (s) { li.appendChild(field(item, s[0], s[1], s[2])); });
          ul.appendChild(li);
        });
      };
      redraw();
      wrap.appendChild(ul);
      wrap.appendChild(h("button", { class: "btn btn--ghost btn--sm", type: "button", text: "+ Add", onclick: function () { arr.push({ id: Math.random().toString(36).slice(2, 8) }); redraw(); } }));
      return wrap;
    }
    if (type === "photo") {
      var sel = h("select", { "aria-label": label, onchange: function () { set(obj, path, sel.value); } });
      (content.photos || []).forEach(function (p) { sel.appendChild(h("option", { value: p.id, text: p.id, selected: p.id === v || null })); });
      wrap.appendChild(sel); return wrap;
    }
    if (type === "scenes") {
      var grid = h("div", { class: "scenes" });
      Object.keys(v || {}).forEach(function (scene) {
        var s2 = h("select", { "aria-label": scene, onchange: function () { v[scene] = s2.value; } });
        (content.photos || []).forEach(function (p) { s2.appendChild(h("option", { value: p.id, text: p.id, selected: p.id === v[scene] || null })); });
        grid.appendChild(h("label", { class: "lg" }, [h("span", { text: scene }), s2]));
      });
      wrap.appendChild(grid); return wrap;
    }
    if (type === "photos") {
      var lib = h("div", { class: "photos" });
      var draw = function () {
        lib.textContent = "";
        content.photos.forEach(function (p, i) {
          var src = /^https?:/.test(p.src) ? p.src : p.src + "-720.webp";
          var card = h("div", { class: "photo-card" }, [h("img", { src: src, alt: "", loading: "lazy" })]);
          card.appendChild(h("p", { class: "small", text: p.id }));
          var cat = h("select", { "aria-label": "Category", onchange: function () { p.category = cat.value; } });
          ["story", "moments", "proposal", "celebration"].forEach(function (c) { cat.appendChild(h("option", { value: c, text: c, selected: p.category === c || null })); });
          card.appendChild(cat);
          card.appendChild(field(p, "alt", "Description (for screen readers)", "bi"));
          var fx = h("input", { value: p.focus || "50% 50%", "aria-label": "Focal point", title: "Focal point, e.g. 50% 30% (x y)", oninput: function () { p.focus = fx.value; } });
          card.appendChild(h("label", { class: "lg" }, [h("span", { text: "Focus" }), fx]));
          card.appendChild(h("button", { class: "mini mini--bad", type: "button", text: "Remove from site", onclick: function () {
            var used = Object.keys(content.scenes).filter(function (k) { return content.scenes[k] === p.id; });
            if (used.length) return toast("Used by scene(s): " + used.join(", ") + " — reassign first.", true);
            content.photos.splice(i, 1); draw();
          } }));
          lib.appendChild(card);
        });
        var up = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", multiple: true, hidden: true, onchange: function () { uploadPhotos(up.files).then(draw); up.value = ""; } });
        lib.appendChild(h("label", { class: "photo-card photo-add" }, [up, h("span", { text: "+ Upload photos" }), h("span", { class: "small muted", text: "Resized to 2400 px before upload" })]));
      };
      draw(); wrap.appendChild(lib); return wrap;
    }
    var input = h("input", { type: type || "text", "aria-label": label, oninput: function () { set(obj, path, nul(input.value)); } });
    input.value = v == null ? "" : v;
    wrap.appendChild(input);
    return wrap;
  }

  function resizeToJpeg(file) {
    return new Promise(function (ok, bad) {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, 2400 / Math.max(img.width, img.height));
        var cv = document.createElement("canvas"); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(img.src);
        ok({ data: cv.toDataURL("image/jpeg", 0.86).split(",")[1], w: cv.width, h: cv.height });
      };
      img.onerror = bad; img.src = URL.createObjectURL(file);
    });
  }
  function uploadPhotos(files) {
    return Array.from(files).reduce(function (p, file) {
      return p.then(function () {
        toast("Uploading " + file.name + "…");
        return resizeToJpeg(file).then(function (r) {
          return api("media.upload", { type: "image/jpeg", data: r.data }).then(function (d) {
            var id = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) + "-" + Date.now().toString(36).slice(-4);
            content.photos.push({ id: id, src: d.url, w: r.w, h: r.h, focus: "50% 35%", category: "moments", alt: { en: null, fr: null } });
            toast("Uploaded. Add a description, then Save & publish.");
          });
        });
      });
    }, Promise.resolve()).catch(fail);
  }

  function loadContent() {
    return api("settings.get").then(function (d) {
      content = d.content;
      $("#contentSaved").textContent = d.updated_at ? "Last published " + new Date(d.updated_at).toLocaleString() : "Showing the defaults — nothing published from the dashboard yet.";
      var form = $("#contentForm"); form.textContent = "";
      SCHEMA.forEach(function (sec) {
        var box = h("section", { class: "cf-sec" }, [h("h2", { text: sec.title }), sec.note ? h("p", { class: "muted small", text: sec.note }) : null]);
        var grid = h("div", { class: "cf-grid" });
        sec.fields.forEach(function (f) { grid.appendChild(field(content, f[0], f[1], f[2], f[3])); });
        box.appendChild(grid); form.appendChild(box);
      });
    }).catch(fail);
  }
  $("#saveContent").addEventListener("click", function () {
    api("settings.save", { content: content }).then(function () { toast("Published. Guests see it within a minute."); loadContent(); }).catch(fail);
  });

  // --------------------------------------------------------------- boot --
  function boot() {
    api("settings.get").then(function (d) { content = d.content; loadOverview(); }).catch(function () { loadOverview(); });
    loadGuests();
  }
  var saved = null; try { saved = sessionStorage.getItem(KEY); } catch (e) {}
  if (saved) signIn(saved).catch(signOut);
})();
