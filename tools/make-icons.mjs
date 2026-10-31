// Generates the PNG app icons the dock needs to install as a fullscreen app.
//
//   node tools/make-icons.mjs
//
// Pure Node (zlib only) — no dependencies, no image library, so it runs offline.
// The mark matches public/icon.svg: a monitor outline, a lens and a stand.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public');

const BG = [0, 0, 0];
const INK = [91, 140, 255];

// ---------------------------------------------------------------- PNG writer

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- the artwork

const ring = (d, r, t) => d <= r && d >= r - t;

/** Outline of a rounded rectangle by up to `r` corner radius, stroke `t`. */
const roundRectOutline = (x, y, rx, ry, w, h, r, t) => {
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  return ring(Math.hypot(x - cx, y - cy), r, t);
};

const disc = (x, y, cx, cy, r, t) => ring(Math.hypot(x - cx, y - cy), r, t);

/** The mark, drawn inside a `span` fraction of the canvas, centred. */
function mark(x, y, size, span) {
  const s = size * span;
  const ox = (size - s) / 2;
  const oy = (size - s) / 2;
  const px = (x - ox) / s;
  const py = (y - oy) / s;
  if (px < 0 || px > 1 || py < 0 || py > 1) return false;

  const stroke = 0.058;
  // monitor shell
  if (roundRectOutline(px, py, 0.14, 0.18, 0.72, 0.5, 0.12, stroke)) return true;
  // lens
  if (disc(px, py, 0.5, 0.43, 0.135, stroke)) return true;
  // stand: stem, then the foot
  if (px >= 0.478 && px <= 0.522 && py >= 0.68 && py <= 0.8) return true;
  if (py >= 0.77 && py <= 0.814 && px >= 0.36 && px <= 0.64) return true;
  return false;
}

function render(size, span, samples = 3) {
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          if (mark(px, py, size, span)) hits++;
        }
      }
      const cover = hits / (samples * samples);
      const i = (y * size + x) * 4;
      out[i] = Math.round(BG[0] + (INK[0] - BG[0]) * cover);
      out[i + 1] = Math.round(BG[1] + (INK[1] - BG[1]) * cover);
      out[i + 2] = Math.round(BG[2] + (INK[2] - BG[2]) * cover);
      out[i + 3] = 255;
    }
  }
  return out;
}

const targets = [
  ['icon-192.png', 192, 0.74],
  ['icon-512.png', 512, 0.74],
  ['icon-maskable-512.png', 512, 0.5], // stays inside the maskable safe zone
];

for (const [name, size, span] of targets) {
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, encodePng(size, render(size, span)));
  console.log(`${name}  ${size}×${size}  ${(fs.statSync(file).size / 1024).toFixed(1)} KB`);
}
