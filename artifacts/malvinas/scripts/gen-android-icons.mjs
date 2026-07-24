/**
 * Generates Android launcher icons (ic_launcher.png, ic_launcher_foreground.png,
 * ic_launcher_round.png) for all required mipmap densities.
 * Pure Node.js — no native dependencies.
 */
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const androidRes = join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

/* ── PNG encoder (same as gen-icons.mjs) ─────────────────── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const tb = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const crc = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, data])));
  return Buffer.concat([len, tb, data, crc]);
}
function encodePNG(w, h, rgba) {
  const rowLen = w * 4;
  const raw    = Buffer.allocUnsafe(h * (rowLen + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (rowLen + 1)] = 0;
    rgba.copy(raw, y * (rowLen + 1) + 1, y * rowLen, (y + 1) * rowLen);
  }
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const NAVY  = [13,  27,  42];
const CELES = [116, 172, 223];
const WHITE = [255, 255, 255];
function mix(c1, c2, t) { return c1.map((v, i) => Math.round(v + (c2[i] - v) * t)); }

/* ── Opaque launcher icon ────────────────────────────────── */
function drawLauncher(size) {
  const buf = Buffer.allocUnsafe(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const R   = size * 0.46;
  const r1  = R * 0.42, r2 = R * 0.55, r3 = R * 0.72;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const d  = Math.sqrt(dx * dx + dy * dy);
      let [r, g, b, a] = [...NAVY, 255];

      if (d < r1)      { [r, g, b] = CELES; }
      else if (d < r2) { [r, g, b] = WHITE; }
      else if (d < r3) { [r, g, b] = WHITE; }
      else if (d < R)  { [r, g, b] = CELES; }

      const i = (y * size + x) * 4;
      buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = a;
    }
  }
  return buf;
}

/* ── Foreground icon (transparent bg, padded 25 %) ─────── */
function drawForeground(size) {
  const buf = Buffer.alloc(size * size * 4, 0); // fully transparent
  const pad = size * 0.15;
  const inner = size - pad * 2;
  const cx = size / 2, cy = size / 2;
  const R   = (inner / 2) * 0.92;
  const r1  = R * 0.42, r2 = R * 0.55, r3 = R * 0.72;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d >= R) continue;

      let [r, g, b, a] = [0, 0, 0, 0];
      if (d < r1)      { [r, g, b, a] = [...CELES, 255]; }
      else if (d < r2) { [r, g, b, a] = [...WHITE, 255]; }
      else if (d < r3) { [r, g, b, a] = [...WHITE, 255]; }
      else             { [r, g, b, a] = [...CELES, 255]; }

      // Anti-alias outer edge
      const aa = Math.max(0, Math.min(1, (R - d) / 1.5));
      a = Math.round(a * aa);

      const i = (y * size + x) * 4;
      buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = a;
    }
  }
  return buf;
}

/* ── Density specs ───────────────────────────────────────── */
const densities = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

let count = 0;
for (const { dir, size } of densities) {
  const outDir = join(androidRes, dir);
  mkdirSync(outDir, { recursive: true });

  const launcherBuf = drawLauncher(size);
  const launcherPng = encodePNG(size, size, launcherBuf);
  writeFileSync(join(outDir, 'ic_launcher.png'),       launcherPng);
  writeFileSync(join(outDir, 'ic_launcher_round.png'), launcherPng);

  const fgBuf = drawForeground(size);
  const fgPng = encodePNG(size, size, fgBuf);
  writeFileSync(join(outDir, 'ic_launcher_foreground.png'), fgPng);

  console.log(`✓ ${dir.padEnd(18)} ${size}×${size}px`);
  count++;
}

/* ── Background color resource ───────────────────────────── */
const valuesDir = join(androidRes, 'values');
mkdirSync(valuesDir, { recursive: true });
writeFileSync(
  join(valuesDir, 'ic_launcher_background.xml'),
`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0D1B2A</color>
</resources>
`);

/* ── Adaptive icon XMLs (anydpi-v26) ─────────────────────── */
const anydpiDir = join(androidRes, 'mipmap-anydpi-v26');
mkdirSync(anydpiDir, { recursive: true });

const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
writeFileSync(join(anydpiDir, 'ic_launcher.xml'),       adaptiveXml);
writeFileSync(join(anydpiDir, 'ic_launcher_round.xml'), adaptiveXml);

console.log(`\n✓ Adaptive icon XMLs (mipmap-anydpi-v26)`);
console.log(`✓ Background color resource (values/ic_launcher_background.xml)`);
console.log(`\n${count * 3 + 2} files written — Android launcher icons ready.`);
