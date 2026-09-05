/**
 * Checks the netlify.toml CSP rules do what the merge intended:
 *  - the landing page keeps its strict, fully self-hosted policy;
 *  - /242konnect/* gets exactly the three hosts the prototype needs, no more.
 *
 * Parsing the toml rather than trusting the diff: a header block that doesn't
 * match the path it's meant to is invisible until the page is live.
 */
const fs = require("fs");
const toml = fs.readFileSync(process.env.NETLIFY_TOML || require("path").resolve(__dirname, "..", "..", "netlify.toml"), "utf8");

let pass = 0; const fails = [];
const check = (label, cond) => { if (cond) { console.log("  ✓ " + label); pass++; }
  else { console.log("  ✗ " + label); fails.push(label); } };

// Split into [[headers]] blocks and read each one's `for` and CSP.
const blocks = toml.split(/\[\[headers\]\]/).slice(1).map((b) => {
  const path = (b.match(/for\s*=\s*"([^"]+)"/) || [])[1];
  const csp = (b.match(/Content-Security-Policy\s*=\s*"([^"]+)"/) || [])[1];
  return { path, csp };
});

const site = blocks.find((b) => b.path === "/*");
const proto = blocks.find((b) => b.path === "/242konnect/*");
const app = blocks.find((b) => b.path === "/242konnect-web/*");
// A rewrite makes Netlify pick headers by the requested URL, not the file it
// serves, so the bare path needs its own block or it falls back to /*.
const appBare = blocks.find((b) => b.path === "/242konnect-web");

check("landing page has a CSP", !!site?.csp);
check("landing page allows no external script host",
  !!site && !/script-src[^;]*https:/.test(site.csp));
check("landing page self-hosts its fonts",
  !!site && !/font-src[^;]*fonts\.gstatic/.test(site.csp));

check("prototype has its own CSP block", !!proto?.csp);
check("prototype may load Tailwind from jsDelivr",
  !!proto && /script-src[^;]*cdn\.jsdelivr\.net/.test(proto.csp));
check("prototype may load Google Fonts CSS",
  !!proto && /style-src[^;]*fonts\.googleapis\.com/.test(proto.csp));
check("prototype may load the font files",
  !!proto && /font-src[^;]*fonts\.gstatic\.com/.test(proto.csp));
check("prototype exception is scoped, not global",
  !!proto && proto.path.startsWith("/242konnect/"));
check("prototype still blocks arbitrary connections",
  !!proto && /connect-src 'self'/.test(proto.csp));

// The app calls Supabase to send and verify the code. Under the landing page's
// connect-src 'self' that request is blocked by the browser, not the server, so
// sign-up fails silently and nothing in the deploy reports it.
check("app has its own CSP block", !!app?.csp);
check("app may reach its Supabase project",
  !!app && /connect-src[^;]*abdmdtftnuyjzkdkcwiq\.supabase\.co/.test(app.csp));
check("app exception is scoped, not global",
  !!app && app.path.startsWith("/242konnect-web/"));
check("app allows no external script host",
  !!app && !/script-src[^;]*https:/.test(app.csp));
check("app connect-src names one host, not a wildcard",
  !!app && !/connect-src[^;]*(\*|https:\s)/.test(app.csp));
check("the bare /242konnect-web path carries the same policy",
  !!appBare && !!app && appBare.csp === app.csp);
check("landing page still cannot reach Supabase",
  !!site && !/connect-src[^;]*supabase/.test(site.csp));

const redirect = /from\s*=\s*"\/242konnect"/.test(toml);
check("the /242konnect route survived the deletion of _redirects", redirect);
check("_redirects is gone, as the base intended", !fs.existsSync(require("path").resolve(__dirname, "..", "..", "_redirects")));

console.log(`\n${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
