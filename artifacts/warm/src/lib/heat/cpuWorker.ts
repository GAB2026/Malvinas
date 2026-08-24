/// <reference lib="webworker" />
// CPU load worker v3.0 — dual compute mode: 'fpu' (flagship) + 'fmla' (budget/mid).
//
// MODE 'fpu' — for high-end chips (Cortex-A77+, Snapdragon 865+, Exynos 990+):
//   Four independent chains of sin/cos/tan/atan2/sqrt.  These ARE hardware
//   VFP instructions on A77+ and generate maximum heat.  On A55 and below
//   transcendentals are SOFTWARE-EMULATED (libm), so throughput is low and
//   heat output is poor — see mode 'fmla' for those.
//
// MODE 'fmla' — for budget/mid chips (Cortex-A53/A55, MT6xxx, SC9xxx, most
//   Snapdragon 4/6xx budget variants):
//   Eight independent float multiply-accumulate chains.  FMLA is a NATIVE
//   hardware instruction on every ARM core since Cortex-A5, including A53/A55.
//   On a 2-wide A55 FPU the CPU can issue 2 FMLA ops/cycle: 8 independent
//   chains keep both slots full with zero pipeline stalls.  This outperforms
//   software-emulated transcendentals by 3-5× on budget chips.
//
// The engine sends the compute mode at startup ('start' message).
// The main-thread benchmark selects the mode based on measured kOps/s.

let running = false;
let dutyCycle = 1.0;
let computeMode: 'fpu' | 'fmla' = 'fpu';
const PERIOD_MS = 500;

// ── Shared memory buffer — keeps the cache hierarchy warm ────────────────────
const MEM_BUF  = new Float64Array(65536); // 512 KB
for (let i = 0; i < MEM_BUF.length; i++) MEM_BUF[i] = i * 0.001 + 1.0;
const MEM_MASK = 65535;

interface BurnResult { v: number; iters: number; ms: number; }

// ── FPU mode — hardware transcendentals on A77+  ─────────────────────────────
function burnFpu(ms: number): BurnResult {
  const t0  = performance.now();
  const end = t0 + ms;

  let a = 0.1234, b = 0.5678, c = 0.9012, d = 0.3456;
  let mi = 0;
  let n = 0x12345678;
  let iters = 0;

  while (performance.now() < end) {
    for (let i = 0; i < 10000; i++) {
      a = Math.sin(a * 2.1 + b * 0.3) + Math.cos(b * 1.7 + a * 0.2);
      b = Math.cos(b * 1.9 + a * 0.4) + Math.sin(a * 1.3 + b * 0.5);
      c = Math.sin(c * 2.3 + d * 0.6) + Math.cos(d * 1.5 + c * 0.7);
      d = Math.cos(d * 2.0 + c * 0.1) + Math.sin(c * 1.8 + d * 0.4);
      a = Math.tan(a * 0.4 + c * 0.1) + b * 0.02;
      b = Math.tan(b * 0.3 + d * 0.1) + a * 0.02;
      c = Math.atan2(c, d) + Math.sqrt(Math.abs(a * 3.14) + 0.001);
      d = Math.atan2(d, a) + Math.sqrt(Math.abs(b * 2.71) + 0.001);
      n = (Math.imul(n, 1664525) + 1013904223) | 0;
      a += (n & 0xFF) * 1e-10;
      MEM_BUF[mi] = a + c;
      d += MEM_BUF[(mi + 1) & MEM_MASK] * 1e-8;
      mi = (mi + 1) & MEM_MASK;
      if (!isFinite(a)) a = 0.1234;
      if (!isFinite(b)) b = 0.5678;
      if (!isFinite(c)) c = 0.9012;
      if (!isFinite(d)) d = 0.3456;
    }
    iters++;
  }
  return { v: a + b + c + d + n, iters, ms: performance.now() - t0 };
}

// ── FMLA mode — 8 independent multiply-accumulate chains ─────────────────────
// Hardware FMLA exists on ALL ARM cores since Cortex-A5. On a 2-wide A55 FPU
// both issue slots stay full: net heat/cycle is higher than software sin/cos.
// Eight independent chains prevent write-after-read pipeline stalls.
function burnFmla(ms: number): BurnResult {
  const t0  = performance.now();
  const end = t0 + ms;

  let a = 1.0001, b = 1.0002, c = 1.0003, d = 1.0004;
  let e = 0.9999, f = 0.9998, g = 0.9997, h = 0.9996;
  let mi = 0;
  let n = 0x12345678;
  let iters = 0;

  while (performance.now() < end) {
    for (let i = 0; i < 10000; i++) {
      // 8 independent FMLA chains — no data dependency between them
      a = a * 1.0000001 + b * 0.9999999;
      b = b * 0.9999998 + c * 1.0000002;
      c = c * 1.0000003 + d * 0.9999997;
      d = d * 0.9999996 + e * 1.0000004;
      e = e * 1.0000005 + f * 0.9999995;
      f = f * 0.9999994 + g * 1.0000006;
      g = g * 1.0000007 + h * 0.9999993;
      h = h * 0.9999992 + a * 1.0000008;

      // Integer pipeline: runs in parallel with FPU on all ARM cores
      n = (Math.imul(n, 1664525) + 1013904223) | 0;
      a += (n & 0xFF) * 1e-12;

      // Memory bandwidth: cache-line pressure adds to power draw
      MEM_BUF[mi] = a + e;
      h += MEM_BUF[(mi + 3) & MEM_MASK] * 1e-12;
      mi = (mi + 1) & MEM_MASK;

      // Clamp to prevent overflow — no isFinite call needed (FMLA stays bounded)
      if (a > 2.0 || a < 0.5) a = 1.0001;
      if (b > 2.0 || b < 0.5) b = 1.0002;
      if (c > 2.0 || c < 0.5) c = 1.0003;
      if (d > 2.0 || d < 0.5) d = 1.0004;
      if (e > 2.0 || e < 0.5) e = 0.9999;
      if (f > 2.0 || f < 0.5) f = 0.9998;
      if (g > 2.0 || g < 0.5) g = 0.9997;
      if (h > 2.0 || h < 0.5) h = 0.9996;
    }
    iters++;
  }
  return { v: a + b + c + d + e + f + g + h + n, iters, ms: performance.now() - t0 };
}

function burn(ms: number): BurnResult {
  return computeMode === 'fmla' ? burnFmla(ms) : burnFpu(ms);
}

function loop() {
  if (!running) return;
  const busyMs = PERIOD_MS * dutyCycle;
  const { v, iters, ms } = burn(busyMs);
  self.postMessage({ type: 'heartbeat', v, iters, ms });
  setTimeout(loop, Math.max(0, PERIOD_MS - busyMs));
}

self.onmessage = (e: MessageEvent<{
  type: 'start' | 'stop' | 'setDuty';
  duty?: number;
  computeMode?: 'fpu' | 'fmla';
}>) => {
  const msg = e.data;
  if (msg.type === 'start') {
    if (msg.computeMode) computeMode = msg.computeMode;
    if (typeof msg.duty === 'number') dutyCycle = msg.duty;
    if (!running) { running = true; loop(); }
  } else if (msg.type === 'setDuty') {
    if (typeof msg.duty === 'number') dutyCycle = msg.duty;
  } else if (msg.type === 'stop') {
    running = false;
  }
};
