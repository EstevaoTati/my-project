/**
 * The plain-JS SHA-256 must agree with the platform's, byte for byte.
 *
 * This is the assertion the whole fallback rests on. If it ever drifts, a
 * password hashed over http would not verify over https and accounts would
 * quietly split into two incompatible sets — a far worse failure than the
 * secure-origin error the fallback exists to avoid.
 *
 *   node tools/sha256.test.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// The module is TypeScript, but its body is plain JS with type annotations only
// on the exported signatures. Strip those rather than pulling in a compiler.
const source = readFileSync(new URL('../src/sha256.ts', import.meta.url), 'utf8');
const js = source
  .replace(/^export function sha256Hex\(text: string\): string \{$/m, 'export function sha256Hex(text) {')
  .replace(/^export function randomBytes\(count: number\): Uint8Array \{$/m, 'export function randomBytes(count) {')
  .replace(/^function utf8Bytes\(text: string\): Uint8Array \{$/m, 'function utf8Bytes(text) {')
  .replace(/const out: number\[\] = \[\];/, 'const out = [];')
  .replace(/\(globalThis as \{ crypto\?: Crypto \}\)\.crypto/, 'globalThis.crypto');

const module = await import(
  'data:text/javascript;base64,' + Buffer.from(js, 'utf8').toString('base64')
);
const { sha256Hex, randomBytes } = module;

let pass = 0;
const fails = [];
const check = (label, fn) => {
  try {
    if (!fn()) throw new Error('assertion falsy');
    console.log('  ✓ ' + label);
    pass++;
  } catch (e) {
    console.log('  ✗ ' + label + ' — ' + e.message.split('\n')[0]);
    fails.push(label);
  }
};

const node = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// Published vectors first, so a failure points at the algorithm rather than at
// a disagreement with Node.
check('the empty string matches the published vector', () =>
  sha256Hex('') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
check('"abc" matches the published vector', () =>
  sha256Hex('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

const cases = [
  ['a password', 'Mwinda2026'],
  ['the salted shape the app actually hashes', 'a3f19c02bd7e4411:Mwinda2026'],
  ['accented French', 'Estevao Macumbá — référence'],
  ['an emoji (surrogate pair)', 'mot de passe 🔐 fort'],
  ['exactly 55 bytes (one block, no overflow)', 'x'.repeat(55)],
  ['exactly 56 bytes (forces a second block)', 'x'.repeat(56)],
  ['exactly 64 bytes (a whole block)', 'x'.repeat(64)],
  ['a long string spanning many blocks', 'très long '.repeat(500)],
];
for (const [label, input] of cases) {
  check(`matches Node for ${label}`, () => sha256Hex(input) === node(input));
}

check('randomBytes returns the requested length', () => randomBytes(16).length === 16);
check('randomBytes is not constant', () => {
  const a = Buffer.from(randomBytes(16)).toString('hex');
  const b = Buffer.from(randomBytes(16)).toString('hex');
  return a !== b;
});
check('randomBytes stays in range', () => [...randomBytes(64)].every((b) => b >= 0 && b <= 255));

console.log(`\n${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
