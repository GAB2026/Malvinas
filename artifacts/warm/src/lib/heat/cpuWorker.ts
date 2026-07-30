/// <reference lib="webworker" />
// CPU load worker v2.6 — 4 independent FPU accumulators + throughput reporting.
//
// KEY INSIGHT: the previous single-accumulator chain (x = f(x) → x = g(x) → …)
// creates data dependencies that STALL the ARM VFP pipeline — each op waits
// for the previous one to complete before it can start.
//
// With 4 independent accumulators (a, b, c, d), the ARM out-of-order FPU can
// DISPATCH MULTIPLE OPS IN PARALLEL across its execution units.  On a Cortex-A7x
// with a 4-wide FPU issue port, this can quadruple effective throughput and,
// consequently, heat output per unit time.
//
// Integer ALU (Math.imul) runs on the separate integer pipeline, adding load
// without competing with the FPU.  A small memory array (~512 KB) keeps the
// cache hierarchy warm alongside the FPU.

let running = false;
let dutyCycle = 1.0;
const PERIOD_MS = 500;

const MEM_BUF = new Float64Array(65536); // 512 KB
for (let i = 0; i < MEM_BUF.length; i++) MEM_BUF[i] = i * 0.001 + 1.0;
const MEM_MASK = 65535;

interface BurnResult { v: number; iters: number; ms: number; }

function burn(ms: number): BurnResult {
  const t0  = performance.now();
  const end = t0 + ms;

  // Four independent chains — ARM FPU can issue ops across all four without
  // stalling on data dependencies.
  let a = 0.1234, b = 0.5678, c = 0.9012, d = 0.3456;
  let mi = 0;
  let n = 0x12345678; // integer accumulator
  let iters = 0;      // counts completed 10 k-op blocks

  while (performance.now() < end) {
    for (let i = 0; i < 10000; i++) {
      // ── Parallel chains A & B: sin/cos (ARM VFP hw instructions, ~20 cy) ──
      a = Math.sin(a * 2.1 + b * 0.3) + Math.cos(b * 1.7 + a * 0.2);
      b = Math.cos(b * 1.9 + a * 0.4) + Math.sin(a * 1.3 + b * 0.5);

      // ── Parallel chains C & D: sin/cos with different constants ───────────
      c = Math.sin(c * 2.3 + d * 0.6) + Math.cos(d * 1.5 + c * 0.7);
      d = Math.cos(d * 2.0 + c * 0.1) + Math.sin(c * 1.8 + d * 0.4);

      // ── tan cross-chain: hardware tan, ~30 cy on ARM VFP ──────────────────
      a = Math.tan(a * 0.4 + c * 0.1) + b * 0.02;
      b = Math.tan(b * 0.3 + d * 0.1) + a * 0.02;

      // ── atan2 + sqrt: both hardware on ARM, different exec units ──────────
      c = Math.atan2(c, d) + Math.sqrt(Math.abs(a * 3.14) + 0.001);
      d = Math.atan2(d, a) + Math.sqrt(Math.abs(b * 2.71) + 0.001);

      // ── Integer ALU: runs on integer multiplier, parallel to FPU ──────────
      n = (Math.imul(n, 1664525) + 1013904223) | 0;
      a += (n & 0xFF) * 1e-10;

      // ── Memory: small touch to keep cache lines hot ────────────────────────
      MEM_BUF[mi] = a + c;
      d += MEM_BUF[(mi + 1) & MEM_MASK] * 1e-8;
      mi = (mi + 1) & MEM_MASK;

      // ── Bound check — prevents NaN/Inf from tan near ±π/2 ─────────────────
      if (!isFinite(a)) a = 0.1234;
      if (!isFinite(b)) b = 0.5678;
      if (!isFinite(c)) c = 0.9012;
      if (!isFinite(d)) d = 0.3456;
    }
    iters++;
  }

  // Checksum is the sink that forces V8 to treat the computation as live.
  // It's transmitted to the main thread so the engine cannot dead-code-eliminate it.
  return { v: a + b + c + d + n, iters, ms: performance.now() - t0 };
}

function loop() {
  if (!running) return;
  const busyMs = PERIOD_MS * dutyCycle;
  const { v, iters, ms } = burn(busyMs);
  // postMessage sends the checksum (v) back to the main thread, ensuring V8
  // cannot elide the computation as dead code.  iters and ms let the main
  // thread compute real throughput (ops/s) to confirm work under throttling.
  self.postMessage({ type: 'heartbeat', v, iters, ms });
  setTimeout(loop, Math.max(0, PERIOD_MS - busyMs));
}

self.onmessage = (e: MessageEvent<{ type: 'start' | 'stop' | 'setDuty'; duty?: number }>) => {
  const msg = e.data;
  if (msg.type === 'start') {
    if (typeof msg.duty === 'number') dutyCycle = msg.duty;
    if (!running) { running = true; loop(); }
  } else if (msg.type === 'setDuty') {
    if (typeof msg.duty === 'number') dutyCycle = msg.duty;
  } else if (msg.type === 'stop') {
    running = false;
  }
};
