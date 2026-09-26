/* ============================================================
   MWINDA AI BUSINESS INTELLIGENCE — client
   - Six generation stages, each editable before the next.
   - Financial projections are computed HERE, not by the model:
     the model proposes assumptions, JavaScript does the arithmetic,
     so the numbers are internally consistent and live-editable.
   - Everything is rendered with textContent. No AI output is ever
     inserted as HTML.
   ============================================================ */
(() => {
  'use strict';

  const ENDPOINT = '/.netlify/functions/bi';
  const STATUS_ENDPOINT = '/.netlify/functions/bi-status';
  // The engine dispatches to a background worker and we poll: often at first
  // (short stages finish in seconds), then less often — a two-minute plan does
  // not need a request every second, and "generate everything" polls four jobs.
  const pollDelay = (elapsed) => (elapsed < 10000 ? 1500 : elapsed < 60000 ? 2500 : 3500);
  // The worker's own ceiling is 15 minutes. Give up before that, because a
  // stage that has not finished in eight is not going to.
  const MAX_WAIT_MS = 8 * 60 * 1000;
  const STAGE_TITLES = {
    analyze: 'idea analysis', model: 'business model', plan: 'business plan',
    financials: 'financial assumptions', compliance: 'regulatory checklist',
    roadmap: 'execution roadmap',
  };
  /**
   * What each stage is written from. Everything after the business model reads
   * only the analysis and the model — which is what lets the plan, the
   * financials, the checklist and the roadmap run at the same time, and keeps
   * every request small (~15 KB) instead of echoing the whole plan back up a
   * mobile connection at every step.
   */
  const DEPS = {
    analyze: [], model: ['analyze'],
    plan: ['analyze', 'model'], financials: ['analyze', 'model'],
    compliance: ['analyze', 'model'], roadmap: ['analyze', 'model'],
  };
  /** Honest expectations, shown while a stage runs. */
  const EXPECT = {
    analyze: 'usually under a minute', model: 'usually 30-60 s', plan: 'usually 1-2 min',
    financials: 'usually under 30 s', compliance: 'usually under a minute', roadmap: 'usually 30-60 s',
  };
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const PROJECT_API = '/.netlify/functions/project';
  const STORE = 'mwinda.bi.project';
  const LIST = 'mwinda.bi.projects';
  const KEYS = 'mwinda.bi.keys';   // { projectId: ownerToken }

  /* ---------------------------------------------------------------------
     Remote persistence (Supabase, behind our own function).
     Entirely optional: if the server has no database configured it answers
     501 and everything below quietly no-ops, leaving the browser copy as the
     single source of truth exactly as before.
     --------------------------------------------------------------------- */
  const remote = {
    available: true,        // flipped off after a 501
    status: 'local',        // local | syncing | synced | error

    /* Own projects keep their token in localStorage. A project opened from
       someone else's access link keeps it in sessionStorage only: it is their
       confidential business plan, and it must not outlive the tab on a shared
       or public machine. */
    keys() {
      let own = {}, shared = {};
      try { own = JSON.parse(localStorage.getItem(KEYS) || '{}'); } catch { /* ignore */ }
      try { shared = JSON.parse(sessionStorage.getItem(KEYS) || '{}'); } catch { /* ignore */ }
      return Object.assign({}, own, shared);
    },
    setKey(id, token, ephemeral) {
      const store = ephemeral ? sessionStorage : localStorage;
      let k = {};
      try { k = JSON.parse(store.getItem(KEYS) || '{}'); } catch { /* ignore */ }
      k[id] = token;
      try { store.setItem(KEYS, JSON.stringify(k)); } catch { /* full */ }
    },

    async call(payload) {
      const res = await fetch(PROJECT_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 501) { this.available = false; throw new Error('no storage'); }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
      return data;
    },

    /** Create on first real content, then update. Never throws to callers. */
    async sync(p) {
      if (!this.available) return;
      try {
        setSync('syncing');
        const token = this.keys()[p.remoteId];
        if (p.remoteId && token) {
          await this.call({ action: 'save', id: p.remoteId, token, project: p });
        } else {
          const out = await this.call({ action: 'create', project: p });
          p.remoteId = out.id;
          this.setKey(out.id, out.token);
          try { localStorage.setItem(STORE, JSON.stringify(p)); } catch { /* full */ }
        }
        setSync('synced');
      } catch {
        setSync(this.available ? 'error' : 'local');
      }
    },

    async load(id, token) {
      const out = await this.call({ action: 'load', id, token });
      return out.project;
    },

    event(name, id) {
      if (!this.available) return;
      // Send the ownership token too: the server only attaches the project to
      // the event when it can prove the caller owns it, which keeps the KPI
      // board honest. Costs us nothing — we already hold it.
      fetch(PROJECT_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'event', event: name, id: id || null, token: id ? (this.keys()[id] || null) : null }),
      }).catch(() => { /* analytics is best-effort */ });
    },
  };

  /**
   * Whether this browser will actually keep anything.
   *
   * Safari's Private Browsing and several in-app WebViews (WhatsApp,
   * Instagram, Gmail) refuse localStorage outright — the write throws. The app
   * still runs, because `project` lives in memory, but a reload then wipes an
   * hour of generation. Those WebViews reload constantly: on backgrounding, on
   * memory pressure, on following a link and coming back.
   *
   * Measured before this existed: six stages generated fine, the indicator
   * said "Saved in this browser", and one reload left the dossier empty. The
   * indicator must never claim a save that cannot happen.
   */
  let persistOk = (() => {
    try {
      localStorage.setItem('mwinda.probe', '1');
      localStorage.removeItem('mwinda.probe');
      return true;
    } catch { return false; }
  })();

  let syncTimer = null;
  function setSync(state) {
    remote.status = state;
    const el = document.getElementById('syncState');
    if (!el) return;
    // "Saved in this browser" is false when the browser is refusing to store.
    if (!persistOk && (state === 'local' || state === 'error')) state = 'unsaved';
    const label = {
      local: 'Saved in this browser',
      syncing: 'Saving…',
      synced: 'Saved to your MWINDA account',
      error: 'Saved locally — server unreachable',
      unsaved: 'NOT saved — this browser blocks storage. Download your dossier before leaving this page.',
    }[state] || '';
    el.textContent = label;
    el.className = 'sync ' + state;
  }

  const STEPS = [
    { id: 'start', label: '00 · Project' },
    { id: 'analyze', label: '01 · Analysis' },
    { id: 'model', label: '02 · Business model' },
    { id: 'plan', label: '03 · Business plan' },
    { id: 'financials', label: '04 · Financials' },
    { id: 'compliance', label: '05 · Compliance' },
    { id: 'roadmap', label: '06 · Roadmap' },
    { id: 'dossier', label: '07 · Dossier' },
  ];

  const INTENTS = [
    'Create a company', 'Grow an existing business', 'Launch a startup',
    'Develop a project', 'Test an idea', 'Find a business opportunity',
  ];

  const COUNTRIES = [
    'Democratic Republic of Congo', 'Republic of Congo', 'Angola', 'Rwanda', 'Burundi',
    'Uganda', 'Kenya', 'Tanzania', 'Zambia', 'South Africa', 'Nigeria', 'Ghana',
    'Ivory Coast', 'Senegal', 'Cameroon', 'Gabon', 'Benin', 'Togo', 'Mali',
    'Burkina Faso', 'Niger', 'Chad', 'Central African Republic', 'Ethiopia',
    'Morocco', 'Algeria', 'Tunisia', 'Egypt', 'Mozambique', 'Zimbabwe', 'Botswana',
    'Namibia', 'Madagascar', 'Mauritius',
    'France', 'Belgium', 'United Kingdom', 'Germany', 'Netherlands', 'Spain',
    'Italy', 'Portugal', 'Switzerland', 'Luxembourg', 'Ireland',
    'United States', 'Canada', 'Brazil', 'Mexico',
    'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Turkey',
    'India', 'China', 'Singapore', 'Japan', 'Australia', 'Other',
  ];

  const SECTORS = [
    'Technology', 'Artificial Intelligence', 'Fintech', 'E-commerce', 'Retail',
    'Agriculture & Agribusiness', 'Food & Beverage', 'Logistics & Transport',
    'Health', 'Education', 'Energy', 'Construction & Real estate',
    'Manufacturing', 'Mining & Resources', 'Media & Creative', 'Tourism & Hospitality',
    'Professional services', 'Finance & Insurance', 'Telecommunications',
    'Social impact / NGO', 'Other',
  ];

  const TYPES = [
    'SaaS', 'Marketplace', 'Mobile app', 'E-commerce store', 'Consulting / Services',
    'Agency', 'Physical retail', 'Manufacturing', 'Distribution / Wholesale',
    'Franchise', 'Cooperative', 'Non-profit', 'Freelance / Independent', 'Other',
  ];

  // --------------------------------------------------------------- helpers --
  const $ = (id) => document.getElementById(id);

  /** Build an element. Strings become text nodes — never markup. */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.appendChild(typeof kid === 'object' ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); };
  const arr = (v) => Array.isArray(v) ? v : [];
  const num = (v, fallback = 0) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : fallback;
  };

  // ----------------------------------------------------------------- state --
  const blank = () => ({
    id: 'p' + Date.now().toString(36),
    remoteId: null,
    shared: false,
    createdAt: new Date().toISOString(),
    progress: 0,
    intent: '', country: '', region: '', city: '', budget: '',
    sector: '', businessType: '', idea: '',
    answers: {},
    stages: {},        // analyze | model | plan | financials | compliance | roadmap
    tasksDone: {},     // "phaseIndex:taskIndex" -> true
    checked: {},       // compliance item index -> true
    pending: {},       // stage -> { jobId, at } while the engine works on it
  });

  let project = blank();
  let current = 'start';

  function save() {
    // Debounced: typing in an editable field must not produce a request per
    // keystroke. Two seconds after the last change, push to the server.
    if (remote.available) {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => remote.sync(project), 2000);
    }
    project.progress = Math.round(Object.keys(project.stages).length / 6 * 100);
    try {
      localStorage.setItem(STORE, JSON.stringify(project));
      // A dossier opened from someone else's link is never added to the saved
      // list — it would sit in the panel of whoever was shown it once.
      if (project.shared) return;
      const list = JSON.parse(localStorage.getItem(LIST) || '[]')
        .filter((p) => p.id !== project.id);
      list.unshift({
        id: project.id,
        name: (project.idea || 'Untitled project').slice(0, 70),
        country: project.country,
        updatedAt: new Date().toISOString(),
        progress: Math.round(Object.keys(project.stages).length / 6 * 100),
        data: project,
      });
      localStorage.setItem(LIST, JSON.stringify(list.slice(0, 8)));
      persistOk = true;
    } catch {
      // The session still works — everything is in memory — but a reload will
      // take it all. Say so, rather than showing "Saved in this browser".
      persistOk = false;
      setSync(remote.available ? remote.status : 'local');
    }
  }

  /* A browser that refuses to store makes leaving the page destructive. Warn
     only when that is true AND there is generated work to lose — never on a
     browser that is saving normally. */
  window.addEventListener('beforeunload', (e) => {
    if (persistOk || remote.status === 'synced') return;
    if (!project || !Object.keys(project.stages || {}).length) return;
    e.preventDefault();
    e.returnValue = '';
    return '';
  });

  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) project = Object.assign(blank(), JSON.parse(raw));
    } catch { /* ignore corrupt state */ }
  }

  // ------------------------------------------------------------------ rail --
  function renderRail() {
    const rail = $('rail');
    clear(rail);
    STEPS.forEach((s) => {
      const reachable = s.id === 'start' || s.id === 'analyze'
        ? true
        : s.id === 'dossier'
          ? !!project.stages.analyze
          : DEPS[s.id].every((d) => project.stages[d]) || !!project.stages[s.id];
      rail.appendChild(h('button', {
        class: [s.id === current ? 'active' : '', project.stages[s.id] ? 'done' : ''].join(' ').trim(),
        disabled: !reachable && s.id !== current,
        onclick: () => go(s.id),
        text: s.label,
      }));
    });
  }
  const ORDER = ['analyze', 'model', 'plan', 'financials', 'compliance', 'roadmap'];

  function go(id) {
    current = id;
    // The dossier is assembled from whatever exists *now*. Reaching it from the
    // rail used to show the copy built at page load — often empty.
    if (id === 'dossier') renderDossier();
    document.querySelectorAll('.step').forEach((s) => s.classList.toggle('active', s.id === 'step-' + id));
    renderRail();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // -------------------------------------------------------------- generate --
  /**
   * The engine, in two layers: `runStage` talks to the server and keeps the
   * project up to date; `generate` puts a status line on the page around it.
   *
   * A stage runs 20-120 seconds, so it is dispatched to a background worker
   * and polled for. Three things make that survive real phones:
   *
   *  · The job id is saved with the project the moment it exists. A reload, an
   *    in-app browser that recycles the page, a phone that drops the tab — the
   *    work carries on server-side, and on the next load `resumePending()`
   *    picks the same job up instead of throwing an hour's wait away.
   *  · A finished result stays on the server until this page acknowledges it.
   *    It used to be deleted on the first read, so one lost reply lost the
   *    stage.
   *  · One request per stage at a time: clicking twice, or "generate
   *    everything" while a stage is already running, joins the running job.
   */
  const inflight = {};   // stage -> Promise<data>

  /** Only what the stage is written from — see DEPS. */
  function priorFor(stage) {
    const prior = {};
    DEPS[stage].forEach((d) => {
      const data = project.stages[d];
      if (!data) return;
      if (d === 'analyze') {
        // The questions are answered in project.answers, which travels anyway.
        const { clarifyingQuestions, ...rest } = data;   // eslint-disable-line no-unused-vars
        prior[d] = rest;
      } else prior[d] = data;
    });
    return prior;
  }

  function runStage(stage, onProgress) {
    if (inflight[stage]) {
      inflight[stage].listeners.push(onProgress);
      return inflight[stage].promise;
    }
    const listeners = [onProgress];
    const tell = (text) => listeners.forEach((fn) => fn && fn(text));
    const promise = (async () => {
      const pend = project.pending && project.pending[stage];
      let jobId = pend && pend.jobId;
      let started = (pend && pend.at) || Date.now();
      if (!jobId) {
        tell('Contacting the engine…');
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            stage,
            project: {
              intent: project.intent, country: project.country, region: project.region,
              city: project.city, sector: project.sector, businessType: project.businessType,
              budget: project.budget, idea: project.idea, answers: project.answers,
            },
            prior: priorFor(stage),
          }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || ('HTTP ' + res.status));
        if (!out.jobId) throw new Error('the engine did not start the work — please retry');
        jobId = out.jobId;
        started = Date.now();
        project.pending = project.pending || {};
        project.pending[stage] = { jobId, at: started };
        save();
      }
      return pollJob(stage, jobId, started, tell);
    })().finally(() => { delete inflight[stage]; });
    inflight[stage] = { promise, listeners };
    return promise;
  }

  async function pollJob(stage, jobId, started, tell) {
    const secs = () => Math.round((Date.now() - started) / 1000);
    const forget = () => { if (project.pending) delete project.pending[stage]; save(); };
    let misses = 0;
    for (;;) {
      await pause(pollDelay(Date.now() - started));
      if (Date.now() - started > MAX_WAIT_MS) {
        forget();
        throw new Error('this is taking much longer than usual — please retry');
      }
      let status = null;
      try {
        const r = await fetch(STATUS_ENDPOINT + '?job=' + encodeURIComponent(jobId), { cache: 'no-store' });
        const s = await r.json().catch(() => ({}));
        if (r.status === 404 && misses > 3) {
          // Gone for good: expired, or acknowledged by another tab.
          forget();
          throw Object.assign(new Error('the result is no longer available — please retry'), { fatal: true });
        }
        if (r.status === 404 || r.status >= 500 || r.status === 429) status = null;
        else if (!r.ok) throw Object.assign(new Error(s.error || ('HTTP ' + r.status)), { fatal: true });
        else status = s;
      } catch (err) {
        if (err && err.fatal) throw err;
        status = null;                       // a dropped poll, not a failure
      }

      if (!status) {
        if (++misses > 12) throw new Error('lost contact with the engine — check your connection and press Retry; the work is not lost');
        tell('Waiting for the connection… (' + secs() + 's)');
        continue;
      }
      misses = 0;

      if (status.status === 'done') {
        if (!status.data) { forget(); throw new Error('the engine returned nothing — please retry'); }
        project.stages[stage] = status.data;
        forget();
        // Only now may the server let it go.
        fetch(STATUS_ENDPOINT + '?job=' + encodeURIComponent(jobId) + '&ack=1', { cache: 'no-store' }).catch(() => { /* swept later */ });
        return status.data;
      }
      if (status.status === 'error') { forget(); throw new Error(status.error || 'generation failed'); }

      tell((status.chars
        ? 'Writing the ' + (STAGE_TITLES[stage] || stage) + '… ' + (Math.round(status.chars / 100) * 100).toLocaleString('en-US') + ' characters'
        : 'Generating the ' + (STAGE_TITLES[stage] || stage) + '…') + ' · ' + secs() + 's · ' + EXPECT[stage]);
    }
  }

  /**
   * Run a stage with a status line in `host`. On success calls `onDone(data)`;
   * on failure the line turns into the reason plus a Retry button — a founder
   * should never have to hunt for the button that failed.
   */
  async function generate(stage, host, onDone) {
    clear(host);
    const label = h('span', { text: 'Contacting the engine…' });
    const line = h('div', { class: 'status', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'spin' }), label);
    host.appendChild(line);
    if (line.scrollIntoView && line.getBoundingClientRect().top > window.innerHeight - 40) {
      line.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    try {
      const data = await runStage(stage, (text) => { label.textContent = text; });
      clear(host);
      if (onDone) onDone(data);
      return data;
    } catch (e) {
      clear(host);
      host.appendChild(h('div', { class: 'status err', role: 'alert' },
        h('span', { text: '✕ ' + (e.message || 'generation failed') }),
        h('button', {
          class: 'btn ghost small', type: 'button', text: 'Retry',
          onclick: () => generate(stage, host, onDone),
        })));
      return null;
    }
  }

  /** Where a stage's status line lives: under the button that starts it. */
  function hostFor(stage) {
    if (stage === 'analyze') return $('startStatus');
    const btn = document.querySelector('[data-next="' + stage + '"]');
    return btn ? statusHost(btn) : $('startStatus');
  }

  /** After a stage lands: draw it, and follow it if the founder is waiting on it. */
  function landed(stage, fromStep) {
    RENDER[stage]();
    renderRail();
    if (current === fromStep) go(stage);
  }
  const stepOf = (stage) => (stage === 'analyze' ? 'start' : ORDER[ORDER.indexOf(stage) - 1]);

  /** Pick up jobs a previous page load started and never saw finish. */
  function resumePending() {
    const pend = project.pending || {};
    Object.keys(pend).forEach((stage) => {
      if (!STAGE_TITLES[stage] || !pend[stage] || !pend[stage].jobId || Date.now() - pend[stage].at > MAX_WAIT_MS) {
        delete pend[stage];
        return;
      }
      generate(stage, hostFor(stage), () => landed(stage, stepOf(stage)));
    });
  }

  /**
   * "Generate the complete dossier": the business model first (everything else
   * is written from it), then the plan, financials, checklist and roadmap all
   * at once. About the time of the plan alone, instead of the sum of five.
   */
  async function generateAll(host) {
    clear(host);
    const todo = ORDER.filter((s) => s !== 'analyze' && !project.stages[s]);
    if (!project.stages.analyze) {
      host.appendChild(h('div', { class: 'status err', text: 'Run “Analyse my idea” first — everything else is written from it.' }));
      return;
    }
    if (!todo.length) { go('dossier'); return; }
    document.querySelectorAll('[data-all]').forEach((b) => { b.disabled = true; });

    const list = h('div', { class: 'status-all', role: 'status', 'aria-live': 'polite' });
    host.appendChild(list);
    // The button sits at the foot of a long analysis; on a phone the progress
    // would otherwise appear below the fold, and the tap would look ignored.
    list.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const rows = {};
    todo.forEach((s) => {
      const state = h('span', { class: 'st', text: s === 'model' ? 'starting…' : 'waiting for the business model' });
      rows[s] = { el: h('div', { class: 'row' }, h('span', { class: 'ic spin' }), h('b', { text: STAGE_TITLES[s] }), state), state };
      list.appendChild(rows[s].el);
    });
    const mark = (s, ok, text) => {
      const r = rows[s];
      r.el.className = 'row ' + (ok ? 'ok' : 'bad');
      r.el.firstChild.className = 'ic';
      r.el.firstChild.textContent = ok ? '✓' : '✕';
      r.state.textContent = text;
    };
    const run = (s) => runStage(s, (t) => { rows[s].state.textContent = t; })
      .then((d) => { RENDER[s](); renderRail(); mark(s, true, 'done'); return d; })
      .catch((e) => { mark(s, false, e.message || 'failed'); throw e; });

    let failed = [];
    try {
      if (rows.model) await run('model');
      const rest = todo.filter((s) => s !== 'model');
      const settled = await Promise.allSettled(rest.map(run));
      failed = rest.filter((s, i) => settled[i].status === 'rejected');
    } catch {
      failed = todo;
      todo.filter((s) => s !== 'model').forEach((s) => mark(s, false, 'needs the business model'));
    }
    document.querySelectorAll('[data-all]').forEach((b) => { b.disabled = false; });

    if (failed.length) {
      host.appendChild(h('div', { class: 'status err', role: 'alert' },
        h('span', { text: failed.length + ' section' + (failed.length > 1 ? 's' : '') + ' could not be generated. Everything else is saved.' }),
        h('button', { class: 'btn ghost small', type: 'button', text: 'Retry the missing ones', onclick: () => generateAll(host) })));
      return;
    }
    clear(host);
    go('dossier');
    pdfNote('Your complete dossier is ready. Review it below, then download the PDF.', 'ok');
  }

  // ------------------------------------------------------- stage renderers --
  function editable(value, onInput, rows) {
    const ta = h('textarea', { class: 'editable', rows: rows || 3 });
    ta.value = value || '';
    ta.addEventListener('input', () => { onInput(ta.value); save(); });
    // grow to fit content
    const fit = () => { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; };
    ta.addEventListener('input', fit);
    setTimeout(fit, 0);
    return ta;
  }

  function listPanel(title, items, onChange) {
    const ul = h('ul', { class: 'clean' });
    arr(items).forEach((it, i) => {
      ul.appendChild(h('li', {}, editable(it, (v) => { items[i] = v; onChange && onChange(); }, 1)));
    });
    return h('div', { class: 'panel' }, h('h3', { text: title }), ul);
  }

  function renderAnalyze() {
    const d = project.stages.analyze;
    const out = $('analyzeOut');
    clear(out);
    if (!d) return;

    const kv = (label, value) => h('div', { class: 'kv' }, h('dt', { text: label }), h('dd', { text: value || '—' }));

    out.appendChild(h('div', { class: 'panel' },
      h('h3', { text: 'Summary' }),
      h('p', { text: d.summary || '' }),
      h('dl', {}, kv('Problem', d.problem), kv('Solution', d.solution), kv('Value proposition', d.valueProposition), kv('Sector', d.sector)),
    ));

    out.appendChild(h('div', { class: 'grid-2' },
      h('div', { class: 'panel' },
        h('h3', { text: 'Target customers' }),
        h('ul', { class: 'clean' }, arr(d.targetCustomers).map((c) =>
          h('li', {}, h('b', { text: c.segment + ' — ' }), c.description))),
      ),
      h('div', { class: 'panel' },
        h('h3', { text: 'Revenue models to consider' }),
        h('ul', { class: 'clean' }, arr(d.revenueModelOptions).map((r) =>
          h('li', {}, h('b', { text: r.name }), h('span', { class: 'tag ' + r.fit, text: r.fit }), h('br'), r.why))),
      ),
    ));

    out.appendChild(h('div', { class: 'panel' },
      h('h3', { text: 'Risks' }),
      h('ul', { class: 'clean' }, arr(d.risks).map((r) =>
        h('li', {}, h('b', { text: r.risk }), h('span', { class: 'tag ' + r.severity, text: r.severity }), h('br'),
          h('span', { text: 'Mitigation: ' + r.mitigation })))),
    ));

    out.appendChild(h('div', { class: 'grid-3' },
      h('div', { class: 'panel' }, h('h3', { text: 'Opportunities' }),
        h('ul', { class: 'clean' }, arr(d.opportunities).map((o) => h('li', { text: o })))),
      h('div', { class: 'panel' }, h('h3', { text: 'Competitors to research' }),
        h('ul', { class: 'clean' }, arr(d.competitorsToResearch).map((c) => h('li', { text: c })))),
      h('div', { class: 'panel' }, h('h3', { text: 'Assumptions to validate' }),
        h('ul', { class: 'clean' }, arr(d.assumptionsToValidate).map((a) => h('li', { text: a })))),
    ));

    if (arr(d.clarifyingQuestions).length) {
      const panel = h('div', { class: 'panel no-print' }, h('h3', { text: 'Sharpen the analysis' }),
        h('p', { class: 'sub', text: 'Answering these makes everything downstream more specific. Optional.' }));
      d.clarifyingQuestions.forEach((q) => {
        const field = h('div', { class: 'field q' }, h('label', { text: q }));
        const input = h('input', { type: 'text', placeholder: 'Your answer…' });
        input.value = project.answers[q] || '';
        input.addEventListener('input', () => { project.answers[q] = input.value; save(); });
        field.appendChild(input);
        panel.appendChild(field);
      });
      out.appendChild(panel);
    }
  }

  const CANVAS = [
    ['customerSegments', 'Customer segments'], ['valuePropositions', 'Value propositions'],
    ['channels', 'Channels'], ['customerRelationships', 'Customer relationships'],
    ['revenueStreams', 'Revenue streams'], ['keyResources', 'Key resources'],
    ['keyActivities', 'Key activities'], ['keyPartnerships', 'Key partnerships'],
    ['costStructure', 'Cost structure'],
  ];

  function renderModel() {
    const d = project.stages.model;
    const out = $('modelOut');
    clear(out);
    if (!d) return;

    out.appendChild(h('div', { class: 'panel' },
      h('h3', { text: 'Recommended revenue model' }),
      h('p', {}, h('b', { text: d.recommendedRevenueModel || '' })),
      h('p', { class: 'sub', style: 'margin:8px 0 0', text: d.rationale || '' }),
    ));

    const grid = h('div', { class: 'grid-3' });
    CANVAS.forEach(([key, label]) => {
      if (!Array.isArray(d[key])) d[key] = [];
      grid.appendChild(listPanel(label, d[key]));
    });
    out.appendChild(grid);
  }

  function renderPlan() {
    const d = project.stages.plan;
    const out = $('planOut');
    clear(out);
    if (!d) return;
    const panel = h('div', { class: 'panel' });
    arr(d.sections).forEach((s, i) => {
      panel.appendChild(h('div', { class: 'doc-section' },
        h('h4', { text: s.title }),
        editable(s.body, (v) => { d.sections[i].body = v; }, 6),
      ));
    });
    out.appendChild(panel);
  }

  // ------------------------------------------------- financial projections --
  /**
   * The model gives assumptions; this computes the projection.
   * Twelve months, compounding customer growth, fixed vs variable costs,
   * break-even and cumulative cash including the initial investment.
   */
  function project12(a, multiplier) {
    const fixed = num(a.salariesMonthly) + num(a.marketingMonthly) + num(a.technologyMonthly) + num(a.otherOpexMonthly);
    const rows = [];
    let cash = -num(a.initialInvestment);
    let breakEven = null;
    for (let m = 1; m <= 12; m++) {
      const customers = num(a.customersMonth1) * Math.pow(1 + num(a.monthlyGrowthRate), m - 1) * multiplier;
      const revenue = customers * num(a.pricePerUnit);
      const variable = customers * num(a.variableCostPerUnit);
      const gross = revenue - variable;
      const net = gross - fixed;
      cash += net;
      if (breakEven === null && net >= 0) breakEven = m;
      rows.push({ m, customers, revenue, variable, gross, net, cash });
    }
    const total = rows.reduce((t, r) => ({
      revenue: t.revenue + r.revenue, variable: t.variable + r.variable,
      gross: t.gross + r.gross, net: t.net + r.net,
    }), { revenue: 0, variable: 0, gross: 0, net: 0 });
    total.fixed = fixed * 12;
    total.expenses = total.variable + total.fixed;
    total.margin = total.revenue > 0 ? total.net / total.revenue : 0;
    return { rows, total, breakEven, fixedMonthly: fixed, endCash: rows[11].cash };
  }

  const FIELDS = [
    ['initialInvestment', 'Initial investment'], ['pricePerUnit', 'Revenue per customer / month'],
    ['variableCostPerUnit', 'Cost to serve one customer'], ['customersMonth1', 'Customers in month 1'],
    ['monthlyGrowthRate', 'Monthly growth rate (0.15 = 15%)'], ['salariesMonthly', 'Salaries / month'],
    ['marketingMonthly', 'Marketing / month'], ['technologyMonthly', 'Technology / month'],
    ['otherOpexMonthly', 'Other running costs / month'],
  ];

  function renderFinancials() {
    const d = project.stages.financials;
    const out = $('finOut');
    clear(out);
    if (!d) return;
    const cur = d.currency || 'USD';
    const money = (n) => (n < 0 ? '-' : '') + cur + ' ' + Math.abs(Math.round(n)).toLocaleString('en-US');

    // --- editable assumptions ---
    const grid = h('div', { class: 'grid-3' });
    FIELDS.forEach(([key, label]) => {
      const field = h('div', { class: 'field' }, h('label', { text: label }));
      const input = h('input', { type: 'number', step: 'any', min: '0' });
      input.value = num(d.assumptions[key]);
      input.addEventListener('input', () => {
        d.assumptions[key] = num(input.value);
        save();
        drawResults();
      });
      field.appendChild(input);
      grid.appendChild(field);
    });
    out.appendChild(h('div', { class: 'panel' },
      h('h3', { text: 'Assumptions — edit anything' }),
      h('p', { class: 'sub', style: 'margin-bottom:18px', text: 'Currency: ' + cur + '. These are starting estimates, not forecasts. Replace them with your own numbers as soon as you have them.' }),
      grid,
    ));

    if (arr(d.assumptionNotes).length) {
      out.appendChild(h('div', { class: 'panel' }, h('h3', { text: 'Where these numbers come from' }),
        h('ul', { class: 'clean' }, d.assumptionNotes.map((n) => h('li', { text: n })))));
    }

    const results = h('div');
    out.appendChild(results);

    function drawResults() {
      clear(results);
      const mult = d.scenarioMultipliers || { pessimistic: 0.5, realistic: 1, optimistic: 1.6 };
      const scenarios = [
        ['Pessimistic', num(mult.pessimistic, 0.5)],
        ['Realistic', num(mult.realistic, 1)],
        ['Optimistic', num(mult.optimistic, 1.6)],
      ].map(([name, m]) => ({ name, m, r: project12(d.assumptions, m) }));

      // scenario cards
      results.appendChild(h('div', { class: 'grid-3' }, scenarios.map((s) =>
        h('div', { class: 'panel scenario' },
          h('div', { class: 'name', text: s.name + ' · year 1' }),
          h('div', { class: 'num ' + (s.r.total.net >= 0 ? 'pos' : 'neg'), text: money(s.r.total.net) }),
          h('div', { class: 'row' }, h('span', { text: 'Revenue' }), h('span', { text: money(s.r.total.revenue) })),
          h('div', { class: 'row' }, h('span', { text: 'Expenses' }), h('span', { text: money(s.r.total.expenses) })),
          h('div', { class: 'row' }, h('span', { text: 'Margin' }), h('span', { text: (s.r.total.margin * 100).toFixed(1) + '%' })),
          h('div', { class: 'row' }, h('span', { text: 'Break-even' }),
            h('span', { text: s.r.breakEven ? 'month ' + s.r.breakEven : 'not in year 1' })),
        ))));

      // realistic monthly table
      const real = scenarios[1].r;
      const table = h('table', { class: 'fin' },
        h('thead', {}, h('tr', {}, ['Month', 'Customers', 'Revenue', 'Variable', 'Fixed', 'Net', 'Cash'].map((t) => h('th', { text: t })))),
        h('tbody', {}, real.rows.map((r) => h('tr', {},
          h('td', { text: 'M' + r.m }),
          h('td', { text: Math.round(r.customers).toLocaleString('en-US') }),
          h('td', { text: money(r.revenue) }),
          h('td', { text: money(r.variable) }),
          h('td', { text: money(real.fixedMonthly) }),
          h('td', { class: r.net >= 0 ? 'pos' : 'neg', text: money(r.net) }),
          h('td', { class: r.cash >= 0 ? 'pos' : 'neg', text: money(r.cash) }),
        ))),
        h('tfoot', {}, h('tr', { class: 'total' },
          h('td', { text: 'Year 1' }), h('td', { text: '' }),
          h('td', { text: money(real.total.revenue) }),
          h('td', { text: money(real.total.variable) }),
          h('td', { text: money(real.total.fixed) }),
          h('td', { class: real.total.net >= 0 ? 'pos' : 'neg', text: money(real.total.net) }),
          h('td', { class: real.endCash >= 0 ? 'pos' : 'neg', text: money(real.endCash) }),
        )),
      );
      results.appendChild(h('div', { class: 'panel' },
        h('h3', { text: 'Realistic scenario — month by month' }),
        h('div', { style: 'overflow-x:auto' }, table),
        h('p', { class: 'footnote', text: 'Cash includes the initial investment of ' + money(num(d.assumptions.initialInvestment)) + ' as a month-0 outflow. Figures are projections derived from the assumptions above, not forecasts or guarantees.' }),
      ));

      // funding need
      const trough = Math.min(...real.rows.map((r) => r.cash));
      results.appendChild(h('div', { class: 'panel' },
        h('h3', { text: 'What this implies' }),
        h('div', { class: 'metric' }, h('span', { text: 'Lowest cash point (realistic)' }), h('span', { class: trough < 0 ? 'neg' : 'pos', text: money(trough) })),
        h('div', { class: 'metric' }, h('span', { text: 'Capital needed to survive year 1' }), h('span', { text: money(Math.max(0, -trough)) })),
        h('div', { class: 'metric' }, h('span', { text: 'Fixed costs per month' }), h('span', { text: money(real.fixedMonthly) })),
        h('div', { class: 'metric' }, h('span', { text: 'Customers needed to cover fixed costs' }),
          h('span', {
            text: (num(d.assumptions.pricePerUnit) - num(d.assumptions.variableCostPerUnit)) > 0
              ? Math.ceil(real.fixedMonthly / (num(d.assumptions.pricePerUnit) - num(d.assumptions.variableCostPerUnit))).toLocaleString('en-US')
              : 'never — cost to serve exceeds price',
          })),
      ));
    }
    drawResults();
  }

  function renderCompliance() {
    const d = project.stages.compliance;
    const out = $('compOut');
    clear(out);
    if (!d) return;

    out.appendChild(h('div', { class: 'legal-banner' },
      h('b', { text: 'General information, not legal advice. ' }),
      'This checklist is generated by AI to orient you. It is not produced by a lawyer, an accountant or an authority, may be incomplete or out of date, and must be confirmed with the competent bodies in ' + (project.country || 'your country') + ' before you rely on it. Each item shows how confident the engine is.',
    ));

    if (d.jurisdictionNote) {
      out.appendChild(h('div', { class: 'panel' }, h('h3', { text: 'Jurisdiction — ' + (project.country || '') }), h('p', { text: d.jurisdictionNote })));
    }

    const panel = h('div', { class: 'panel' }, h('h3', { text: 'To verify' }));
    arr(d.items).forEach((it, i) => {
      const cb = h('input', { type: 'checkbox' });
      cb.checked = !!project.checked[i];
      cb.addEventListener('change', () => { project.checked[i] = cb.checked; save(); });
      panel.appendChild(h('div', { class: 'check-item' },
        h('div', { class: 'top' }, cb,
          h('div', {},
            h('span', { class: 'req', text: it.requirement }),
            h('span', { class: 'tag conf-' + it.confidence, text: it.confidence + ' confidence' }),
          )),
        h('div', { class: 'meta' },
          h('div', {}, h('b', { text: 'Category: ' }), it.category),
          h('div', {}, h('b', { text: 'Why it matters: ' }), it.whyItMatters),
          h('div', {}, h('b', { text: 'Typically handled by: ' }), it.typicalAuthority),
          h('div', {}, h('b', { text: 'Confirm with: ' }), it.verifyWith),
        ),
      ));
    });
    out.appendChild(panel);
    out.appendChild(h('p', { class: 'footnote', text: 'Generated ' + new Date().toLocaleDateString() + ' for ' + [project.country, project.region].filter(Boolean).join(' · ') + '. Re-check before acting: rules change.' }));
  }

  function renderRoadmap() {
    const d = project.stages.roadmap;
    const out = $('roadOut');
    clear(out);
    if (!d) return;
    const panel = h('div', { class: 'panel' });
    arr(d.phases).forEach((p, pi) => {
      const phase = h('div', { class: 'phase' },
        h('div', { class: 'phase-head' },
          h('span', { class: 'n', text: String(pi + 1).padStart(2, '0') }),
          h('span', { class: 'name', text: p.name }),
          h('span', { class: 'dur', text: p.durationEstimate || '' })),
        h('p', { class: 'obj', text: p.objective || '' }),
      );
      arr(p.tasks).forEach((t, ti) => {
        const key = pi + ':' + ti;
        const cb = h('input', { type: 'checkbox', id: 'task-' + key });
        cb.checked = !!project.tasksDone[key];
        const row = h('div', { class: 'task' + (cb.checked ? ' done' : '') }, cb,
          h('label', { for: 'task-' + key, text: t.title }));
        cb.addEventListener('change', () => {
          project.tasksDone[key] = cb.checked;
          row.classList.toggle('done', cb.checked);
          save();
        });
        phase.appendChild(row);
      });
      panel.appendChild(phase);
    });
    out.appendChild(panel);
  }

  // ---------------------------------------------------------------- dossier --
  /** The cover line. Cut on a word, never mid-word — this is the first thing a
   *  bank or an investor reads, and "…commandes et livr" reads as a bug. */
  function coverTitle() {
    const idea = (project.idea || '').trim();
    if (!idea) return 'Business dossier';
    if (idea.length <= 80) return idea;
    const cut = idea.slice(0, 80);
    const space = cut.lastIndexOf(' ');
    return (space > 40 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/, '') + '…';
  }

  function renderDossier() {
    const out = $('dossierOut');
    clear(out);
    const s = project.stages;

    out.appendChild(h('div', { class: 'doc-cover' },
      h('div', { class: 'eyebrow', text: 'MWINDA AI BUSINESS INTELLIGENCE' }),
      h('div', { class: 't', text: coverTitle() }),
      h('div', { class: 'm', text: [project.businessType, project.sector].filter(Boolean).join(' · ') }),
      h('div', { class: 'm', text: [project.city, project.region, project.country].filter(Boolean).join(', ') }),
      h('div', { class: 'm', text: 'Generated ' + new Date().toLocaleDateString() + ' · Mwinda Digital' }),
    ));

    const LABELS = {
      analyze: 'Idea analysis', model: 'Business model', plan: 'Business plan',
      financials: 'Financial projections', compliance: 'Regulatory checklist', roadmap: 'Roadmap',
    };
    const included = ORDER.filter((k) => s[k]);
    const missing = ORDER.filter((k) => !s[k]);
    const allBtn = $('btnAllMissing');
    if (allBtn) allBtn.hidden = !s.analyze || !missing.length;
    if (!included.length) {
      out.appendChild(h('p', { class: 'footnote', text: 'Nothing generated yet — run “Analyse my idea” first. The dossier is built from the steps you complete.' }));
      return;
    }
    if (missing.length) {
      out.appendChild(h('p', { class: 'footnote', style: 'margin:-18px 0 26px',
        text: 'This dossier covers ' + included.length + ' of 6 sections: ' +
              included.map((k) => LABELS[k]).join(', ') + '. Not yet generated: ' +
              missing.map((k) => LABELS[k]).join(', ') + '.' }));
    }

    const sec = (title, ...kids) => h('div', { class: 'doc-section' }, h('h4', { text: title }), ...kids);
    const paras = (text) => {
      const body = h('div');
      String(text || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).forEach((para) => {
        // "- " lines are the plan's bullets; keep them as a list, not a run-on paragraph.
        const lines = para.split('\n');
        if (lines.length > 1 && lines.every((l) => /^\s*[-•]\s+/.test(l))) {
          body.appendChild(h('ul', { class: 'clean' }, lines.map((l) => h('li', { text: l.replace(/^\s*[-•]\s+/, '') }))));
        } else body.appendChild(h('p', { text: para.replace(/\n/g, ' ') }));
      });
      return body;
    };
    const bullets = (items) => h('ul', { class: 'clean' }, arr(items).map((x) => h('li', { text: String(x) })));

    // 1 · The narrative. The plan's 17 sections already open with an executive
    // summary, the problem and the solution; printing the analysis's versions
    // first said everything twice.
    if (s.plan) {
      arr(s.plan.sections).forEach((x) => out.appendChild(sec(x.title, paras(x.body))));
    } else if (s.analyze) {
      const a = s.analyze;
      out.appendChild(sec('Executive summary', h('p', { text: a.summary }),
        a.valueProposition ? h('p', {}, h('b', { text: 'Value proposition: ' }), a.valueProposition) : null));
      out.appendChild(sec('Problem', h('p', { text: a.problem })));
      out.appendChild(sec('Solution', h('p', { text: a.solution })));
      if (arr(a.targetCustomers).length) {
        out.appendChild(sec('Target customers', h('ul', { class: 'clean' }, a.targetCustomers.map((c) =>
          h('li', {}, h('b', { text: (c.segment || '') + ' — ' }), c.description || '')))));
      }
      if (arr(a.revenueModelOptions).length) {
        out.appendChild(sec('Revenue models to consider', h('ul', { class: 'clean' }, a.revenueModelOptions.map((r) =>
          h('li', {}, h('b', { text: (r.name || '') + ' (' + (r.fit || '—') + ' fit) — ' }), r.why || '')))));
      }
    }

    // 2 · What the analysis adds that a plan does not say as plainly.
    if (s.analyze) {
      const a = s.analyze;
      if (arr(a.risks).length) {
        out.appendChild(sec('Key risks and first mitigations', h('ul', { class: 'clean' }, a.risks.map((r) =>
          h('li', {}, h('b', { text: (r.risk || '') + ' [' + (r.severity || '—') + '] — ' }), r.mitigation || '')))));
      }
      if (arr(a.assumptionsToValidate).length) {
        out.appendChild(sec('Assumptions to validate before investing', bullets(a.assumptionsToValidate)));
      }
      if (!s.plan && arr(a.opportunities).length) out.appendChild(sec('Opportunities', bullets(a.opportunities)));
    }

    if (s.model) {
      const rows = CANVAS.map(([k, label]) =>
        h('div', { class: 'kv' }, h('dt', { text: label }),
          h('dd', { text: arr(s.model[k]).join(' · ') || '—' })));
      out.appendChild(sec('Business model canvas', h('dl', {}, rows),
        h('p', {}, h('b', { text: 'Recommended revenue model: ' }), s.model.recommendedRevenueModel || ''),
        s.model.rationale ? h('p', { text: s.model.rationale }) : null));
    }

    if (s.financials) {
      const d = s.financials;
      const a = d.assumptions || {};
      const cur = d.currency || 'USD';
      const money = (n) => (n < 0 ? '-' : '') + cur + ' ' + Math.abs(Math.round(n)).toLocaleString('en-US');
      const mult = d.scenarioMultipliers || {};
      const inputs = h('table', { class: 'fin' },
        h('thead', {}, h('tr', {}, h('th', { text: 'Assumption' }), h('th', { text: 'Value' }))),
        h('tbody', {}, FIELDS.map(([k, label]) => h('tr', {},
          h('td', { text: label }),
          h('td', { text: k === 'monthlyGrowthRate' ? (num(a[k]) * 100).toFixed(1) + '% / month'
            : k === 'customersMonth1' ? Math.round(num(a[k])).toLocaleString('en-US') : money(num(a[k])) }),
        ))));
      const scen = h('table', { class: 'fin' },
        h('thead', {}, h('tr', {}, ['Scenario', 'Revenue', 'Expenses', 'Net result', 'Margin', 'Break-even'].map((t) => h('th', { text: t })))),
        h('tbody', {}, [['Pessimistic', num(mult.pessimistic, .5)], ['Realistic', num(mult.realistic, 1)], ['Optimistic', num(mult.optimistic, 1.6)]].map(([name, m]) => {
          const r = project12(a, m);
          return h('tr', {},
            h('td', { text: name + ' (×' + m + ')' }), h('td', { text: money(r.total.revenue) }),
            h('td', { text: money(r.total.expenses) }), h('td', { text: money(r.total.net) }),
            h('td', { text: (r.total.margin * 100).toFixed(1) + '%' }),
            h('td', { text: r.breakEven ? 'month ' + r.breakEven : 'not in year 1' }));
        })));
      const real = project12(a, num(mult.realistic, 1));
      const monthly = h('table', { class: 'fin' },
        h('thead', {}, h('tr', {}, ['Month', 'Customers', 'Revenue', 'Costs', 'Net', 'Cash'].map((t) => h('th', { text: t })))),
        h('tbody', {}, real.rows.map((r) => h('tr', {},
          h('td', { text: 'M' + r.m }),
          h('td', { text: Math.round(r.customers).toLocaleString('en-US') }),
          h('td', { text: money(r.revenue) }),
          h('td', { text: money(r.variable + real.fixedMonthly) }),
          h('td', { text: money(r.net) }),
          h('td', { text: money(r.cash) }),
        ))));
      const trough = Math.min(...real.rows.map((r) => r.cash));
      out.appendChild(sec('Financial projection — year 1',
        h('p', { text: 'Starting assumptions (' + cur + '). Proposed by the engine as plausible for this country, sector and stage, and editable by the founder.' }),
        inputs,
        arr(d.assumptionNotes).length ? bullets(d.assumptionNotes) : null,
        h('p', {}, h('b', { text: 'Scenarios' })),
        scen,
        h('p', {}, h('b', { text: 'Realistic scenario, month by month' })),
        monthly,
        h('p', {}, h('b', { text: 'Capital needed to survive year 1 (realistic): ' }), money(Math.max(0, -trough)) +
          ' — lowest cash point ' + money(trough) + ', including the initial investment as a month-0 outflow.'),
        h('p', { class: 'footnote', text: 'Projections computed from the stated assumptions. They are not forecasts, and no outcome is guaranteed.' })));
    }

    if (s.compliance) {
      const list = h('div');
      arr(s.compliance.items).forEach((it) => {
        list.appendChild(h('div', { class: 'check-item' },
          h('div', {}, h('b', { text: it.requirement }), h('span', { class: 'tag conf-' + it.confidence, text: it.confidence })),
          h('div', { class: 'meta', style: 'padding-left:0' },
            it.whyItMatters ? 'Why it matters: ' + it.whyItMatters + ' ' : '',
            it.typicalAuthority ? 'Handled by: ' + it.typicalAuthority + ' ' : '',
            it.verifyWith ? 'Confirm with: ' + it.verifyWith : '')));
      });
      out.appendChild(sec('Regulatory checklist — ' + (project.country || ''),
        h('p', { text: s.compliance.jurisdictionNote || '' }), list,
        h('p', { class: 'footnote', text: 'General information only. Not legal, tax or accounting advice. Confirm every item with the competent authority before relying on it.' })));
    }

    if (s.roadmap) {
      const list = h('div');
      arr(s.roadmap.phases).forEach((p, pi) => {
        list.appendChild(h('p', {}, h('b', { text: (pi + 1) + '. ' + (p.name || '') + (p.durationEstimate ? ' — ' + p.durationEstimate : '') })));
        if (p.objective) list.appendChild(h('p', { text: 'Objective: ' + p.objective }));
        const ul = h('ul', { class: 'clean' });
        arr(p.tasks).forEach((t, ti) => ul.appendChild(h('li', { text: (project.tasksDone[pi + ':' + ti] ? '✓ ' : '') + (t.title || '') })));
        list.appendChild(ul);
      });
      out.appendChild(sec('Execution roadmap', list));
    }

    out.appendChild(h('div', { class: 'doc-section' },
      h('p', { class: 'footnote', text: 'Produced with MWINDA AI Business Intelligence — Mwinda Digital. This dossier is generated by artificial intelligence from information supplied by its author. It is general business orientation, not legal, tax, accounting or investment advice.' })));
  }

  const RENDER = {
    analyze: renderAnalyze, model: renderModel, plan: renderPlan,
    financials: renderFinancials, compliance: renderCompliance,
    roadmap: renderRoadmap, dossier: renderDossier,
  };

  // ------------------------------------------------------------------- init --
  function fillSelect(id, values, selected) {
    const sel = $(id);
    clear(sel);
    sel.appendChild(h('option', { value: '', text: '— select —' }));
    values.forEach((v) => sel.appendChild(h('option', { value: v, text: v, selected: v === selected })));
  }

  function renderStart() {
    const chips = $('intentChips');
    clear(chips);
    INTENTS.forEach((i) => chips.appendChild(h('button', {
      class: project.intent === i ? 'on' : '', type: 'button', text: i,
      onclick: () => { project.intent = i; save(); renderStart(); },
    })));
    fillSelect('country', COUNTRIES, project.country);
    fillSelect('sector', SECTORS, project.sector);
    fillSelect('businessType', TYPES, project.businessType);
    ['region', 'city', 'budget', 'idea'].forEach((k) => { $(k).value = project[k] || ''; });
    $('ideaCount').textContent = (project.idea || '').length;
    renderSaved();
  }

  function renderSaved() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(LIST) || '[]'); } catch { /* ignore */ }
    const panel = $('savedPanel');
    const host = $('savedList');
    clear(host);
    const others = list.filter((p) => p.id !== project.id || Object.keys(project.stages).length);
    if (!others.length) { panel.hidden = true; return; }
    panel.hidden = false;
    others.forEach((p) => {
      host.appendChild(h('div', { class: 'proj' },
        h('div', { class: 'nm', text: p.name || 'Untitled' }),
        h('div', { class: 'bar' }, h('i', { style: 'width:' + (p.progress || 0) + '%' })),
        h('div', { class: 'dt', text: (p.updatedAt || '').slice(0, 10) }),
        h('button', {
          class: 'btn ghost small', type: 'button', text: 'Open',
          onclick: () => { project = Object.assign(blank(), p.data); save(); boot(); resumePending(); go(project.stages.analyze ? 'analyze' : 'start'); },
        })));
    });
  }

  function boot() {
    renderStart();
    for (const [stage, fn] of Object.entries(RENDER)) {
      if (stage === 'dossier' || project.stages[stage]) fn();
    }
    renderRail();
  }

  /**
   * One status area per step, reused across attempts.
   *
   * Every click used to insert a *new* container above the previous one. On
   * success that left an empty div behind; on failure it left the previous
   * attempt's red error box on screen underneath the new one. Three retries of
   * a failing stage showed three identical failures stacked — which reads as
   * three separate things going wrong rather than one thing tried three times.
   */
  function statusHost(btn) {
    const step = btn.closest('.step');
    let box = step.querySelector('.gen-status');
    if (!box) {
      const actions = step.querySelector('.actions');
      box = h('div', { class: 'gen-status no-print' });
      actions.parentNode.insertBefore(box, actions.nextSibling);
    }
    clear(box);
    return box;
  }

  /** Write a message into the export note, replacing whatever was there. */
  function pdfNote(text, kind) {
    const note = $('pdfNote');
    if (!note) return null;
    clear(note);
    note.className = 'footnote' + (kind ? ' ' + kind : '');
    if (text) note.appendChild(h('span', { text }));
    return note;
  }

  function bind() {
    ['region', 'city', 'budget'].forEach((k) =>
      $(k).addEventListener('input', () => { project[k] = $(k).value; save(); }));
    ['country', 'sector', 'businessType'].forEach((k) =>
      $(k).addEventListener('change', () => { project[k] = $(k).value; save(); }));
    $('idea').addEventListener('input', () => {
      project.idea = $('idea').value;
      $('ideaCount').textContent = project.idea.length;
      save();
    });

    $('btnAnalyze').addEventListener('click', async () => {
      const missing = [];
      if (!project.idea.trim()) missing.push('your idea');
      if (!project.country) missing.push('a country');
      if (!project.sector) missing.push('a sector');
      if (!project.businessType) missing.push('a business type');
      if (missing.length) {
        clear($('startStatus'));
        $('startStatus').appendChild(h('div', { class: 'status err', text: 'Please provide ' + missing.join(', ') + '.' }));
        return;
      }
      const btn = $('btnAnalyze');
      btn.disabled = true;
      await generate('analyze', $('startStatus'), () => { renderAnalyze(); renderRail(); go('analyze'); });
      btn.disabled = false;
    });

    $('btnReset').addEventListener('click', () => {
      if (!confirm('Start a new project? The current one stays in your saved list.')) return;
      project = blank();
      save();
      boot();
      go('start');
    });

    // "next" buttons generate the following stage on demand
    document.querySelectorAll('[data-next]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const stage = btn.getAttribute('data-next');
        if (stage === 'dossier') { renderRail(); return go('dossier'); }
        if (project.stages[stage]) { RENDER[stage](); return go(stage); }
        btn.disabled = true;
        await generate(stage, statusHost(btn), () => { RENDER[stage](); renderRail(); go(stage); });
        btn.disabled = false;
      });
    });

    // One click from the analysis to a complete dossier (see generateAll).
    document.querySelectorAll('[data-all]').forEach((btn) => {
      btn.addEventListener('click', () => generateAll(statusHost(btn)));
    });

    document.querySelectorAll('[data-regen]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const stage = btn.getAttribute('data-regen');
        btn.disabled = true;
        await generate(stage, statusHost(btn), () => { RENDER[stage](); renderRail(); });
        btn.disabled = false;
      });
    });

    /**
     * One export path, reachable from every stage. The dossier is rebuilt from
     * whatever is finished at that moment, so a founder who has only run the
     * analysis still gets a usable PDF rather than being made to complete all
     * six stages first.
     *
     * This used to call window.print() and hope the founder picked "Save as
     * PDF". Whether a file appeared was then entirely the browser's business —
     * and on a phone, or with no print backend, none did. bi-pdf.js writes the
     * file here instead, so a button that says "download" downloads.
     */

    function exportPdf() {
      const done = ORDER.filter((s) => project.stages[s]).length;
      if (!done) {
        // An alert() is swallowed by several in-app browsers, and "nothing to
        // export" read as "the file is missing". Say it in the page, where it
        // stays put and can say what to do about it.
        go('dossier');
        pdfNote('Nothing to export yet — run “Analyse my idea” first, then come back. The dossier is built from the stages you have generated.', 'warn');
        return;
      }
      renderDossier();
      go('dossier');

      const note = pdfNote('Preparing the PDF…');
      const name = [project.businessType, project.sector, project.country].filter(Boolean).join(' ');
      try {
        if (!window.mwindaPdf) throw new Error('bi-pdf.js did not load');
        const ok = window.mwindaPdf.save($('dossierOut'), {
          name: name || 'business',
          title: (project.idea || 'Business dossier').slice(0, 90),
          subject: 'MWINDA AI Business Intelligence — ' + [project.sector, project.country].filter(Boolean).join(', '),
          noteEl: note,
        });
        if (!ok) throw new Error('this browser cannot build the file');
        remote.event('dossier_exported', project.remoteId);
      } catch (e) {
        // Never leave the founder with a dead button — and never leave them
        // guessing why. Say what failed, then fall back to the print dialog.
        const n = pdfNote('The PDF could not be written here (' + (e && e.message ? e.message : 'unknown error') +
          '). Opening your browser’s print dialog instead — choose “Save as PDF”.', 'warn');
        if (n) n.appendChild(h('br'));
        printDossier();
      }
    }

    /** The browser's own print dialog — kept as a deliberate second route. */
    function printDossier() {
      renderDossier();
      go('dossier');
      setTimeout(() => window.print(), 120);
    }

    $('btnPrint').addEventListener('click', exportPdf);
    document.querySelectorAll('[data-pdf]').forEach((b) => b.addEventListener('click', exportPdf));
    const btnPrintDialog = $('btnPrintDialog');
    if (btnPrintDialog) btnPrintDialog.addEventListener('click', printDossier);

    // Capability link: id + owner token in the fragment. The fragment is never
    // sent to the server by the browser, so the link is only as exposed as the
    // person holding it — treat it like a password.
    /**
     * The access link. Three things were wrong with this:
     *
     *  · It claimed "Link copied" whether or not the clipboard write worked —
     *    and it never showed the link, so a refused clipboard left the founder
     *    with nothing at all and no idea anything had failed. Safari and every
     *    in-app browser refuse clipboard writes routinely.
     *  · It refused outright when the project had not reached the server yet,
     *    instead of simply saving it and then handing over the link.
     *  · It would happily build a link ending in ".undefined" when the owner
     *    token was missing — a link that cannot ever open.
     *
     * The link is now always rendered on the page, selectable, whether or not
     * the clipboard cooperated.
     */
    $('btnLink').addEventListener('click', async () => {
      const note = $('linkNote');
      const say = (text, kind) => {
        clear(note);
        note.className = 'footnote' + (kind ? ' ' + kind : '');
        note.appendChild(h('span', { text }));
        return note;
      };

      if (!remote.available) {
        say('Server storage is not configured on this deployment, so there is no link to share. Use “Export data (JSON)” to move this project to another device.', 'warn');
        return;
      }

      if (!project.remoteId) {
        if (!(project.idea || '').trim()) {
          say('Add your idea first — there is nothing to share yet.', 'warn');
          return;
        }
        say('Saving to the server…');
        await remote.sync(project);
        if (!project.remoteId) {
          say(remote.available
            ? 'The server did not answer, so no link can be issued yet. Your work is safe in this browser — try again in a moment, or use “Export data (JSON)” to move it to another device.'
            : 'Server storage is not configured on this deployment, so there is no link to share. Use “Export data (JSON)” to move this project to another device.', 'warn');
          return;
        }
      }

      const token = remote.keys()[project.remoteId];
      if (!token) {
        say('This project was opened from someone else’s link, and that link is the only key to it — MWINDA never stored a second one. Ask whoever shared it, or use “Export data (JSON)”.', 'warn');
        return;
      }

      const url = location.origin + '/bi#p=' + project.remoteId + '.' + token;
      let copied = false;
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch { /* shown below instead — the clipboard is not the only route */ }

      const n = say(copied
        ? 'Link copied. Anyone with it can open and edit this project — treat it like a password.'
        : 'Your browser refused the clipboard. Here is the link — select it and copy it by hand. Anyone with it can open and edit this project, so treat it like a password.');
      n.appendChild(h('br'));
      // Selecting the whole link on a phone is fiddly; one tap does it.
      n.appendChild(h('code', {
        class: 'link-out',
        text: url,
        onclick: (ev) => {
          const r = document.createRange();
          r.selectNodeContents(ev.currentTarget);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(r);
        },
      }));
    });
    $('btnSaveJson').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: 'mwinda-business-project.json' });
      document.body.appendChild(a); a.click(); a.remove();
    });
  }

  /** #p=<uuid>.<token> opens a project saved on the server, on any device. */
  async function openFromHash() {
    const m = (location.hash || '').match(/^#p=([0-9a-f-]{36})\.([\w-]+)$/i);
    if (!m) return false;
    history.replaceState(null, '', location.pathname);
    try {
      setSync('syncing');
      const loaded = await remote.load(m[1], m[2]);
      // Their in-flight job ids are theirs: never poll (and acknowledge) them here.
      project = Object.assign(blank(), loaded, { remoteId: m[1], shared: true, pending: {} });
      remote.setKey(m[1], m[2], true);   // tab-scoped, not persisted
      save();
      boot();
      go(project.stages.analyze ? 'analyze' : 'start');
      setSync('synced');
      return true;
    } catch {
      setSync('error');
      return false;
    }
  }

  /* Background video: video-bg.js, shared by both pages. */


  /* ---------- Reading scrim ----------
     The hero shows the video at roughly 90% strength. Every section below it is
     transparent, so page copy scrolls directly over the moving image — the
     scrim has to come back before the first paragraph does. Threshold is 55% of
     the hero, which puts the change well before any body text reaches the top
     of the viewport. */
  (() => {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    let ticking = false;
    const apply = () => {
      ticking = false;
      const past = window.scrollY > hero.offsetHeight * 0.55;
      document.body.classList.toggle('past-hero', past);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    apply();
  })();


  load();
  bind();
  boot();
  setSync('local');
  openFromHash().then((opened) => { if (!opened) resumePending(); });
})();
