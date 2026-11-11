/**
 * SHA-256 in plain JavaScript, and random bytes, for when the platform's crypto
 * is not reachable.
 *
 * **Why this exists.** Passwords are hashed with `expo-crypto`, which on web
 * delegates to `crypto.subtle`. The WebCrypto API is gated to *secure contexts*:
 * https, or localhost. Open the same build over plain http — a LAN address while
 * testing on a phone, an http preview link — and the browser refuses with
 *
 *     Access to the WebCrypto API is restricted to secure origins (localhost/https)
 *
 * which took out sign-up and sign-in entirely, because both hash a password
 * before they can do anything. A whole app failing to authenticate over http is
 * too sharp an edge to leave in.
 *
 * **Why a fallback is safe here.** This computes the *same* SHA-256 as WebCrypto
 * and returns the same lowercase hex, so a password hashed on http verifies on
 * https and the other way round. Accounts do not split into two incompatible
 * sets depending on how the app was opened — that would have been much worse
 * than the original error. `sha256.test.mjs` pins that against Node's own
 * implementation, including non-ASCII input.
 *
 * It is slower than the native path, by enough to notice in a loop and by
 * nothing at all for the two hashes a sign-in does. The native path is still
 * preferred whenever it works; this only catches the throw.
 *
 * None of this changes the honest limitation stated in `credentials.ts`:
 * SHA-256 is fast, which is the wrong property for a password KDF. The fix is
 * for Supabase Auth to hold the password. This only keeps the current scheme
 * working everywhere rather than making it stronger.
 */

// The first 32 bits of the fractional parts of the cube roots of the first 64
// primes — the SHA-256 round constants, from FIPS 180-4.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/**
 * UTF-8 bytes of a string.
 *
 * `TextEncoder` is used when present. The manual path is not decoration: it is
 * what makes an accented French name or an emoji hash to the same bytes as the
 * native implementation would, and getting surrogate pairs wrong here would
 * silently produce a different hash for some passwords and no error at all.
 */
function utf8Bytes(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);

  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        const cp = 0x10000 + ((c - 0xd800) << 10) + (next - 0xdc00);
        out.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f)
        );
        i++;
      } else {
        // A lone high surrogate. Encoders replace it with U+FFFD rather than
        // emitting invalid UTF-8; match that so the hashes agree.
        out.push(0xef, 0xbf, 0xbd);
      }
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      out.push(0xef, 0xbf, 0xbd);
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return new Uint8Array(out);
}

/** SHA-256 of a string's UTF-8 bytes, as lowercase hex. */
export function sha256Hex(text: string): string {
  const msg = utf8Bytes(text);
  const bitLength = msg.length * 8;

  // Message, then 0x80, then zeros, then the length as a 64-bit big-endian
  // integer, padded to a whole number of 64-byte blocks.
  const blocks = Math.ceil((msg.length + 1 + 8) / 64);
  const total = blocks * 64;
  const buf = new Uint8Array(total);
  buf.set(msg);
  buf[msg.length] = 0x80;

  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(total - 4, bitLength >>> 0, false);

  // Fractional parts of the square roots of the first eight primes.
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);

  for (let block = 0; block < blocks; block++) {
    const offset = block * 64;
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];
    let f = H[5];
    let g = H[6];
    let h = H[7];

    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  let hex = '';
  for (let i = 0; i < 8; i++) hex += H[i].toString(16).padStart(8, '0');
  return hex;
}

/**
 * Random bytes, best source first.
 *
 * `crypto.getRandomValues` is deliberately tried before anything else, and it is
 * worth knowing why it is not affected by the problem this file exists for:
 * only `crypto.subtle` is restricted to secure contexts. `getRandomValues` is
 * available over plain http too, so on the web the salt keeps its real entropy
 * even when the digest has to fall back.
 *
 * The `Math.random` branch is a genuine last resort for a platform with no
 * crypto at all. A salt is not a secret — it only has to be unique per account,
 * so that two people choosing the same password do not get the same hash — and
 * `Math.random` still gives that. It would be the wrong choice for a key.
 */
export function randomBytes(count: number): Uint8Array {
  const source = (globalThis as { crypto?: Crypto }).crypto;
  if (typeof source?.getRandomValues === 'function') {
    return source.getRandomValues(new Uint8Array(count));
  }
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}
