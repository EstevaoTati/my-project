/* =====================================================================
   PRECIOUS — voice operating system. MWINDA DIGITAL.

   Design rule for this file: the machine is voice-only. There is no text
   input anywhere in the interface and none may be added. Everything the
   operator says arrives through the browser's speech recognition; every
   answer leaves through speech synthesis. The on-screen controls are
   buttons (start, ambient, mute, language, help) — never a keyboard.

   Pipeline, once per turn:
     microphone -> AnalyserNode (levels, drawn by the reactor)
                -> SpeechRecognition (transcript)
                -> /.netlify/functions/precious (Claude, tool use)
                -> device actions + speechSynthesis

   Half-duplex on purpose: recognition is suspended while PRECIOUS speaks.
   On a laptop or a phone the microphone hears the loudspeaker, so a
   full-duplex loop transcribes the machine's own voice and answers itself.
   Interrupting is still one tap on the core.
   ===================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ i18n */
  var DICT = {
    fr: {
      gateTag: "L'assistant vocal qui écoute, décide et agit. Aucun clavier.",
      gateBtn: 'ACTIVER PRECIOUS',
      gateNote: 'Autorisez le microphone, puis parlez. Dites « Precious, arrête » pour la mettre en veille.',
      back: '← Retour au site',
      roState: 'ÉTAT', roLatency: 'LATENCE', roTurns: 'ÉCHANGES', roClock: 'HORLOGE',
      stIdle: 'EN VEILLE', stListening: 'À L’ÉCOUTE', stThinking: 'ANALYSE',
      stSpeaking: 'RÉPONSE', stError: 'ERREUR',
      hintTap: 'Touchez le noyau et parlez',
      hintAmbient: 'Écoute permanente — dites « Precious… »',
      hintListening: 'Je vous écoute',
      logTitle: 'JOURNAL DE SIGNAL', memTitle: 'MÉMOIRE', timerTitle: 'COMPTEURS',
      memEmpty: 'Dites « retiens que… »', timerEmpty: 'Dites « minuteur 10 minutes »',
      btnTalk: 'PARLER', btnAmbient: 'AMBIANT', btnVoice: 'VOIX', btnLang: 'LANGUE',
      btnHelp: 'COMMANDES', btnHome: 'SITE',
      helpTitle: 'COMMANDES VOCALES',
      h1a: '« Retiens que… »', h1b: 'écrit un fait dans la mémoire locale',
      h2a: '« Oublie … »', h2b: 'efface un fait mémorisé',
      h3a: '« Minuteur de dix minutes »', h3b: 'lance un compte à rebours annoncé à voix haute',
      h4a: '« Ouvre l’intelligence d’affaires »', h4b: 'ouvre une page du site',
      h5a: '« Parle anglais » / « Parle français »', h5b: 'change de langue',
      h6a: '« Parle plus vite / moins vite »', h6b: 'règle le débit de la voix',
      h7a: '« Precious, arrête »', h7b: 'met le micro en veille',
      h8a: '« Precious… » (mode ambiant)', h8b: 'mot d’éveil quand l’écoute permanente est active',
      helpFoot: 'Aucune transcription n’est stockée sur un serveur. La mémoire et les compteurs restent dans ce navigateur.',
      unsupTag: 'Cette machine est entièrement vocale : elle a besoin de la reconnaissance vocale du navigateur, absente ici.',
      unsupNote: 'Ouvrez /precious dans Chrome, Edge ou Safari (iOS 14.5+). PRECIOUS s’installe ensuite comme application sur ordinateur et mobile.',
      whoYou: 'VOUS', whoMe: 'PRECIOUS', whoSys: 'SYSTÈME',
      greeting: 'PRECIOUS en ligne. Je vous écoute.',
      greetingOperator: 'PRECIOUS en ligne, mode opérateur. Je vous écoute.',
      micDenied: 'Microphone refusé. Autorisez le micro dans les réglages du navigateur, puis rechargez la page : cette interface est entièrement vocale.',
      micMissing: 'Aucun microphone détecté. Branchez un micro puis rechargez la page.',
      netError: 'Liaison interrompue. Je réessaie quand vous voulez.',
      busy: 'Trop de demandes coup sur coup. Laissez-moi une minute.',
      offline: 'PRECIOUS est hors ligne pour le moment.',
      sleeping: 'Je me mets en veille. Touchez le noyau pour me réveiller.',
      awake: 'Je vous écoute.',
      ambientOn: 'Écoute permanente active. Dites Precious pour me solliciter.',
      ambientOff: 'Écoute permanente désactivée.',
      voiceOff: 'Voix coupée.', voiceOn: 'Voix rétablie.',
      langSwitched: 'Je passe au français.',
      memSaved: 'Mémorisé.', memCleared: 'Mémoire effacée.',
      timerDone: 'Le compteur est terminé.',
      timerDoneLabel: 'Compteur terminé : ',
      keyRejected: 'Clé opérateur refusée. Je continue en mode public.',
      installed: 'PRECIOUS est installable comme application depuis le menu du navigateur.',
      recError: 'La reconnaissance vocale a été interrompue. Touchez le noyau pour reprendre.'
    },
    en: {
      gateTag: 'The voice assistant that listens, decides and acts. No keyboard.',
      gateBtn: 'ACTIVATE PRECIOUS',
      gateNote: 'Allow the microphone, then speak. Say "Precious, stop" to send it to sleep.',
      back: '← Back to the site',
      roState: 'STATE', roLatency: 'LATENCY', roTurns: 'TURNS', roClock: 'CLOCK',
      stIdle: 'STANDBY', stListening: 'LISTENING', stThinking: 'THINKING',
      stSpeaking: 'SPEAKING', stError: 'ERROR',
      hintTap: 'Touch the core and speak',
      hintAmbient: 'Always listening — say "Precious…"',
      hintListening: 'I am listening',
      logTitle: 'SIGNAL LOG', memTitle: 'MEMORY', timerTitle: 'TIMERS',
      memEmpty: 'Say "remember that…"', timerEmpty: 'Say "set a ten minute timer"',
      btnTalk: 'TALK', btnAmbient: 'AMBIENT', btnVoice: 'VOICE', btnLang: 'LANGUAGE',
      btnHelp: 'COMMANDS', btnHome: 'SITE',
      helpTitle: 'VOICE COMMANDS',
      h1a: '"Remember that…"', h1b: 'writes a fact into local memory',
      h2a: '"Forget …"', h2b: 'deletes a stored fact',
      h3a: '"Set a ten minute timer"', h3b: 'starts a countdown announced out loud',
      h4a: '"Open business intelligence"', h4b: 'opens a page of the site',
      h5a: '"Speak French" / "Speak English"', h5b: 'switches language',
      h6a: '"Speak faster / slower"', h6b: 'sets the speaking rate',
      h7a: '"Precious, stop"', h7b: 'puts the microphone to sleep',
      h8a: '"Precious…" (ambient mode)', h8b: 'wake word while always-on listening is enabled',
      helpFoot: 'No transcript is stored on any server. Memory and timers stay in this browser.',
      unsupTag: 'This machine is voice-only: it needs the browser speech recognition engine, which is missing here.',
      unsupNote: 'Open /precious in Chrome, Edge or Safari (iOS 14.5+). PRECIOUS then installs as an app on desktop and mobile.',
      whoYou: 'YOU', whoMe: 'PRECIOUS', whoSys: 'SYSTEM',
      greeting: 'PRECIOUS online. I am listening.',
      greetingOperator: 'PRECIOUS online, operator mode. I am listening.',
      micDenied: 'Microphone denied. Allow the microphone in your browser settings and reload: this interface is entirely voice driven.',
      micMissing: 'No microphone detected. Connect one and reload the page.',
      netError: 'Link interrupted. I can retry whenever you want.',
      busy: 'Too many requests at once. Give me a minute.',
      offline: 'PRECIOUS is offline at the moment.',
      sleeping: 'Going to sleep. Touch the core to wake me.',
      awake: 'I am listening.',
      ambientOn: 'Always-on listening enabled. Say Precious to call me.',
      ambientOff: 'Always-on listening disabled.',
      voiceOff: 'Voice muted.', voiceOn: 'Voice restored.',
      langSwitched: 'Switching to English.',
      memSaved: 'Noted.', memCleared: 'Memory cleared.',
      timerDone: 'Your timer is finished.',
      timerDoneLabel: 'Timer finished: ',
      keyRejected: 'Operator key refused. Continuing in public mode.',
      installed: 'PRECIOUS can be installed as an app from your browser menu.',
      recError: 'Speech recognition stopped. Touch the core to resume.'
    }
  };

  /* ------------------------------------------------------------------ dom */
  var $ = function (id) { return document.getElementById(id); };
  var el = {
    body: document.body,
    gate: $('gate'), gateBtn: $('gateBtn'), gateFail: $('gateFail'), bootLog: $('bootLog'),
    console: $('console'), unsupported: $('unsupported'),
    reactor: $('reactor'), orb: $('orb'),
    stateLabel: $('stateLabel'), liveLine: $('liveLine'), hintLine: $('hintLine'),
    log: $('log'), levelBar: $('levelBar'),
    roState: $('roState'), roLatency: $('roLatency'), roTurns: $('roTurns'), roClock: $('roClock'),
    modeChip: $('modeChip'),
    memList: $('memList'), memCount: $('memCount'), memEmpty: $('memEmpty'),
    timerList: $('timerList'), timerCount: $('timerCount'), timerEmpty: $('timerEmpty'),
    memRail: document.querySelector('.rail-left'), timerRail: document.querySelector('.rail-right'),
    btnTalk: $('btnTalk'), btnAmbient: $('btnAmbient'), btnVoice: $('btnVoice'),
    btnLang: $('btnLang'), langGlyph: $('langGlyph'), btnHelp: $('btnHelp'),
    helpSheet: $('helpSheet'), helpClose: $('helpClose')
  };

  /* ------------------------------------------------------------------ state */
  var STORE = { mem: 'precious.memory', lang: 'precious.lang', rate: 'precious.rate', session: 'precious.session', key: 'precious.key' };
  var ENDPOINT = '/.netlify/functions/precious';
  var MAX_TURNS = 20;
  var SILENCE_MS = 1100;      // quiet time that ends an utterance
  var FOLLOWUP_MS = 12000;    // ambient grace period: no wake word needed
  var WAKE = /\b(pr[ée]cious|pr[ée]cieuse|pr[ée]cieux|preshus|precius)\b/i;

  var S = {
    lang: 'fr',
    booted: false,
    state: 'idle',
    ambient: false,
    voiceOn: true,
    rate: 1,
    listening: false,
    speaking: false,
    pending: false,          // a request is in flight
    shouldListen: false,     // the engine wants the recogniser running
    lastSpokeAt: 0,
    turns: 0,
    history: [],
    memory: [],
    timers: [],
    operatorKey: null,
    mode: 'public'
  };

  var rec = null, recRunning = false, restartTimer = 0, silenceTimer = 0, followUpTimer = 0;
  var pendingFinal = '', interim = '';
  var audioCtx = null, analyser = null, freqData = null, micStream = null, levelRaf = 0;
  var voices = [], chosenVoice = null;

  var t = function (key) { return (DICT[S.lang] && DICT[S.lang][key]) || DICT.fr[key] || key; };

  /* ------------------------------------------------------------------ store */
  function readJSON(key, fallback) {
    try { var v = JSON.parse(window.localStorage.getItem(key)); return v || fallback; }
    catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }
  function readSession() {
    try { return JSON.parse(window.sessionStorage.getItem(STORE.session)) || []; }
    catch (e) { return []; }
  }
  function saveSession() {
    try { window.sessionStorage.setItem(STORE.session, JSON.stringify(S.history.slice(-MAX_TURNS))); }
    catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ ui */
  function applyLanguage(lang) {
    S.lang = lang === 'en' ? 'en' : 'fr';
    try { window.localStorage.setItem(STORE.lang, S.lang); } catch (e) { /* ignore */ }
    document.documentElement.lang = S.lang;
    el.body.setAttribute('data-lang', S.lang);
    var nodes = document.querySelectorAll('[data-t]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-t');
      var val = DICT[S.lang][key];
      if (val) nodes[i].textContent = val;
    }
    if (el.langGlyph) el.langGlyph.textContent = S.lang.toUpperCase();
    setState(S.state);
    renderMemory();
    renderTimers();
    if (rec) rec.lang = S.lang === 'fr' ? 'fr-FR' : 'en-US';
    chosenVoice = pickVoice();
  }

  var STATE_KEY = { idle: 'stIdle', listening: 'stListening', thinking: 'stThinking', speaking: 'stSpeaking', error: 'stError' };

  function setState(state) {
    S.state = state;
    el.body.className = 'state-' + state;
    if (el.stateLabel) el.stateLabel.textContent = t(STATE_KEY[state] || 'stIdle');
    if (el.roState) el.roState.textContent = t(STATE_KEY[state] || 'stIdle');
    if (window.PreciousReactor) window.PreciousReactor.setState(state);
    // One source of truth for the button: it is lit exactly when the
    // microphone is open, whoever opened it.
    if (el.btnTalk) el.btnTalk.setAttribute('aria-pressed', state === 'listening' ? 'true' : 'false');
    if (el.hintLine) {
      el.hintLine.textContent = state === 'listening'
        ? t('hintListening')
        : (S.ambient ? t('hintAmbient') : t('hintTap'));
    }
  }

  function addEntry(who, text) {
    if (!el.log) return;
    var row = document.createElement('div');
    row.className = 'entry ' + who;
    var tag = document.createElement('span');
    tag.className = 'who';
    tag.textContent = who === 'user' ? t('whoYou') : who === 'precious' ? t('whoMe') : t('whoSys');
    var said = document.createElement('span');
    said.className = 'said';
    said.textContent = text;
    row.appendChild(tag);
    row.appendChild(said);
    el.log.appendChild(row);
    while (el.log.childNodes.length > 60) el.log.removeChild(el.log.firstChild);
    el.log.scrollTop = el.log.scrollHeight;
  }

  function showLive(text, isInterim) {
    if (!el.liveLine) return;
    el.liveLine.textContent = text || '';
    el.liveLine.className = 'live-line' + (isInterim ? ' interim' : '');
  }

  function renderMemory() {
    if (!el.memList) return;
    el.memList.textContent = '';
    for (var i = 0; i < S.memory.length; i++) {
      var item = document.createElement('li');
      var k = document.createElement('span'); k.className = 'k'; k.textContent = S.memory[i].label;
      var v = document.createElement('span'); v.className = 'v'; v.textContent = S.memory[i].value;
      item.appendChild(k); item.appendChild(v);
      el.memList.appendChild(item);
    }
    if (el.memCount) el.memCount.textContent = String(S.memory.length);
    if (el.memEmpty) el.memEmpty.hidden = S.memory.length > 0;
    if (el.memRail) el.memRail.classList.toggle('filled', S.memory.length > 0);
  }

  function fmtDuration(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    return (h ? h + ':' : '') + pad(m) + ':' + pad(s);
  }

  function renderTimers() {
    if (!el.timerList) return;
    el.timerList.textContent = '';
    for (var i = 0; i < S.timers.length; i++) {
      var item = document.createElement('li');
      var v = document.createElement('span'); v.className = 'k';
      v.textContent = S.timers[i].label || (S.lang === 'fr' ? 'compteur' : 'timer');
      var d = document.createElement('span'); d.className = 't';
      d.textContent = fmtDuration((S.timers[i].endsAt - Date.now()) / 1000);
      item.appendChild(v); item.appendChild(d);
      el.timerList.appendChild(item);
    }
    if (el.timerCount) el.timerCount.textContent = String(S.timers.length);
    if (el.timerEmpty) el.timerEmpty.hidden = S.timers.length > 0;
    if (el.timerRail) el.timerRail.classList.toggle('filled', S.timers.length > 0);
  }

  /* ------------------------------------------------------------------ audio in */
  function startAudioMeter(stream) {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
      var source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      freqData = new Uint8Array(analyser.frequencyBinCount);
      tickLevel();
    } catch (e) { /* metering is cosmetic; recognition still works */ }
  }

  function tickLevel() {
    if (!analyser) return;
    analyser.getByteFrequencyData(freqData);
    var sum = 0, n = Math.floor(freqData.length * 0.5);
    for (var i = 0; i < n; i++) sum += freqData[i];
    var level = Math.min(1, (sum / n / 255) * 2.6);
    if (window.PreciousReactor) {
      window.PreciousReactor.setLevel(S.listening ? level : 0);
      window.PreciousReactor.setSpectrum(freqData);
    }
    if (el.levelBar) el.levelBar.style.width = Math.round((S.listening ? level : 0) * 100) + '%';
    levelRaf = window.requestAnimationFrame(tickLevel);
  }

  /* ------------------------------------------------------------------ speech out */
  function loadVoices() {
    if (!window.speechSynthesis) return;
    voices = window.speechSynthesis.getVoices() || [];
    chosenVoice = pickVoice();
  }

  // Prefer a natural/neural voice in the active language; fall back to any
  // voice of that language, then to the platform default.
  function pickVoice() {
    if (!voices.length) return null;
    var want = S.lang === 'fr' ? 'fr' : 'en';
    var pool = voices.filter(function (v) { return (v.lang || '').toLowerCase().indexOf(want) === 0; });
    if (!pool.length) return null;
    var preferred = ['natural', 'neural', 'google', 'amélie', 'amelie', 'thomas', 'audrey', 'samantha', 'daniel', 'serena'];
    for (var p = 0; p < preferred.length; p++) {
      for (var i = 0; i < pool.length; i++) {
        if ((pool[i].name || '').toLowerCase().indexOf(preferred[p]) !== -1) return pool[i];
      }
    }
    return pool[0];
  }

  // Speech synthesis reads punctuation and symbols literally, so anything
  // that looks like markup is stripped before it reaches the voice.
  function speakable(text) {
    return String(text)
      .replace(/https?:\/\/\S+/g, S.lang === 'fr' ? 'le lien affiché' : 'the link on screen')
      .replace(/[*_`#>|]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function speak(text, onDone) {
    var clean = speakable(text);
    if (!clean) { if (onDone) onDone(); return; }
    if (!S.voiceOn || !window.speechSynthesis) {
      setState('idle');
      if (onDone) onDone();
      return;
    }
    stopListening(); // half-duplex: never transcribe our own loudspeaker
    S.speaking = true;
    setState('speaking');

    var utter = new window.SpeechSynthesisUtterance(clean);
    utter.lang = S.lang === 'fr' ? 'fr-FR' : 'en-US';
    if (chosenVoice) utter.voice = chosenVoice;
    utter.rate = S.rate;
    utter.pitch = 1;
    utter.volume = 1;

    var finished = false;
    var finish = function () {
      if (finished) return;
      finished = true;
      S.speaking = false;
      S.lastSpokeAt = Date.now();
      if (onDone) onDone();
    };
    utter.onend = finish;
    utter.onerror = finish;

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch (e) { finish(); }

    // Two long-standing speech-synthesis defects are handled here, because
    // either one leaves the machine deaf and frozen in "speaking":
    //   1. onend sometimes never fires (backgrounded tab, no installed
    //      voice, an engine that silently drops the utterance). A poll
    //      settles it: once the queue is empty, the turn is over.
    //   2. Chrome stops speaking after roughly fifteen seconds unless the
    //      queue is nudged; pause/resume keeps a long answer alive.
    var elapsed = 0, everSpoke = false;
    var poll = window.setInterval(function () {
      elapsed += 300;
      var synth = window.speechSynthesis;
      if (finished || !synth) { window.clearInterval(poll); finish(); return; }
      if (synth.speaking) everSpoke = true;
      // Done when the queue drains after speech actually started, or when
      // the engine never started at all (no installed voice, muted device).
      if (!synth.speaking && !synth.pending && (everSpoke || elapsed > 3000)) {
        window.clearInterval(poll);
        finish();
        return;
      }
      if (elapsed % 9000 === 0 && synth.speaking) { try { synth.pause(); synth.resume(); } catch (e) { /* ignore */ } }
      if (elapsed > Math.min(120000, 6000 + clean.length * 120)) {
        window.clearInterval(poll);
        try { synth.cancel(); } catch (e) { /* ignore */ }
        finish();
      }
    }, 300);
    var clearPoll = function () { window.clearInterval(poll); };
    utter.onend = function () { clearPoll(); finish(); };
    utter.onerror = function () { clearPoll(); finish(); };
  }

  function shutUp() {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    S.speaking = false;
  }

  /* ------------------------------------------------------------------ recogniser */
  function speechEngine() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function buildRecogniser() {
    var Engine = speechEngine();
    if (!Engine) return null;
    var r = new Engine();
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.lang = S.lang === 'fr' ? 'fr-FR' : 'en-US';

    r.onstart = function () { recRunning = true; };

    r.onresult = function (event) {
      if (S.speaking || S.pending) return;
      var finalText = '', interimText = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += chunk; else interimText += chunk;
      }
      if (finalText) {
        pendingFinal += (pendingFinal ? ' ' : '') + finalText.trim();
        interim = '';
      } else {
        interim = interimText;
      }
      showLive((pendingFinal + ' ' + interim).trim(), !finalText);
      window.clearTimeout(followUpTimer); // the operator is talking: stop the sleep countdown
      window.clearTimeout(silenceTimer);
      silenceTimer = window.setTimeout(commitUtterance, SILENCE_MS);
    };

    r.onerror = function (event) {
      var code = event && event.error;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        S.shouldListen = false;
        fail(t('micDenied'));
        return;
      }
      if (code === 'no-speech' || code === 'aborted' || code === 'audio-capture') return;
      if (code === 'network') addEntry('system', t('netError'));
    };

    r.onend = function () {
      recRunning = false;
      // Chrome ends the session after a few seconds of silence. Restart it
      // whenever the machine still wants to hear, with a short delay so a
      // failing engine cannot spin the loop.
      if (S.shouldListen && !S.speaking) {
        window.clearTimeout(restartTimer);
        restartTimer = window.setTimeout(function () { startListening(true); }, 260);
      } else {
        S.listening = false;
        if (S.state === 'listening') setState('idle');
      }
    };
    return r;
  }

  function startListening(silent) {
    if (!rec) rec = buildRecogniser();
    if (!rec) return;
    S.shouldListen = true;
    if (recRunning) { S.listening = true; setState('listening'); return; }
    try {
      rec.start();
      S.listening = true;
      setState('listening');
      if (!silent) showLive('', false);
    } catch (e) {
      // start() throws if the engine is already running; treat as listening.
      S.listening = true;
    }
  }

  function stopListening() {
    S.shouldListen = false;
    S.listening = false;
    window.clearTimeout(restartTimer);
    window.clearTimeout(silenceTimer);
    window.clearTimeout(followUpTimer);
    try { if (rec && recRunning) rec.stop(); } catch (e) { /* ignore */ }
    if (window.PreciousReactor) window.PreciousReactor.setLevel(0);
    if (el.levelBar) el.levelBar.style.width = '0%';
  }

  function sleep(announce) {
    stopListening();
    pendingFinal = ''; interim = '';
    showLive('', false);
    setState('idle');
    if (announce) speak(t('sleeping'), function () { setState('idle'); });
  }

  /* ---------------- utterance -> intent ---------------- */
  function commitUtterance() {
    var said = (pendingFinal + ' ' + interim).trim();
    pendingFinal = ''; interim = '';
    if (!said) return;

    // Ambient mode needs the wake word, unless PRECIOUS has just spoken —
    // a natural follow-up ("and the second one?") must not need it.
    if (S.ambient) {
      var recent = Date.now() - S.lastSpokeAt < FOLLOWUP_MS;
      if (!WAKE.test(said) && !recent) { showLive('', false); return; }
      said = said.replace(WAKE, '').replace(/^[\s,.:;!?—-]+/, '').trim();
      if (!said) { showLive('', false); return; }
    }

    if (localCommand(said)) { showLive('', false); return; }

    showLive(said, false);
    addEntry('user', said);
    send(said);
  }

  // A few orders are handled on the device itself: they must work with no
  // network, no latency and no token spend.
  function localCommand(said) {
    var s = said.toLowerCase().replace(/[.!?,]/g, ' ').replace(/\s+/g, ' ').trim();
    // Anchored at both ends on purpose: "arrête le minuteur" is an order
    // about a timer, not an order to go to sleep, and a prefix match would
    // silence the machine instead of cancelling the countdown.
    var stop = /^(precious[, ]*)?(arr[êe]te|arr[êe]tez|stop|silence|chut|tais[- ]toi|mets[- ]toi en veille|veille|stop listening|go to sleep|sleep|shut up|that'?s all)( precious| s'?il te pla[îi]t| s'?il vous pla[îi]t| please| now| maintenant)*$/;
    if (stop.test(s)) { addEntry('user', said); sleep(true); return true; }
    if (/^(precious[, ]*)?(r[ée]veille[- ]toi|wake up|hey precious|ok precious)$/.test(s)) {
      addEntry('user', said);
      startListening();
      speak(t('awake'), function () { startListening(); });
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ transport */
  function context() {
    var now = Date.now();
    return {
      now: new Date().toISOString(),
      timezone: (function () {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
      })(),
      locale: navigator.language || '',
      language: S.lang,
      memory: S.memory.slice(0, 40).map(function (m) { return { label: m.label, value: m.value }; }),
      timers: S.timers.map(function (x) {
        return { label: x.label, remaining: Math.max(0, Math.round((x.endsAt - now) / 1000)) };
      })
    };
  }

  function send(text) {
    S.pending = true;
    stopListening();
    setState('thinking');
    S.history.push({ role: 'user', content: text.slice(0, 1200) });
    trimHistory();
    saveSession();

    var started = Date.now();
    var payload = { messages: S.history, context: context() };
    if (S.operatorKey) { payload.mode = 'operator'; payload.key = S.operatorKey; }

    window.fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { status: res.status, data: data };
      });
    }).then(function (out) {
      if (el.roLatency) el.roLatency.textContent = ((Date.now() - started) / 1000).toFixed(1) + 's';

      if (out.status === 403 && S.operatorKey) {
        S.operatorKey = null;
        try { window.sessionStorage.removeItem(STORE.key); } catch (e) { /* ignore */ }
        setMode('public');
        S.history.pop();
        respond(t('keyRejected'));
        return;
      }
      if (out.status === 429) { S.history.pop(); respond(t('busy')); return; }
      if (out.status === 503) { S.history.pop(); respond(t('offline')); return; }
      if (out.status !== 200 || !out.data || !out.data.say) { S.history.pop(); respond(t('netError')); return; }

      if (out.data.mode === 'operator') setMode('operator');
      S.history.push({ role: 'assistant', content: String(out.data.say).slice(0, 4000) });
      trimHistory();
      saveSession();
      S.turns += 1;
      if (el.roTurns) el.roTurns.textContent = String(S.turns);

      runActions(out.data.actions);
      respond(out.data.say);
    }).catch(function () {
      S.history.pop();
      respond(t('netError'));
    });
  }

  // Say something and hand the microphone straight back. A conversation
  // that needs a tap between every sentence is not a conversation, so the
  // microphone reopens by itself and only sleeps after a real silence.
  function respond(text) {
    S.pending = false;
    addEntry('precious', text);
    showLive(text, false);
    speak(text, function () {
      startListening(true);
      if (!S.ambient) armFollowUp();
    });
  }

  function armFollowUp() {
    window.clearTimeout(followUpTimer);
    followUpTimer = window.setTimeout(function () {
      if (S.speaking || S.pending) return;
      if (pendingFinal || interim) return; // mid-sentence: let it finish
      sleep(false);
    }, FOLLOWUP_MS);
  }

  function trimHistory() {
    while (S.history.length > MAX_TURNS) S.history.shift();
    if (S.history.length && S.history[0].role !== 'user') S.history.shift();
  }

  /* ------------------------------------------------------------------ actions */
  var DESTINATIONS = {
    home: '/',
    business_intelligence: '/bi',
    mwinda_os: '/os',
    demo: '/demo',
    contact: '/#contact',
    whatsapp: 'https://wa.me/17065725957'
  };

  // The model's tool calls are re-checked here. The function already
  // sanitises them; this second gate means a compromised response still
  // cannot reach anything but these eight local operations.
  function runActions(actions) {
    if (!Array.isArray(actions)) return;
    for (var i = 0; i < actions.length && i < 6; i++) {
      var a = actions[i] || {};
      switch (a.name) {
        case 'remember': doRemember(a.label, a.value); break;
        case 'forget': doForget(a.label); break;
        case 'clear_memory': S.memory = []; writeJSON(STORE.mem, S.memory); renderMemory(); break;
        case 'set_timer': doTimer(a.seconds, a.label); break;
        case 'cancel_timers': S.timers = []; renderTimers(); break;
        case 'open_destination': doOpen(a.destination); break;
        case 'set_language': if (a.language !== S.lang) applyLanguage(a.language); break;
        case 'set_speech_rate': doRate(a.rate); break;
        case 'stop_listening': window.setTimeout(function () { sleep(false); }, 400); break;
        default: break;
      }
    }
  }

  function doRemember(label, value) {
    if (typeof label !== 'string' || typeof value !== 'string') return;
    label = label.slice(0, 40).trim();
    value = value.slice(0, 240).trim();
    if (!label || !value) return;
    var found = false;
    for (var i = 0; i < S.memory.length; i++) {
      if (S.memory[i].label.toLowerCase() === label.toLowerCase()) { S.memory[i].value = value; found = true; break; }
    }
    if (!found) S.memory.push({ label: label, value: value, at: Date.now() });
    while (S.memory.length > 60) S.memory.shift();
    writeJSON(STORE.mem, S.memory);
    renderMemory();
  }

  function doForget(label) {
    if (typeof label !== 'string') return;
    var needle = label.toLowerCase().trim();
    S.memory = S.memory.filter(function (m) {
      return m.label.toLowerCase() !== needle && m.label.toLowerCase().indexOf(needle) === -1;
    });
    writeJSON(STORE.mem, S.memory);
    renderMemory();
  }

  function doTimer(seconds, label) {
    seconds = Math.round(Number(seconds));
    if (!isFinite(seconds) || seconds < 5 || seconds > 86400) return;
    if (S.timers.length >= 6) S.timers.shift();
    S.timers.push({ endsAt: Date.now() + seconds * 1000, label: (label || '').slice(0, 60) });
    renderTimers();
  }

  function doOpen(destination) {
    var url = DESTINATIONS[destination];
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  }

  function doRate(rate) {
    rate = Number(rate);
    if (!isFinite(rate)) return;
    S.rate = Math.min(1.8, Math.max(0.6, rate));
    try { window.localStorage.setItem(STORE.rate, String(S.rate)); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ clocks */
  function everySecond() {
    if (el.roClock) {
      el.roClock.textContent = new Date().toLocaleTimeString(S.lang === 'fr' ? 'fr-FR' : 'en-GB', { hour12: false });
    }
    if (S.timers.length) {
      var now = Date.now(), done = [];
      S.timers = S.timers.filter(function (x) {
        if (x.endsAt <= now) { done.push(x); return false; }
        return true;
      });
      renderTimers();
      for (var i = 0; i < done.length; i++) {
        var line = done[i].label ? t('timerDoneLabel') + done[i].label + '.' : t('timerDone');
        addEntry('system', line);
        if (!S.speaking && !S.pending) speak(line, function () { if (S.ambient) startListening(true); else setState('idle'); });
      }
    }
  }

  /* ------------------------------------------------------------------ controls */
  function setPressed(node, on) {
    if (!node) return;
    node.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function setMode(mode) {
    S.mode = mode;
    if (!el.modeChip) return;
    el.modeChip.textContent = mode === 'operator' ? 'OPÉRATEUR' : 'PUBLIC';
    el.modeChip.className = 'brand-sub' + (mode === 'operator' ? ' operator' : '');
  }

  function toggleTalk() {
    if (S.speaking) { shutUp(); setState('idle'); return; }
    if (S.listening) { sleep(false); return; }
    startListening();
  }

  function bindControls() {
    if (el.orb) el.orb.addEventListener('click', toggleTalk);
    if (el.btnTalk) el.btnTalk.addEventListener('click', toggleTalk);

    if (el.btnAmbient) el.btnAmbient.addEventListener('click', function () {
      S.ambient = !S.ambient;
      setPressed(el.btnAmbient, S.ambient);
      if (S.ambient) { startListening(); speak(t('ambientOn'), function () { startListening(true); }); }
      else { sleep(false); speak(t('ambientOff'), function () { setState('idle'); }); }
    });

    if (el.btnVoice) el.btnVoice.addEventListener('click', function () {
      S.voiceOn = !S.voiceOn;
      setPressed(el.btnVoice, S.voiceOn);
      el.btnVoice.classList.toggle('off', !S.voiceOn);
      if (!S.voiceOn) { shutUp(); addEntry('system', t('voiceOff')); }
      else speak(t('voiceOn'), function () { if (S.ambient) startListening(true); else setState('idle'); });
    });

    if (el.btnLang) el.btnLang.addEventListener('click', function () {
      applyLanguage(S.lang === 'fr' ? 'en' : 'fr');
      speak(t('langSwitched'), function () { if (S.ambient) startListening(true); else setState('idle'); });
    });

    if (el.btnHelp) el.btnHelp.addEventListener('click', function () {
      var open = el.helpSheet.hidden;
      el.helpSheet.hidden = !open;
      el.btnHelp.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    if (el.helpClose) el.helpClose.addEventListener('click', function () {
      el.helpSheet.hidden = true;
      el.btnHelp.setAttribute('aria-expanded', 'false');
    });
  }

  /* ------------------------------------------------------------------ boot */
  function fail(message) {
    setState('error');
    if (el.gateFail) { el.gateFail.hidden = false; el.gateFail.textContent = message; }
    addEntry('system', message);
  }

  function showUnsupported() {
    if (el.gate) el.gate.hidden = true;
    if (el.unsupported) el.unsupported.hidden = false;
  }

  function readOperatorKey() {
    // The key arrives in the URL fragment (a bookmark), never by voice: a
    // spoken secret is not a secret. It is removed from the address bar at
    // once so it cannot be read over a shoulder or land in a screenshot.
    var hash = window.location.hash || '';
    var match = hash.match(/(?:^#|&)(?:k|key)=([^&]+)/);
    if (match) {
      S.operatorKey = decodeURIComponent(match[1]).slice(0, 200);
      try { window.sessionStorage.setItem(STORE.key, S.operatorKey); } catch (e) { /* ignore */ }
      try { window.history.replaceState(null, '', window.location.pathname + window.location.search); }
      catch (e) { window.location.hash = ''; }
      setMode('operator');
      return;
    }
    try {
      var stored = window.sessionStorage.getItem(STORE.key);
      if (stored) { S.operatorKey = stored; setMode('operator'); }
    } catch (e) { /* ignore */ }
  }

  function bootMicrophone() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('no-media'));
    }
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
  }

  function ignite() {
    if (S.booted) return;
    if (el.gateBtn) el.gateBtn.disabled = true;

    // Warm the synthesiser inside the user gesture: iOS refuses to speak
    // later otherwise, and a silent assistant is a dead assistant.
    try {
      if (window.speechSynthesis) {
        var warm = new window.SpeechSynthesisUtterance(' ');
        warm.volume = 0;
        window.speechSynthesis.speak(warm);
      }
    } catch (e) { /* ignore */ }

    bootMicrophone().then(function (stream) {
      micStream = stream;
      S.booted = true;
      startAudioMeter(stream);

      if (el.gate) {
        el.gate.classList.add('closing');
        window.setTimeout(function () { el.gate.hidden = true; }, 420);
      }
      if (el.console) el.console.hidden = false;
      if (window.PreciousReactor) window.PreciousReactor.mount(el.orb, el.reactor);

      setMode(S.operatorKey ? 'operator' : 'public');
      setState('idle');
      renderMemory();
      renderTimers();

      var hello = S.operatorKey ? t('greetingOperator') : t('greeting');
      addEntry('precious', hello);
      speak(hello, function () { startListening(); });
    }).catch(function (error) {
      if (el.gateBtn) el.gateBtn.disabled = false;
      var name = error && error.name;
      fail(name === 'NotFoundError' || name === 'DevicesNotFoundError' ? t('micMissing') : t('micDenied'));
    });
  }

  function registerWorker() {
    if (!('serviceWorker' in navigator)) return;
    // Scope is pinned to /precious so the offline shell of the assistant
    // can never take over the marketing site's pages.
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/precious-sw.js', { scope: '/precious' })
        .catch(function () { /* offline shell is a bonus, not a requirement */ });
    });
  }

  function init() {
    var stored = null;
    try { stored = window.localStorage.getItem(STORE.lang); } catch (e) { /* ignore */ }
    var navLang = (navigator.language || 'fr').toLowerCase().indexOf('fr') === 0 ? 'fr' : 'en';
    applyLanguage(stored || navLang);

    S.memory = readJSON(STORE.mem, []);
    S.history = readSession();
    try {
      var r = parseFloat(window.localStorage.getItem(STORE.rate));
      if (isFinite(r)) S.rate = Math.min(1.8, Math.max(0.6, r));
    } catch (e) { /* ignore */ }

    readOperatorKey();

    if (!speechEngine()) { showUnsupported(); return; }

    if (window.speechSynthesis) {
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    bindControls();
    setPressed(el.btnVoice, true);
    if (el.gateBtn) el.gateBtn.addEventListener('click', ignite);
    window.setInterval(everySecond, 1000);
    everySecond();
    registerWorker();

    // Restoring a reloaded conversation keeps the machine's short-term
    // memory across an accidental refresh.
    for (var i = 0; i < S.history.length; i++) {
      addEntry(S.history[i].role === 'user' ? 'user' : 'precious', S.history[i].content);
    }
    S.turns = Math.floor(S.history.length / 2);
    if (el.roTurns) el.roTurns.textContent = String(S.turns);

    window.addEventListener('pagehide', function () {
      shutUp();
      stopListening();
      if (micStream) { micStream.getTracks().forEach(function (tr) { tr.stop(); }); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
