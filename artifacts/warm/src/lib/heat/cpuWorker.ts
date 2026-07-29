/// <reference lib="webworker" />
// CPU load worker — 5× FPU throughput + integer ALU + memory bandwidth.
// Five groups of transcendental ops saturate ARM VFP/NEON; integer ALU hits
// separate execution ports; a 2 MB Float64Array keeps the memory controller
// and cache hierarchy busy in parallel with the FPU.

let running = false;
let dutyCycle = 1.0;
const PERIOD_MS = 500;

// 2 MB — well above L1 (32–64 KB) and L2 (256–512 KB) on ARM Cortex.
// Sequential writes + reads force L3/DRAM traffic every cycle.
// Length must be power-of-2 for bitmask wrapping (no division).
const MEM_BUF = new Float64Array(262144); // 262144 × 8 bytes = 2 MB
for (let i = 0; i < MEM_BUF.length; i++) MEM_BUF[i] = i * 0.001 + 1.0;
const MEM_MASK = MEM_BUF.length - 1; // 0x3FFFF

function burn(ms: number): number {
  const end = performance.now() + ms;
  let x = 0.5;
  let mi = 0;
  // Integer accumulator — feeds ARM's integer multiplier / ALU in parallel
  // with the FPU, stressing a different hardware unit.
  let n = 0x12345678;
  while (performance.now() < end) {
    for (let i = 0; i < 8000; i++) {
      // ── Group 1: sin / cos / sqrt ──────────────────────────────────────────
      x = Math.sin(x * 2.1 + 0.3) * Math.cos(x * 1.7 + 0.5) +
          Math.sqrt(Math.abs(x * 3.14) + 0.001);

      // ── Group 2: tan / sin / cos chain ────────────────────────────────────
      x = Math.tan(x * 0.7 + 0.1) * Math.sin(x + 1.2) + Math.cos(x * 2.3);

      // ── Group 3: atan2 + log (different ALU ports on ARM) ─────────────────
      x = Math.atan2(Math.sin(x * 0.5), Math.cos(x * 0.8)) +
          Math.log1p(Math.abs(x));

      // ── Group 4: exp + log — heavy transcendental path ────────────────────
      x = Math.exp(Math.abs(x) * 0.08) + Math.log(Math.abs(x * 1.3) + 0.1);

      // ── Group 5: pow + hyperbolic — saturates remaining FP units ──────────
      x = Math.pow(Math.abs(x) + 0.01, 0.6) +
          Math.sinh(x * 0.05) * Math.cosh(x * 0.04);

      // ── Integer ALU: LCG using 32-bit multiply ─────────────────────────────
      // Runs on ARM's integer multiplier, independent of the VFP pipeline.
      n = (Math.imul(n, 1664525) + 1013904223) | 0;
      x += (n & 0xFFFF) * 1e-9; // couples integer result to float chain

      // ── Memory bandwidth: write + read stride-1 in 2 MB array ─────────────
      MEM_BUF[mi] = x;
      x += MEM_BUF[(mi + 1) & MEM_MASK] * 1e-6;
      mi = (mi + 1) & MEM_MASK;

      // ── LCG to prevent V8 dead-code elimination ───────────────────────────
      x = x * 16807 % 2147483647;
      if (x === 0) x = 0.5;
    }
  }
  return x + n;
}

function loop() {
  if (!running) return;
  const busyMs = PERIOD_MS * dutyCycle;
  const result = burn(busyMs);
  self.postMessage({ type: 'heartbeat', v: result });
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
