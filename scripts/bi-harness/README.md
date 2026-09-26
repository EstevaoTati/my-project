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

The dispatcher's real rate limit applies (40 generations/hour per client):
restart the server between full runs.
