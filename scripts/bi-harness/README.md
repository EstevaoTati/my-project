# BI harness — test the whole idea → dossier → PDF flow

Runs the **real** `netlify/functions` (bi, bi-run-background, bi-status, …)
with two platform packages swapped for in-process fakes by Node module hooks:

- `@anthropic-ai/sdk` → `fake-anthropic.mjs`: streams a tool call shaped by the
  stage's own schema, filled with realistic French business prose, at a set
  speed. `control.json` scripts failures per stage (`max_tokens`,
  `incomplete`, `stringify`, `error500`, `nokey`; once, or always with
  `"failAlways": true`) and the speed (`charsPerSec`; ~220 is roughly a real
  model).
- `@netlify/blobs` → `fake-blobs.mjs`: an in-memory store.

`-background` functions answer 202 and keep running, as on Netlify.

```bash
cd scripts/bi-harness && npm install
npm run server &                      # http://127.0.0.1:4700/bi
npm run unit                          # normalisation, job ids
npm run api                           # dispatch/poll/ack, retries, failure messages
CHROMIUM=/path/to/chrome npm run e2e  # browser: 7 scenarios incl. PDF, reload, lost reply
ONLY=one-click CPS=220 npm run e2e    # one scenario at realistic model speed
node pdfcheck.mjs suite-step.pdf "Business model canvas|Execution roadmap"
```

Each browser context sends its own `x-nf-client-connection-ip`, so the
dispatcher's real rate limit (40 generations/hour per client) no longer forces
a server restart between runs. `STREAM=1` prints each result as it finishes.

### Phones, tablets, computers

`device: <name>` runs the whole flow — form, analysis, one-click dossier, PDF —
on each profile in `DEVICES` (Playwright descriptors plus `Laptop 1366` and
`Desktop 1920`), tapping on touch screens. It fails on:

- a page wider than the screen at any step (a phone has to pan sideways);
- form fields under 16px on touch screens (iOS Safari zooms into them);
- an Analyse button under 40px tall;
- a PDF missing the business model canvas or the roadmap.

```bash
DEVICES="iPhone SE,iPad (gen 7)" ONLY="device: iPhone SE,device: iPad (gen 7)" npm run e2e
```

This is Chromium with device emulation (screen size, touch, user agent), not
Safari's engine; check on a real iPhone before a launch.

### Bad networks

- `offline-mid-generation`: 40 s with no network while a stage is written.
- `phone-slept-past-deadline`: the page returns 12 minutes after a dispatch;
  the finished result must be collected, not dropped.
- `dropped-start-request`: the request that starts a stage is lost once.
