/*
 * Contact + manuscript forms. Client-side checks are for the visitor's
 * comfort only — netlify/functions/submit.mjs re-validates everything.
 * When the server endpoint is absent (static host: 501/404), the form never
 * dead-ends: it opens the visitor's email app pre-filled to the house's real
 * address, so every button does something real on any host.
 */
(function () {
  const t = (k, v) => window.i18n.t(k, v);
  const API = '/api/submit';
  const EXT = ['pdf', 'docx', 'doc', 'odt', 'rtf'];
  const MAX = 20 * 1024 * 1024;

  function fields(form) {
    const o = {};
    new FormData(form).forEach((v, k) => { if (typeof v === 'string') o[k] = v; });
    o.consent = !!form.querySelector('[name=consent]:checked');
    return o;
  }
  function mark(form, errs) {
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    form.querySelectorAll('.err').forEach((el) => el.remove());
    let first = null;
    for (const [name, code] of Object.entries(errs)) {
      const el = form.querySelector(`[name="${name}"]`);
      if (!el) continue;
      el.setAttribute('aria-invalid', 'true');
      const id = `err-${form.id}-${name}`;
      const s = document.createElement('span');
      s.className = 'err'; s.id = id;
      s.textContent = code === 'required' ? t('f.req') : code === 'size' ? '≤ 20 Mo / MB' : code === 'type' ? EXT.join(', ').toUpperCase() : '✕';
      (el.closest('label') || el.parentNode).appendChild(s);
      el.setAttribute('aria-describedby', id);
      first = first || el;
    }
    if (first) first.focus();
    return !first;
  }
  function check(form) {
    const errs = {};
    form.querySelectorAll('[required]').forEach((el) => {
      if (el.type === 'checkbox' ? !el.checked : el.type === 'file' ? !el.files.length : !el.value.trim()) errs[el.name] = 'required';
    });
    const em = form.querySelector('[name=email]');
    if (em && em.value && !/^\S+@\S+\.\S{2,}$/.test(em.value.trim())) errs.email = 'invalid';
    const f = form.querySelector('[type=file]');
    if (f && f.files[0]) {
      const ext = f.files[0].name.toLowerCase().split('.').pop();
      if (!EXT.includes(ext)) errs.file = 'type';
      else if (f.files[0].size > MAX) errs.file = 'size';
    }
    return mark(form, errs);
  }
  async function post(body) {
    const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    let j = {};
    try { j = await r.json(); } catch (e) {}
    return { status: r.status, ...j };
  }
  function say(form, key, vars, cls) {
    const s = form.querySelector('.form-status');
    s.className = 'form-status ' + (cls || '');
    s.textContent = t(key, vars);
  }
  // Static host fallback: hand the message to the visitor's mail client.
  function mailFallback(form, data) {
    const C = (window.LE_DATA && window.LE_DATA.site.contact) || {};
    if (!C.email) return say(form, 'f.off', null, 'bad');
    const typeSel = form.querySelector('[name=type]');
    const typeLabel = typeSel ? typeSel.options[typeSel.selectedIndex].text : '';
    const subject = data.kind === 'manuscript' ? `[Manuscrit] ${data.title || ''}` : `[${typeLabel || 'Contact'}] ${data.subject || ''}`;
    const lines = [
      `${t('f.name')}: ${data.name || ''}`, `${t('f.email')}: ${data.email || ''}`,
      data.phone ? `${t('f.phone')}: ${data.phone}` : '', data.country ? `${t('f.country')}: ${data.country}` : '',
      data.kind === 'manuscript' ? `${t('m.genre')}: ${data.genre || ''} — ${t('m.lang')}: ${data.language || ''} — ${t('m.length')}: ${data.length || ''}` : '',
      '', data.summary || '', data.message || '',
      data.kind === 'manuscript' ? `\n(${t('m.attach')})` : '',
    ].filter((x, i) => x !== '' || i === 6);
    const href = `mailto:${C.email}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(lines.join('\n'))}`;
    const st = form.querySelector('.form-status');
    st.className = 'form-status ok';
    st.innerHTML = `${t('f.mailOpen')} <a href="${href}">${C.email}</a>`;
    location.href = href;
  }
  function busy(form, on) {
    const b = form.querySelector('[type=submit]');
    b.disabled = on; b.setAttribute('aria-busy', String(on));
  }

  document.querySelectorAll('form[data-kind]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!check(form)) return;
      busy(form, true); say(form, 'f.sending');
      const data = { kind: form.dataset.kind, ...fields(form) };
      try {
        if (form.dataset.kind === 'contact') {
          const r = await post(data);
          if (r.ok) { form.reset(); say(form, 'f.ok', { ref: r.ref }, 'ok'); }
          else if ((r.status === 501 || r.status === 404)) mailFallback(form, data);
          else if (r.fields) { mark(form, r.fields); say(form, 'f.err', null, 'bad'); }
          else say(form, 'f.err', null, 'bad');
          return;
        }
        // Manuscript: 1) register, 2) PUT the file to the signed URL, 3) confirm.
        const file = form.querySelector('[type=file]').files[0];
        delete data.file;
        data.file = { name: file.name, size: file.size, type: file.type };
        const r = await post(data);
        if ((r.status === 501 || r.status === 404)) return mailFallback(form, data);
        if (!r.ok) { if (r.fields) mark(form, r.fields); return say(form, 'f.err', null, 'bad'); }
        const up = await fetch(r.upload.url, { method: 'PUT', headers: { 'content-type': r.upload.type, 'x-upsert': 'false' }, body: file });
        if (!up.ok) return say(form, 'f.err', null, 'bad');
        const done = await post({ kind: 'manuscript-done', ref: r.ref, claim: r.claim });
        if (!done.ok) return say(form, 'f.err', null, 'bad');
        form.reset();
        say(form, 'm.ok', { ref: r.ref }, 'ok');
        try { localStorage.setItem('le.lastRef', r.ref); } catch (e2) {}
      } catch (err) {
        say(form, 'f.err', null, 'bad');
      } finally {
        busy(form, false);
      }
    });
  });
})();
