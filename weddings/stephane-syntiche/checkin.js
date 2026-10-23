/* Door check-in. One invitation at a time: scan, confirm the count, done.
 * Uses the native BarcodeDetector where available, jsQR everywhere else. */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var KEY = "ss.door", key = null, current = null, codeIn = null, count = 1, stream = null, scanning = false;

  function api(action, extra) {
    return fetch("/api/checkin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.assign({ key: key, action: action }, extra || {})) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { d._status = r.status; return d; }); });
  }
  function stats() { api("stats").then(function (d) { if (d._status === 200) $("#stats").textContent = d.arrived + " / " + d.expected + " arrived"; }); }

  function signIn(k) {
    key = k;
    return api("stats").then(function (d) {
      if (d._status !== 200) throw new Error(d._status === 429 ? "Too many attempts — wait 15 minutes." : "Key not accepted.");
      try { sessionStorage.setItem(KEY, k); } catch (e) {}
      $("#login").hidden = true; $("#app").hidden = false;
      $("#stats").textContent = d.arrived + " / " + d.expected + " arrived";
    });
  }
  $("#loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    signIn(e.target.elements.key.value.trim()).catch(function (x) { var el = $("#loginForm .error"); el.textContent = x.message; el.hidden = false; });
  });
  $("#logout").addEventListener("click", function () { try { sessionStorage.removeItem(KEY); } catch (e) {} location.reload(); });

  function show(d) {
    var r = $("#result"), g = d.guest;
    r.hidden = false; r.className = "result";
    $("#undoBtn").hidden = true;
    if (!g) {
      r.classList.add("bad"); $("#rStatus").textContent = d._status === 404 ? "✕ Not a valid invitation" : "✕ Could not check — try again";
      $("#rLabel").textContent = ""; $("#rMeta").textContent = ""; $("#rPeople").textContent = ""; $("#rActions").hidden = true; return;
    }
    current = g;
    $("#rLabel").textContent = g.label;
    var seats = g.rsvp_status === "attending" ? g.rsvp_seats : 0;
    $("#rMeta").textContent = (g.rsvp_status === "attending" ? "Confirmed " + seats + " of " + g.max_guests : g.rsvp_status === "declined" ? "Declined the invitation" : "Never replied — invited up to " + g.max_guests) + (g.table ? " · " + g.table : "");
    var ul = $("#rPeople"); ul.textContent = "";
    (g.attendees.length ? g.attendees : g.party.map(function (n) { return { name: n }; })).forEach(function (a) {
      var li = document.createElement("li"); li.textContent = a.name + (a.dietary ? " — " + a.dietary : ""); ul.appendChild(li);
    });
    if (g.checked_in_at) {
      r.classList.add("bad");
      $("#rStatus").textContent = "⚠ Already checked in at " + new Date(g.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " (" + g.checked_in_count + ")";
      $("#rActions").hidden = true; $("#undoBtn").hidden = false;
      return;
    }
    r.classList.add(g.rsvp_status === "attending" ? "ok" : "warn");
    $("#rStatus").textContent = g.rsvp_status === "attending" ? "✓ Expected" : "! Not on the confirmed list — check with the couple's organiser";
    count = Math.max(1, seats || 1); $("#count").textContent = count;
    $("#rActions").hidden = false;
  }

  function lookup(code) {
    codeIn = code;
    api("lookup", { code: code }).then(show);
  }
  $("#manual").addEventListener("submit", function (e) { e.preventDefault(); lookup(e.target.elements.code.value.trim()); });
  $("#minus").addEventListener("click", function () { count = Math.max(1, count - 1); $("#count").textContent = count; });
  $("#plus").addEventListener("click", function () { count = Math.min(current ? current.max_guests : 20, count + 1); $("#count").textContent = count; });
  $("#checkBtn").addEventListener("click", function () {
    api("checkin", { code: codeIn, count: count }).then(function (d) {
      show(d);
      if (d._status === 200) {
        $("#result").className = "result ok"; $("#rStatus").textContent = "✓ Welcome! " + d.guest.checked_in_count + " checked in";
        $("#rActions").hidden = true; $("#undoBtn").hidden = true; stats();
      }
    });
  });
  $("#undoBtn").addEventListener("click", function () {
    api("undo", { code: codeIn }).then(function (d) {
      if (d._status === 403) return alert("Only an admin key can undo a check-in.");
      show(d); stats();
    });
  });
  $("#nextBtn").addEventListener("click", function () { $("#result").hidden = true; $("#manual").reset(); current = null; startCamera(); });

  // camera
  var detector = "BarcodeDetector" in window ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
  var canvas = document.createElement("canvas"), ctx = canvas.getContext("2d", { willReadFrequently: true });
  function startCamera() {
    if (stream) { scanning = true; loop(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function (s) {
      stream = s; var v = $("#video"); v.srcObject = s; v.play();
      $("#viewer").classList.add("live"); scanning = true; loop();
    }).catch(function () { alert("Camera unavailable — type the code instead."); });
  }
  function found(text) { scanning = false; if (navigator.vibrate) navigator.vibrate(60); lookup(text); }
  function loop() {
    if (!scanning) return;
    var v = $("#video");
    if (v.readyState < 2) return requestAnimationFrame(loop);
    if (detector) {
      detector.detect(v).then(function (codes) { if (codes.length) found(codes[0].rawValue); else setTimeout(loop, 120); }).catch(function () { detector = null; loop(); });
      return;
    }
    var w = 480, h = Math.round(v.videoHeight / v.videoWidth * w) || 480;
    canvas.width = w; canvas.height = h; ctx.drawImage(v, 0, 0, w, h);
    var res = window.jsQR && window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
    if (res && res.data) found(res.data); else setTimeout(loop, 150);
  }
  $("#camBtn").addEventListener("click", startCamera);

  var saved = null; try { saved = sessionStorage.getItem(KEY); } catch (e) {}
  if (saved) signIn(saved).catch(function () {});
})();
