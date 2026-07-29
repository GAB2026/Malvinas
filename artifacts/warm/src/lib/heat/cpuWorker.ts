/// <reference lib="webworker" />
// CPU load worker — 3× FPU throughput vs previous version.
// Each inner iteration runs three groups of transcendental ops so the ARM
// VFP / NEON execution units stay saturated for the full burn window.

let running = false;
let dutyCycle = 1.0;
const PERIOD_MS = 100;

function burn(ms: number): number {
  const end = performance.now() + ms;
  let x = 0.5;
  while (performance.now() < end) {
    for (let i = 0; i < 8000; i++) {
      // Group 1 — original ops
      x = Math.sin(x * 2.1 + 0.3) * Math.cos(x * 1.7 + 0.5) +
          Math.sqrt(Math.abs(x * 3.14) + 0.001);
      // Group 2 — tan / sin / cos chain
      x = Math.tan(x * 0.7 + 0.1) * Math.sin(x + 1.2) + Math.cos(x * 2.3);
      // Group 3 — atan2 + log (hits different ALU ports)
      x = Math.atan2(Math.sin(x * 0.5), Math.cos(x * 0.8)) +
          Math.log1p(Math.abs(x));
      // LCG to prevent V8 from collapsing the loop as dead code
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
