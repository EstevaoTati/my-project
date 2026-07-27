# Tools

Two scripts that were rebuilt from scratch twice after container restarts wiped
them. They live here so that doesn't happen again.

## `verify-app.js` — the functional suite

Drives every interactive control in the built web export and asserts each one
does something. 74 checks: accounts, categories, the trades catalogue, search
and sort, favourites, booking, payment, messaging, profile editing, the FAQ,
the tab bar, and session/data persistence across a reload and a sign-out.

```sh
npx expo export --platform web
node tools/verify-app.js
```

| Variable | Default | Purpose |
|---|---|---|
| `APP_DIST` | `../dist` | Build to serve |
| `BASE_URL` | — | Test an already-served URL instead (a deployed link, or a `file://` preview) |
| `SHOT_DIR` | `$TMPDIR/242konnect-shots` | Where screenshots land |
| `CHROMIUM_PATH` | Playwright's own | Browser binary |

Exits non-zero on any failed check, console error, or failed request, so it
works as a CI gate.

Two rules it encodes, both learned from false results:

- **Act on the visible match, never `.first()`.** Screens left mounted behind
  the current one keep their nodes in the DOM at 0×0, so `.first()` silently
  targets a hidden copy.
- **A falsy assertion is a failure.** An early version returned a truthy value
  from a broken path and reported a pass while messaging was entirely dead.

## `build-preview.py` — the shareable single file

Folds the web build into one self-contained HTML file: JS inlined as text,
images and fonts as data URIs, asset URLs inside the bundle rewritten to match.
The result opens straight into the app with **zero network requests**, which is
what makes it viable as a shared link or a CSP-restricted artifact.

```sh
python3 tools/build-preview.py      # needs Pillow
```

| Variable | Default | Purpose |
|---|---|---|
| `BUILD_DIR` | `../../242konnect-web` | Path-independent build to fold in |
| `OUT_FILE` | `../dist-preview/242konnect.html` | Output |

Fonts are not optional: the app holds its first paint until `useFonts`
resolves, so a font that fails to load leaves a permanently blank screen.

The page is the app and nothing else — no landing copy above it — so a shared
link lands the reader in the product. Full-bleed under 700 px, framed above it.

### The one subtlety worth knowing

`react-native-web` renders `Modal` through a portal appended to `document.body`,
so a sheet would otherwise stretch across the whole window instead of the phone.

The obvious fix — move the portal node into the phone element — **breaks React**:
it appended that node to `body` and later calls `removeChild` against `body`,
which then throws `The node to be removed is not a child of this node`. That
error only surfaces after a modal is opened *and closed*, so a check that opens
one sheet will not catch it.

Instead the portal root is marked while it holds content and pinned over the
phone with CSS. A transform on it makes it the containing block for the fixed
layers inside, and nothing is ever re-parented.
