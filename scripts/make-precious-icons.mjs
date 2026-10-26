#!/usr/bin/env node
// Draws the PRECIOUS app icons.
//
// No image library and no binary blob checked in blind: the icon is the same
// reactor core the app renders, described here as arithmetic and encoded to
// PNG by hand (IHDR/IDAT/IEND + zlib). Re-run after changing the mark:
//
//   node scripts/make-precious-icons.mjs
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TAU = Math.PI * 2;

const CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // truecolour with alpha
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// The mark: black field, machined bezel, spectrum crown, incandescent heart.
// `inset` leaves the safe area a maskable icon needs (Android crops to 80%).
function draw(size, inset) {
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const R = (size / 2) * inset;
  const GOLD = [255, 215, 0];
  const GOLD_DIM = [212, 175, 55];

  const bars = 48;
  const barLen = (i) => 0.62 + 0.3 * Math.abs(Math.sin(i * 0.82)) ** 1.5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c + 0.5, dy = y - c + 0.5;
      const d = Math.hypot(dx, dy) / R;          // 0 at the centre, 1 at the bezel
      const a = (Math.atan2(dy, dx) + TAU) % TAU;

      let r = 5, g = 5, b = 7, alpha = 1;        // the field is never transparent

      // Halo
      if (d < 1.05) {
        const halo = Math.max(0, 1 - d / 1.05) ** 2.4 * 0.5;
        r += GOLD[0] * halo * 0.5; g += GOLD[1] * halo * 0.5; b += GOLD[2] * halo * 0.35;
      }
      // Bezel ring + ticks
      if (d > 0.93 && d < 0.985) {
        const tick = Math.abs(Math.sin(a * 30)) > 0.55 ? 0.85 : 0.3;
        r = GOLD_DIM[0] * tick; g = GOLD_DIM[1] * tick; b = GOLD_DIM[2] * tick;
      }
      // Spectrum crown
      const slot = Math.floor((a / TAU) * bars);
      const within = ((a / TAU) * bars) % 1;
      if (d > 0.62 && d < barLen(slot) && within > 0.22 && within < 0.78) {
        const hot = (d - 0.62) / 0.3;
        r = GOLD[0]; g = GOLD[1] * (0.92 - hot * 0.15); b = GOLD[2] * (0.35 + hot * 0.2);
      }
      // Iris
      if (d > 0.45 && d < 0.475) { r = GOLD[0] * 0.75; g = GOLD[1] * 0.7; b = 60; }
      // Heart
      if (d < 0.38) {
        const k = 1 - d / 0.38;
        const white = k ** 2.2;
        r = 255 * white + GOLD[0] * (1 - white);
        g = 255 * white + GOLD[1] * (1 - white) * 0.95;
        b = 255 * white + 40 * (1 - white);
      }

      const i = (y * size + x) * 4;
      buf[i] = Math.min(255, Math.round(r));
      buf[i + 1] = Math.min(255, Math.round(g));
      buf[i + 2] = Math.min(255, Math.round(b));
      buf[i + 3] = Math.round(alpha * 255);
    }
  }
  return buf;
}

const targets = [
  ["assets/precious-icon-192.png", 192, 0.86],
  ["assets/precious-icon-512.png", 512, 0.86],
  ["assets/precious-icon-maskable-512.png", 512, 0.64], // safe area for Android masks
];

for (const [path, size, inset] of targets) {
  writeFileSync(join(ROOT, path), encodePNG(size, size, draw(size, inset)));
  console.log(`wrote ${path} (${size}x${size})`);
}
