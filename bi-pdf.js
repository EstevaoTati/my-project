/* ============================================================
   MWINDA AI BUSINESS INTELLIGENCE — the dossier as a real PDF file.

   "Download PDF" used to mean window.print(): the browser opened its print
   dialog and the founder was expected to pick "Save as PDF". Whether a file
   ever landed on disk was entirely out of the page's hands — and on a phone,
   or with no print backend installed, it frequently did not. A button labelled
   "download" has to produce a file.

   So this writes the PDF itself. No library: the CSP whitelists no CDN for
   this page, the site has no build step, and a dossier is text — which the
   base-14 fonts every PDF reader is required to carry render perfectly, with
   selectable text, in a file measured in kilobytes rather than the megabytes a
   rasterised page would cost.

   Two deliberate constraints follow from using Helvetica without embedding:

     · Text is encoded in WinAnsi, which covers French accents natively.
       Characters outside it are transliterated rather than dropped.
     · Line breaking is measured with canvas measureText against Helvetica,
       Arial and Liberation Sans — metrically compatible faces — and wrapped
       at 98% of the column so a substituted font can never overflow.

   The document is built by walking the dossier already rendered in the page,
   so this file never needs to know what a business plan contains. Whatever
   renderDossier() puts on screen is what gets exported.
   ============================================================ */
(() => {
  'use strict';

  /* ---------------------------------------------------------------- page -- */
  const PAGE_W = 595.28;          // A4 at 72 dpi
  const PAGE_H = 841.89;
  const M_LEFT = 56;
  const M_RIGHT = 56;
  const M_TOP = 62;
  const M_BOTTOM = 72;            // leaves room for the footer
  const COL_W = PAGE_W - M_LEFT - M_RIGHT;

  const INK = [0.12, 0.12, 0.13];
  const BODY = [0.20, 0.20, 0.22];
  const MUTED = [0.42, 0.42, 0.45];
  const RULE = [0.78, 0.78, 0.80];
  const GOLD = [0.55, 0.42, 0.10];

  /* ------------------------------------------------------------ encoding -- */
  // WinAnsi's 0x80-0x9F block, which is where the typographic punctuation the
  // dossier actually contains lives (— · ’ “ ” …).
  const WIN_HIGH = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
    0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
    0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
    0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
    0x017E: 0x9E, 0x0178: 0x9F,
  };
  // Anything outside WinAnsi is transliterated, never silently dropped — a
  // missing character in a document sent to a bank is worse than an ASCII one.
  const FOLD = {
    // A tick has no WinAnsi equivalent, and folding it to "x" would make a
    // finished task read as a rejected one.
    0x2713: '[x]', 0x2714: '[x]', 0x2610: '[ ]', 0x2611: '[x]', 0x2612: '[x]',
    0x00A0: ' ', 0x202F: ' ', 0x2009: ' ', 0x2192: '->', 0x2190: '<-',
    0x2264: '<=', 0x2265: '>=', 0x00D7: 'x', 0x2212: '-', 0x2033: '"',
    0x2032: "'", 0x2116: 'No.', 0x2043: '-', 0x25CF: '-', 0x25AA: '-',
  };

  /** A JS string as WinAnsi bytes, held one-byte-per-char so that string
   *  offsets stay byte offsets — which the xref table depends on. */
  function winAnsi(str) {
    let out = '';
    for (const ch of String(str == null ? '' : str)) {
      const cp = ch.codePointAt(0);
      if (cp === 0x0A || cp === 0x0D) { out += ' '; continue; }
      if (cp >= 0x20 && cp <= 0x7E) { out += ch; continue; }
      if (cp >= 0xA0 && cp <= 0xFF) { out += String.fromCharCode(cp); continue; }
      if (WIN_HIGH[cp] !== undefined) { out += String.fromCharCode(WIN_HIGH[cp]); continue; }
      if (FOLD[cp] !== undefined) { out += winAnsi(FOLD[cp]); continue; }
      out += '?';
    }
    return out;
  }

  /** PDF literal string: escape the three characters that end one early. */
  const lit = (s) => '(' + winAnsi(s).replace(/[\\()]/g, (c) => '\\' + c) + ')';

  /* ------------------------------------------------------------ measuring -- */
  // Helvetica, Arial and Liberation Sans share advance widths, so measuring in
  // the browser predicts what the PDF reader will do with Helvetica.
  let ctx = null;
  function widthOf(text, size, bold) {
    if (!ctx) {
      const c = document.createElement('canvas');
      ctx = c.getContext('2d');
    }
    ctx.font = (bold ? 'bold ' : '') + size + 'px Helvetica, Arial, "Liberation Sans", "Nimbus Sans", sans-serif';
    return ctx.measureText(winAnsi(text)).width;
  }
  const SAFE = 0.98;   // never trust a substituted metric to the last point

  /* --------------------------------------------------------- inline runs -- */
  /** A word wider than its column can never wrap — break it on characters, or
   *  it runs off the page. URLs and agglutinated names do this routinely. */
  function hardBreak(word, size, bold, max) {
    const out = [];
    let cur = '';
    for (const ch of word) {
      if (cur && widthOf(cur + ch, size, bold) > max) { out.push(cur); cur = ch; }
      else cur += ch;
    }
    if (cur) out.push(cur);
    return out.length ? out : [word];
  }

  /** Split styled runs into words, then greedily fill lines of width `max`. */
  function layoutRuns(runs, max, size) {
    const words = [];
    runs.forEach((r) => {
      const parts = String(r.t || '').split(/\s+/).filter((w) => w.length);
      parts.forEach((w) => {
        const sz = r.size || size, bold = !!r.bold;
        if (widthOf(w, sz, bold) > max * SAFE) {
          hardBreak(w, sz, bold, max * SAFE).forEach((piece) => words.push({ t: piece, bold, size: sz, tight: true }));
        } else {
          words.push({ t: w, bold, size: sz });
        }
      });
    });
    const lines = [];
    let line = [], w = 0;
    const space = (s, b) => widthOf(' ', s, b);
    words.forEach((word) => {
      const ww = widthOf(word.t, word.size, word.bold);
      // Pieces of a hard-broken word join with no space, or the break would
      // read as two words.
      const sp = (line.length && !word.tight) ? space(word.size, word.bold) : 0;
      if (line.length && w + sp + ww > max * SAFE) {
        lines.push(line);
        line = [word]; w = ww;
      } else {
        if (sp) line.push({ t: ' ', bold: word.bold, size: word.size, sp: true });
        line.push(word);
        w += sp + ww;
      }
    });
    if (line.length) lines.push(line);
    return lines.length ? lines : [[]];
  }

  /* ------------------------------------------------------- the DOM walker -- */
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');

  /** Inline content of a block, preserving <b> as a bold run. */
  function runsOf(el) {
    const runs = [];
    const walk = (node, bold) => {
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) {
          const t = n.nodeValue.replace(/\s+/g, ' ');
          if (t.trim()) runs.push({ t, bold });
        } else if (n.nodeType === 1) {
          const tag = n.tagName.toLowerCase();
          walk(n, bold || tag === 'b' || tag === 'strong');
        }
      });
    };
    walk(el, false);
    return runs.length ? runs : [{ t: txt(el), bold: false }];
  }

  /**
   * Turn the rendered dossier into a flat list of blocks. Keyed on the classes
   * renderDossier() emits, with a plain-paragraph fallback so a block this
   * function has never seen still reaches the PDF instead of vanishing.
   */
  function blocksFrom(root) {
    const blocks = [];
    const push = (b) => blocks.push(b);

    Array.from(root.children).forEach((el) => {
      const cls = el.className || '';

      if (cls.indexOf('doc-cover') > -1) {
        push({ k: 'eyebrow', text: txt(el.querySelector('.eyebrow')) });
        push({ k: 'title', text: txt(el.querySelector('.t')) });
        el.querySelectorAll('.m').forEach((m) => push({ k: 'meta', text: txt(m) }));
        push({ k: 'rule' });
        return;
      }

      if (el.tagName === 'P') {
        push({ k: 'p', runs: runsOf(el), small: cls.indexOf('footnote') > -1 });
        return;
      }

      if (cls.indexOf('doc-section') > -1) {
        const head = el.querySelector('h4');
        if (head) push({ k: 'h', text: txt(head) });
        Array.from(el.children).forEach((child) => {
          if (child.tagName === 'H4') return;
          collect(child, push);
        });
        push({ k: 'gap', h: 8 });
        return;
      }

      collect(el, push);
    });

    return blocks;
  }

  /** One non-heading node of a section. */
  function collect(el, push) {
    const cls = el.className || '';
    const tag = el.tagName;

    if (tag === 'P') {
      push({ k: 'p', runs: runsOf(el), small: cls.indexOf('footnote') > -1 });
      return;
    }
    if (tag === 'DL') {
      el.querySelectorAll('.kv').forEach((kv) => {
        push({ k: 'kv', dt: txt(kv.querySelector('dt')), dd: txt(kv.querySelector('dd')) });
      });
      // Some browsers flatten dt/dd out of the .kv wrapper — take them directly.
      if (!el.querySelector('.kv')) {
        const dts = el.querySelectorAll('dt'), dds = el.querySelectorAll('dd');
        dts.forEach((dt, i) => push({ k: 'kv', dt: txt(dt), dd: txt(dds[i]) }));
      }
      return;
    }
    if (tag === 'TABLE') {
      const head = Array.from(el.querySelectorAll('thead th')).map(txt);
      const rows = Array.from(el.querySelectorAll('tbody tr'))
        .map((tr) => Array.from(tr.children).map(txt));
      push({ k: 'table', head, rows });
      return;
    }
    if (tag === 'UL' || tag === 'OL') {
      Array.from(el.children).forEach((li) => push({ k: 'li', runs: runsOf(li) }));
      return;
    }
    if (cls.indexOf('check-item') > -1) {
      const label = el.querySelector('b');
      const tagEl = el.querySelector('.tag');
      push({
        k: 'check',
        text: txt(label),
        level: txt(tagEl),
        meta: txt(el.querySelector('.meta')),
      });
      return;
    }
    if (tag === 'DIV') {
      Array.from(el.children).forEach((child) => collect(child, push));
      if (!el.children.length && txt(el)) push({ k: 'p', runs: runsOf(el) });
      return;
    }
    if (txt(el)) push({ k: 'p', runs: runsOf(el) });
  }

  /* -------------------------------------------------------- the PDF file -- */
  function Doc() {
    this.pages = [];
    this.cur = null;
    this.y = 0;
    this.newPage();
  }
  Doc.prototype.newPage = function () {
    this.cur = { ops: [] };
    this.pages.push(this.cur);
    this.y = M_TOP;
  };
  Doc.prototype.room = function (h) {
    if (this.y + h > PAGE_H - M_BOTTOM) { this.newPage(); return true; }
    return false;
  };
  Doc.prototype.text = function (x, str, size, bold, color) {
    const c = color || BODY;
    this.cur.ops.push(
      'BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' +
      c[0] + ' ' + c[1] + ' ' + c[2] + ' rg ' +
      '1 0 0 1 ' + x.toFixed(2) + ' ' + (PAGE_H - this.y).toFixed(2) + ' Tm ' +
      lit(str) + ' Tj ET'
    );
  };
  Doc.prototype.line = function (x1, x2, color, w) {
    const c = color || RULE;
    this.cur.ops.push(
      (w || 0.6) + ' w ' + c[0] + ' ' + c[1] + ' ' + c[2] + ' RG ' +
      x1.toFixed(2) + ' ' + (PAGE_H - this.y).toFixed(2) + ' m ' +
      x2.toFixed(2) + ' ' + (PAGE_H - this.y).toFixed(2) + ' l S'
    );
  };
  /** A wrapped, styled paragraph. Returns the height consumed. */
  Doc.prototype.para = function (runs, opts) {
    const size = opts.size, lead = opts.lead, x = M_LEFT + (opts.indent || 0);
    const max = COL_W - (opts.indent || 0);
    const lines = layoutRuns(runs, max, size);
    lines.forEach((line, i) => {
      this.room(lead);
      let cx = x;
      if (i === 0 && opts.bullet) {
        this.text(x - 10, opts.bullet, size, false, MUTED);
      }
      line.forEach((word) => {
        this.text(cx, word.t, word.size, word.bold, opts.color || BODY);
        cx += widthOf(word.t, word.size, word.bold);
      });
      this.y += lead;
    });
  };

  /* ------------------------------------------------------------- flowing -- */
  function flow(doc, blocks) {
    blocks.forEach((b, i) => {
      switch (b.k) {
        case 'eyebrow':
          doc.room(16);
          doc.text(M_LEFT, b.text, 8, true, GOLD);
          doc.y += 18;
          break;

        case 'title':
          doc.para([{ t: b.text, bold: true }], { size: 19, lead: 24, color: INK });
          doc.y += 4;
          break;

        case 'meta':
          doc.para([{ t: b.text }], { size: 9.5, lead: 13, color: MUTED });
          break;

        case 'rule':
          doc.y += 10;
          doc.room(2);
          doc.line(M_LEFT, PAGE_W - M_RIGHT);
          doc.y += 20;
          break;

        case 'gap':
          doc.y += b.h;
          break;

        case 'h': {
          // A heading alone at the foot of a page is a heading in the wrong
          // place — keep it with the first line of what follows.
          const need = 16 + 8 + (blocks[i + 1] ? 14 : 0);
          doc.room(need);
          doc.text(M_LEFT, b.text, 11.5, true, INK);
          doc.y += 6;
          doc.room(2);
          doc.line(M_LEFT, PAGE_W - M_RIGHT, RULE, 0.5);
          doc.y += 14;
          break;
        }

        case 'p':
          doc.para(b.runs, b.small
            ? { size: 8.5, lead: 11.5, color: MUTED }
            : { size: 10, lead: 14 });
          doc.y += b.small ? 8 : 9;
          break;

        case 'li':
          doc.para(b.runs, { size: 10, lead: 14, indent: 14, bullet: '-' });
          doc.y += 3;
          break;

        case 'kv':
          doc.room(26);
          doc.text(M_LEFT, b.dt, 8, true, MUTED);
          doc.y += 12;
          doc.para([{ t: b.dd }], { size: 10, lead: 14 });
          doc.y += 8;
          break;

        case 'check':
          doc.room(30);
          doc.para([{ t: b.text, bold: true }], { size: 10, lead: 14, indent: 14, bullet: '[ ]' });
          if (b.level) {
            doc.para([{ t: 'Confidence: ' + b.level }], { size: 8.5, lead: 11.5, indent: 14, color: MUTED });
          }
          if (b.meta) {
            doc.para([{ t: b.meta }], { size: 8.5, lead: 11.5, indent: 14, color: MUTED });
          }
          doc.y += 7;
          break;

        case 'table':
          table(doc, b);
          break;

        default:
          break;
      }
    });
  }

  function table(doc, b) {
    const cols = Math.max(b.head.length, ...b.rows.map((r) => r.length), 1);
    // First column carries the label and gets the slack; the rest are figures.
    const first = Math.min(COL_W * 0.28, COL_W / cols * 1.6);
    const rest = (COL_W - first) / Math.max(cols - 1, 1);
    const xAt = (i) => M_LEFT + (i === 0 ? 0 : first + rest * (i - 1));
    const wAt = (i) => (i === 0 ? first : rest);

    const cell = (row, size, bold, color) => {
      // Every cell wraps; the row is as tall as its tallest cell.
      const laid = row.map((c, i) => layoutRuns([{ t: c }], wAt(i) - 6, size));
      const height = Math.max(...laid.map((l) => l.length)) * (size + 3.5) + 6;
      doc.room(height);
      const top = doc.y;
      laid.forEach((lines, i) => {
        let ly = top;
        lines.forEach((line) => {
          let cx = xAt(i);
          const save = doc.y; doc.y = ly;
          line.forEach((w) => { doc.text(cx, w.t, size, bold, color); cx += widthOf(w.t, size, bold); });
          doc.y = save;
          ly += size + 3.5;
        });
      });
      doc.y = top + height;
      doc.room(2);
      doc.line(M_LEFT, PAGE_W - M_RIGHT, RULE, 0.4);
      doc.y += 6;
    };

    doc.room(40);
    if (b.head.length) cell(b.head, 8.5, true, MUTED);
    b.rows.forEach((r) => cell(r, 9, false, BODY));
    doc.y += 6;
  }

  /* ------------------------------------------------------------ assembly -- */
  function serialize(doc, meta) {
    const n = doc.pages.length;

    // Footer on every page, added once the count is known.
    doc.pages.forEach((pg, i) => {
      const y = PAGE_H - (PAGE_H - M_BOTTOM + 26);
      const foot = (x, s, size, color, bold) =>
        'BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' +
        color[0] + ' ' + color[1] + ' ' + color[2] + ' rg ' +
        '1 0 0 1 ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' Tm ' + lit(s) + ' Tj ET';
      pg.ops.push('0.4 w ' + RULE.join(' ') + ' RG ' +
        M_LEFT + ' ' + (y + 12).toFixed(2) + ' m ' + (PAGE_W - M_RIGHT) + ' ' + (y + 12).toFixed(2) + ' l S');
      pg.ops.push(foot(M_LEFT, meta.footer, 8, MUTED, false));
      const label = (i + 1) + ' / ' + n;
      pg.ops.push(foot(PAGE_W - M_RIGHT - widthOf(label, 8, false), label, 8, MUTED, false));
    });

    const objs = [];
    const add = (body) => { objs.push(body); return objs.length; };   // 1-based

    const fontRegular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    // Each page costs two objects (content stream, page), and /Pages follows
    // them — so its id is known before any of them exist, which is what lets a
    // page carry the /Parent reference it is required to have.
    const pagesId = objs.length + doc.pages.length * 2 + 1;
    const pageIds = [];
    doc.pages.forEach((pg) => {
      const stream = pg.ops.join('\n');
      const contentId = add('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
      pageIds.push(add(
        '<< /Type /Page /Parent ' + pagesId + ' 0 R ' +
        '/MediaBox [0 0 ' + PAGE_W.toFixed(2) + ' ' + PAGE_H.toFixed(2) + '] ' +
        '/Resources << /Font << /F1 ' + fontRegular + ' 0 R /F2 ' + fontBold + ' 0 R >> >> ' +
        '/Contents ' + contentId + ' 0 R >>'
      ));
    });

    const realPagesId = add('<< /Type /Pages /Count ' + pageIds.length +
      ' /Kids [' + pageIds.map((id) => id + ' 0 R').join(' ') + '] >>');
    const infoId = add('<< /Title ' + lit(meta.title) + ' /Author ' + lit(meta.author) +
      ' /Subject ' + lit(meta.subject) + ' /Creator ' + lit('MWINDA AI Business Intelligence') +
      ' /Producer ' + lit('MWINDA AI Business Intelligence') +
      ' /CreationDate ' + lit(pdfDate(new Date())) + ' >>');
    const catalogId = add('<< /Type /Catalog /Pages ' + realPagesId + ' 0 R >>');

    if (realPagesId !== pagesId) throw new Error('PDF object numbering is out of step');

    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = [];
    objs.forEach((body, i) => {
      offsets.push(out.length);
      out += (i + 1) + ' 0 obj\n' + body + '\nendobj\n';
    });
    const xref = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    offsets.forEach((off) => { out += String(off).padStart(10, '0') + ' 00000 n \n'; });
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + catalogId + ' 0 R /Info ' + infoId + ' 0 R >>\n' +
           'startxref\n' + xref + '\n%%EOF\n';

    return Uint8Array.from(out, (c) => c.charCodeAt(0) & 0xff);
  }

  function pdfDate(d) {
    const p = (n) => String(n).padStart(2, '0');
    return 'D:' + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) +
      p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z';
  }

  /* ------------------------------------------------------------ delivery -- */
  function download(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    if ('download' in HTMLAnchorElement.prototype) {
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      // Old iOS Safari ignores `download`. Opening the blob at least puts the
      // document in front of the reader, who can then save it from the viewer.
      window.open(url, '_blank');
    }
    // Revoking immediately cancels the download in Safari; a minute is plenty
    // and the URL dies with the page anyway.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  }

  function slug(s) {
    return winAnsi(s).toLowerCase()
      .replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[îï]/g, 'i')
      .replace(/[ôö]/g, 'o').replace(/[ùûü]/g, 'u').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  }

  /* ---------------------------------------------------------------- api -- */
  window.mwindaPdf = {
    /** Build the PDF from a rendered dossier element. Returns a Uint8Array. */
    build(root, meta) {
      const m = meta || {};
      const doc = new Doc();
      flow(doc, blocksFrom(root));
      return serialize(doc, {
        title: m.title || 'Business dossier — MWINDA',
        author: m.author || 'Mwinda Digital',
        subject: m.subject || 'AI Business Intelligence dossier',
        footer: m.footer || 'MWINDA AI Business Intelligence · Mwinda Digital',
      });
    },
    download,
    slug,
    /** Build and download in one call; returns false if there is nothing in it. */
    save(root, meta) {
      if (!root || !root.children.length) return false;
      const bytes = this.build(root, meta);
      const name = 'mwinda-dossier' + ((meta && meta.name) ? '-' + slug(meta.name) : '') + '.pdf';
      return download(bytes, name);
    },
  };
})();
