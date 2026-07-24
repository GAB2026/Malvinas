/**
 * Pure-Node.js PNG icon generator — no native dependencies.
 * Generates icon-192.png, icon-512.png and apple-touch-icon.png
 * for the PWA manifest.
 */
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir   = join(__dirname, '..', 'public');
mkdirSync(outDir, { recursive: true });

/* ── CRC-32 ───────────────────────────────────────────────── */
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

/* ── PNG chunk builder ────────────────────────────────────── */
function chunk(type, data) {
  const tb  = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const crc = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, data])));
  return Buffer.concat([len, tb, data, crc]);
}

/* ── PNG encoder ─────────────────────────────────────────── */
function encodePNG(w, h, rgba) {
  const rowLen = w * 4;
  const raw    = Buffer.allocUnsafe(h * (rowLen + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (rowLen + 1)] = 0;                          // filter: None
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

/* ── Icon drawing ────────────────────────────────────────── */
// Argentine celeste palette
const NAVY   = [13,  27,  42];   // #0D1B2A
const CELES  = [116, 172, 223];  // #74ACDF
const WHITE  = [255, 255, 255];

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function mix(c1, c2, t) { return c1.map((v, i) => lerp(v, c2[i], t)); }

function drawIcon(size) {
  const buf = Buffer.allocUnsafe(size * size * 4);
  const cx  = size / 2, cy = size / 2;
  const R   = size * 0.46;   // outer circle radius

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const d  = Math.sqrt(dx * dx + dy * dy);

      // Smooth edge helper
      function aa(edge, width = 1.2) {
        return Math.max(0, Math.min(1, (edge - d) / width));
      }

      let [r, g, b, a] = [...NAVY, 255];

      // Rounded square background with slight rounding (r = size*0.18)
      const cornerR = size * 0.18;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      const insideRoundedSq =
        ax <= cx - cornerR && ay <= cy ||
        ax <= cx && ay <= cy - cornerR ||
        Math.sqrt(Math.pow(Math.max(0, ax - (cx - cornerR)), 2) +
                  Math.pow(Math.max(0, ay - (cy - cornerR)), 2)) <= cornerR;

      if (!insideRoundedSq) {
        // Transparent corner
        buf[(y * size + x) * 4 + 3] = 0;
        continue;
      }

      // Concentric rings — from inside out:
      // 1. Center solid celeste circle
      // 2. White ring
      // 3. Celeste outer ring
      // 4. Navy background (already set)

      const r1 = R * 0.42;   // celeste center
      const r2 = R * 0.55;   // white ring inner
      const r3 = R * 0.72;   // celeste outer ring inner
      // R          celeste outer ring outer

      if (d < r1) {
        [r, g, b] = CELES;
      } else if (d < r2) {
        // Smooth celeste→white transition
        const t = aa(r2, 1.5) < 1 ? 1 - aa(r2, 1.5) : (d - r1) / (r2 - r1);
        [r, g, b] = mix(CELES, WHITE, Math.min(1, (d - r1) / (r2 - r1)));
      } else if (d < r3) {
        [r, g, b] = WHITE;
      } else if (d < R) {
        [r, g, b] = CELES;
        // Gradient: blend celeste to navy at the very edge
        const edge = aa(R, 1.5);
        a = Math.round(255 * edge);
        if (a < 255) {
          // premix with navy background
          const t2 = a / 255;
          [r, g, b] = mix(NAVY, CELES, t2);
          a = 255;
        }
      }

      const i = (y * size + x) * 4;
      buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = a;
    }
  }
  return buf;
}

const sizes = [
  { size: 512, name: 'icon-512.png'       },
  { size: 192, name: 'icon-192.png'       },
  { size: 180, name: 'apple-touch-icon.png' },
];

for (const { size, name } of sizes) {
  const pixels = drawIcon(size);
  const png    = encodePNG(size, size, pixels);
  writeFileSync(join(outDir, name), png);
  console.log(`✓ ${name}  (${size}×${size}, ${png.length} bytes)`);
}
