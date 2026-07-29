/// <reference lib="webworker" />
// CPU load worker — FPU throughput + memory-bandwidth pressure.
// Three groups of transcendental ops saturate the ARM VFP/NEON units.
// A 512 KB Float64Array (2× L1 cache) is read/written every iteration to
// keep the cache hierarchy and memory controller hot alongside the FPU —
// this is the main source of additional heat vs pure-compute loops.

let running = false;
let dutyCycle = 1.0;
// 500 ms burn window: longer continuous blocks → less scheduler overhead,
// more sustained thermal output from the ARM cores.
const PERIOD_MS = 500;

// 512 KB — exceeds L1 cache on all ARM cores (typically 32–64 KB),
// forcing L2 and DRAM traffic every cycle. Length must be a power-of-2
// so we can use bitmasking for the index wrap (no modulo division).
const MEM_BUF = new Float64Array(65536); // 65536 × 8 bytes = 512 KB
for (let i = 0; i < MEM_BUF.length; i++) MEM_BUF[i] = i * 0.001 + 1.0;
const MEM_MASK = MEM_BUF.length - 1; // 0xFFFF

function burn(ms: number): number {
  const end = performance.now() + ms;
  let x = 0.5;
  let mi = 0;
  while (performance.now() < end) {
    for (let i = 0; i < 8000; i++) {
      // Group 1 — sin/cos/sqrt (VFP)
      x = Math.sin(x * 2.1 + 0.3) * Math.cos(x * 1.7 + 0.5) +
          Math.sqrt(Math.abs(x * 3.14) + 0.001);
      // Group 2 — tan/sin/cos chain
      x = Math.tan(x * 0.7 + 0.1) * Math.sin(x + 1.2) + Math.cos(x * 2.3);
      // Group 3 — atan2 + log (different ALU ports)
      x = Math.atan2(Math.sin(x * 0.5), Math.cos(x * 0.8)) +
          Math.log1p(Math.abs(x));
      // Memory bandwidth: write then read adjacent slot — stresses L2/DRAM.
      MEM_BUF[mi] = x;
      x += MEM_BUF[(mi + 1) & MEM_MASK] * 1e-6;
      mi = (mi + 1) & MEM_MASK;
      // LCG keeps x non-trivial so V8 cannot eliminate the computation.
      x = x * 16807 % 2147483647;
      if (x === 0) x = 0.5;
    }
  }
  return x;
}

function loop() {
  if (!running) return;
  const busyMs = PERIOD_MS * dutyCycle;
  const result = burn(busyMs);
  // Observable side-effect → V8 cannot eliminate the computation.
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
