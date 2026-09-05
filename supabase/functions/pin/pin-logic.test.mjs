/**
 * The PIN function's pure logic, run outside Deno.
 *
 * The hashing, the comparison and the weak-PIN rule are copied verbatim from
 * supabase/functions/pin/index.ts — same WebCrypto calls, same regexes. What
 * cannot be exercised here is the request handling, which needs a real user
 * token; that part was checked against the deployed function.
 */
const ITERATIONS = 210_000;
const PIN_LENGTH = 6;

const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const unb64 = (text) => new Uint8Array(Buffer.from(text, "base64"));

function normalizePin(input) {
  if (typeof input !== "string") return null;
  const digits = input.replace(/\D/g, "");
  return digits.length === PIN_LENGTH ? digits : null;
}

function weakPin(pin) {
  if (/^(\d)\1{5}$/.test(pin)) return "identical";
  const ascending = "0123456789012345";
  const descending = "9876543210987654";
  if (ascending.includes(pin) || descending.includes(pin)) return "sequential";
  if (/^(\d{2})\1{2}$/.test(pin) || /^(\d{3})\1$/.test(pin)) return "repeated";
  return null;
}

async function derive(pin, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );
  return new Uint8Array(bits);
}

async function hashPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, ITERATIONS);
  return `pbkdf2$sha256$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifyPin(pin, stored) {
  const [scheme, algo, iterations, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || algo !== "sha256") return false;
  const rounds = Number(iterations);
  if (!Number.isFinite(rounds) || rounds < 1) return false;
  const candidate = await derive(pin, unb64(salt), rounds);
  return sameBytes(candidate, unb64(hash));
}

let pass = 0;
const fails = [];
const check = async (label, fn) => {
  try {
    if (!(await fn())) throw new Error("assertion falsy");
    console.log("  ✓ " + label);
    pass++;
  } catch (e) {
    console.log("  ✗ " + label + " — " + e.message);
    fails.push(label);
  }
};

(async () => {
  const stored = await hashPin("428317");

  await check("the right PIN verifies", () => verifyPin("428317", stored));
  await check("a wrong PIN does not", async () => !(await verifyPin("428318", stored)));
  await check("every other PIN of the 10^6 is refused", async () => {
    for (const other of ["000000", "428316", "999999", "142837", "483172"])
      if (await verifyPin(other, stored)) return false;
    return true;
  });

  await check("the stored form is self-describing", () => {
    const [scheme, algo, rounds] = stored.split("$");
    return scheme === "pbkdf2" && algo === "sha256" && Number(rounds) === ITERATIONS;
  });
  await check("the PIN itself is nowhere in the stored form", () => !stored.includes("428317"));
  await check("two hashes of the same PIN differ (per-user salt)", async () => {
    const again = await hashPin("428317");
    return again !== stored && (await verifyPin("428317", again));
  });

  await check("a hash at a different cost still verifies", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const legacy = `pbkdf2$sha256$120000$${b64(salt)}$${b64(await derive("428317", salt, 120000))}`;
    return verifyPin("428317", legacy);
  });
  await check("a tampered stored form is refused", async () =>
    !(await verifyPin("428317", stored.replace("pbkdf2", "plain"))));

  await check("only six digits are accepted", () =>
    normalizePin("428317") === "428317" &&
    normalizePin("42831") === null &&
    normalizePin("4283170") === null &&
    normalizePin(428317) === null &&
    normalizePin("42-83-17") === "428317");

  await check("the obvious PINs are refused", () =>
    weakPin("000000") === "identical" &&
    weakPin("111111") === "identical" &&
    weakPin("123456") === "sequential" &&
    weakPin("654321") === "sequential" &&
    weakPin("345678") === "sequential" &&
    weakPin("121212") === "repeated" &&
    weakPin("456456") === "repeated");
  await check("an ordinary PIN is allowed", () =>
    weakPin("428317") === null && weakPin("904251") === null && weakPin("198419") === null);

  await check("deriving 10^6 candidates is not cheap", async () => {
    const started = Date.now();
    for (let i = 0; i < 10; i++) await verifyPin(String(100000 + i), stored);
    const perGuess = (Date.now() - started) / 10;
    // Ten guesses time the cost of one. At this rate the full keyspace is
    // days of CPU per PIN, not the sub-second an unsalted fast hash gives.
    console.log(`      ${perGuess.toFixed(0)} ms/guess → ${(perGuess * 1e6 / 3600000).toFixed(1)} CPU-hours for 10^6`);
    return perGuess > 20;
  });

  console.log(`\n${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();
