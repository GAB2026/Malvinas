/// <reference lib="webworker" />
// CPU load worker — runs a hard ALU + memory-bandwidth burn loop.
// Intensity is controlled via duty cycle (fraction of each period spent computing).

let running = false;
let dutyCycle = 1.0;
const PERIOD_MS = 50;

// Pre-allocated buffer to stress the memory bus in addition to the FPU.
// 128 KB — large enough to overflow L1 cache on most mobile chips.
const BUF = new Float64Array(16384);
for (let i = 0; i < BUF.length; i++) BUF[i] = i * 0.000123 + 1;

function burn(ms: number) {
  const end = performance.now() + ms;
  let x = 0.7;
  let idx = 0;
  while (performance.now() < end) {
    // ALU/FPU pressure — transcendentals are expensive on ARM
    for (let i = 0; i < 25000; i++) {
      x = Math.sin(x * 2.1 + 0.3) * Math.cos(x * 1.7 + 0.5) +
          Math.sqrt(Math.abs(x * 3.1) + 0.001);
      x = Math.tan(x * 0.7 + 0.1) * Math.sin(x + 1.2) + Math.cos(x * 2.3);
      x = (x * 16807) % 2147483647;
      if (x === 0) x = 0.7;
    }
    // Memory-bandwidth pressure — read-modify-write across the buffer
    for (let i = 0; i < 2048; i++) {
      BUF[idx] = x + i;
      x += BUF[(idx + 8192) & (BUF.length - 1)];
      idx = (idx + 1) & (BUF.length - 1);
    }
  }
  return x;
}

function loop() {
  if (!running) return;
  const busyMs = PERIOD_MS * dutyCycle;
  burn(busyMs);
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
