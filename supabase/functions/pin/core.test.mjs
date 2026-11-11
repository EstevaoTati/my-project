/**
 * Tests for core.ts — the PIN function's pure logic — run by Node directly on
 * the TypeScript source, so what is tested is what is deployed:
 *
 *   node --experimental-strip-types supabase/functions/pin/core.test.mjs
 */
import { webcrypto } from "node:crypto";
import { hashPin, normalizePin, parseStored, recentEmailCode, verifyPin, weakPin, ITERATIONS } from "./core.ts";

let pass = 0;
const fails = [];
const check = async (label, fn) => {
  try {
    if (!(await fn())) throw new Error("falsy");
    console.log("  ✓ " + label);
    pass++;
  } catch (e) {
    console.log("  ✗ " + label + " — " + e.message);
    fails.push(label);
  }
};

/** A row exactly as v6 wrote it: pbkdf2$120000$<salt>$<hash>. */
async function v6Hash(pin) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await webcrypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 120000 }, key, 256);
  return `pbkdf2$120000$${Buffer.from(salt).toString("base64")}$${Buffer.from(bits).toString("base64")}`;
}
const token = (claims) =>
  ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify(claims)).toString("base64url"), "sig"].join(".");
const now = Math.floor(Date.now() / 1000);

console.log("\n── Input rules ──");
await check("six digits accepted", () => normalizePin("428317") === "428317");
await check("spaces, letters, 5 or 7 digits, numbers refused", () =>
  ["4283 17", "42831a", "42831", "4283170", 428317, null].every((v) => normalizePin(v) === null));
await check("weak PINs refused", () => ["000000", "123456", "654321", "121212", "456456"].every((p) => weakPin(p)));
await check("an ordinary PIN is allowed", () => weakPin("428317") === null);

console.log("\n── Hashing ──");
const h = await hashPin("428317");
await check(`new hashes use ${ITERATIONS} rounds in the 5-part format`, () => h.startsWith(`pbkdf2$sha256$${ITERATIONS}$`));
await check("two hashes of one PIN differ (random salt)", async () => (await hashPin("428317")) !== h);
await check("the right PIN verifies, no upgrade needed", async () => {
  const r = await verifyPin("428317", h);
  return r.ok && !r.upgrade;
});
await check("a wrong PIN does not verify", async () => !(await verifyPin("428318", h)).ok);

console.log("\n── Rows written by v6 (production) ──");
const old = await v6Hash("593104");
await check("a v6 row still verifies", async () => (await verifyPin("593104", old)).ok);
await check("…and is flagged for re-hashing", async () => (await verifyPin("593104", old)).upgrade);
await check("a wrong PIN against a v6 row fails", async () => !(await verifyPin("593105", old)).ok);
await check("malformed or absurd rows never verify", async () =>
  !(await verifyPin("593104", "plain")).ok &&
  parseStored("pbkdf2$1$AAAA$AAAA") === null &&
  parseStored("pbkdf2$sha256$99999999999$AAAA$AAAA") === null);

console.log("\n── Step-up for a forgotten PIN ──");
await check("an e-mail code 1 minute ago allows a reset", () =>
  recentEmailCode(token({ amr: [{ method: "otp", timestamp: now - 60 }] }), now));
await check("an e-mail code 1 hour ago does not", () =>
  !recentEmailCode(token({ amr: [{ method: "otp", timestamp: now - 3600 }] }), now));
await check("a password sign-in does not", () =>
  !recentEmailCode(token({ amr: [{ method: "password", timestamp: now - 10 }] }), now));
await check("a timestamp in the future does not", () =>
  !recentEmailCode(token({ amr: [{ method: "otp", timestamp: now + 600 }] }), now));
await check("a garbage token does not", () => !recentEmailCode("not-a-jwt", now) && !recentEmailCode("a.%%%.b", now));

console.log(`\n${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
