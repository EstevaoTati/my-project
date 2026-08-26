# The dossier writes its own PDF, with no library

**Date:** 2026-08-26
**Status:** shipped
**Scope:** `bi-pdf.js`, `bi.js`, `bi.html`, `bi.css`

## The problem

"Download the full dossier (PDF)" called `window.print()`. That opens the
browser's print dialog and asks the founder to pick *Save as PDF*. Whether a
file ever reaches the device is then entirely the browser's business — and it
frequently doesn't:

- On iOS and Android the print sheet routes to AirPrint or Google Cloud Print;
  "Save as PDF" is not always offered, and on some Android builds the sheet
  reports a missing file rather than producing one.
- With no print backend installed (a plain Linux desktop, a locked-down
  workstation) Chrome's preview fails outright.
- In-app browsers — WhatsApp, Instagram, Facebook, Gmail — commonly stub
  `window.print()` to nothing.

The reported symptom, "ça ne télécharge pas car le fichier est introuvable",
is that class of failure. A button labelled *download* has to produce a file.

**What was not wrong:** the dossier itself. Driven in a real browser, the
export path renders all six sections, calls `print()` exactly once, and the
print stylesheet yields a clean three-page document with French accents intact.
The content pipeline was never the defect — only the delivery.

## The decision

Write the PDF in the browser, in `bi-pdf.js`, with no dependency.

### Why not a library

`jsPDF` or `pdfmake` would work and `cdn.jsdelivr.net` is already whitelisted
for scripts. Rejected because:

- **A background dependency on someone else's CDN** is exactly what this repo
  removed from the hero (see `docs/hero-video.md`). A dossier a founder is
  about to hand a bank should not fail because a CDN is having a bad day.
- **Weight.** ~350 KB minified, plus `html2canvas` (~200 KB) if the layout is
  rasterised — and rasterising throws away selectable text and multiplies the
  file size by twenty.
- **The site has no build step.** Vendoring a bundle into a buildless static
  site means hand-maintaining a minified blob nobody in this repo can review.

### What the dossier actually needs

Text, headings, key/value pairs, one table, bullet lists, page numbers. All of
it renders in the **base-14 fonts** every PDF reader is required to carry, with
no font embedding — which is why a six-page dossier is ~50 KB rather than the
~640 KB the print path produced for three pages.

Two constraints follow from Helvetica-without-embedding, and both are handled
rather than ignored:

- **Encoding.** Text is written in WinAnsi, which covers French accents
  natively. The typographic punctuation the dossier contains (`—`, `·`, `’`,
  `…`) lives in WinAnsi's 0x80–0x9F block. Anything outside it is
  *transliterated*, never dropped: `✓` becomes `[x]`, `→` becomes `->`. A
  character silently missing from a document sent to a bank is worse than an
  ASCII stand-in. Verified: zero `?` substitutions across the stress corpus.
- **Metrics.** Line breaking is measured with canvas `measureText` against
  Helvetica / Arial / Liberation Sans — metrically compatible faces — and
  wrapped at 98% of the column, so a substituted font still cannot overflow.
  Words wider than the column are broken on characters; URLs and agglutinated
  names would otherwise run off the page.

### It walks the rendered DOM

`bi-pdf.js` builds the document from `#dossierOut` — whatever `renderDossier()`
put on screen — rather than from the project object. One renderer, one source
of truth, and a new section added to the dossier reaches the PDF without
touching this file.

## What else changed

- **A "Print" button stays**, wired to `window.print()`. The print route is not
  wrong, it is just not a download; a founder who wants the browser dialog
  still has it.
- **`.site-bg` is hidden under `@media print`.** The fixed background layer —
  poster, ignition and a 12 MB video — was being handed to the print job.
  Chrome has to snapshot a playing `<video>` to lay out the page.
- **The cover title cuts on a word.** It was `slice(0, 80)`, which produced
  "…commandes et livr" on the first line a bank reads.
- **`exportPdf()` falls back to the print dialog** if `bi-pdf.js` is missing.
  The button is never dead.

## Verified

Driven in a real browser against a server that emulates the Netlify rules:

| | |
|---|---|
| Full dossier | a `.pdf` file is downloaded, `%PDF-` header, `%%EOF` trailer, ~52 KB |
| Per-stage button | a partial dossier exports the same way |
| Nothing generated | no file, and a message saying why |
| Print button | `window.print()` called exactly once |
| Print dialog | **not** used by the download path |
| Stress: 17 sections, 9 obligations, 4 phases, unbreakable words, non-WinAnsi glyphs | 6 pages, **0 characters past any margin**, 0 lost glyphs, no JS error |

Margins were checked by reading every character's bounding box out of the
produced file, not by looking at it.

## What this does not do

No images, no embedded fonts, no right-to-left text, no hyperlinks. If the
dossier ever needs a chart or the brand typeface, that is the point to
reconsider a library — and to weigh the CDN dependency deliberately rather
than inherit it.
