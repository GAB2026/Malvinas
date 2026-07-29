/// <reference lib="webworker" />
// CPU load worker — tight ALU burn loop proven to generate heat on Android.
// Kept intentionally simple: no large allocations that Android may kill.

let running = false;
let dutyCycle = 1.0;
const PERIOD_MS = 100;

function burn(ms: number): number {
  const end = performance.now() + ms;
  let x = 0.5;
  while (performance.now() < end) {
    // ~8 000 transcendental ops per outer iteration.
    // Transcendentals (sin/cos/sqrt) are not optimized away by V8 and map
    // directly to ARM NEON / VFP instructions — maximum thermal output.
    for (let i = 0; i < 8000; i++) {
      x = Math.sin(x * 2.1 + 0.3) * Math.cos(x * 1.7 + 0.5) +
          Math.sqrt(Math.abs(x * 3.14) + 0.001);
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
  // Post result so V8 cannot dead-code-eliminate the computation.
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
