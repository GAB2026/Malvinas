/// <reference lib="webworker" />
// CPU load worker: runs busy-loop bursts with a duty cycle so intensity is controllable.

let running = false;
let dutyCycle = 0.5; // fraction of each period spent computing
const PERIOD_MS = 100;

function burn(ms: number) {
  const end = performance.now() + ms;
  let x = 0.5;
  // Meaningless but un-optimizable math to keep the ALU/FPU busy.
  while (performance.now() < end) {
    for (let i = 0; i < 5000; i++) {
      x = Math.sin(x) * Math.cos(x * 1.3) + Math.sqrt(Math.abs(x) + 0.001);
      x = (x * 16807) % 2147483647 || 0.5;
    }
  }
  return x;
}

function loop() {
  if (!running) return;
  const busyMs = PERIOD_MS * dutyCycle;
  burn(busyMs);
  // Yield for the rest of the period so duty cycle < 1 actually cools down.
  setTimeout(loop, Math.max(0, PERIOD_MS - busyMs));
}

self.onmessage = (e: MessageEvent<{ type: 'start' | 'stop' | 'setDuty'; duty?: number }>) => {
  const msg = e.data;
  if (msg.type === 'start') {
    if (typeof msg.duty === 'number') dutyCycle = msg.duty;
    if (!running) {
      running = true;
      loop();
    }
  } else if (msg.type === 'setDuty') {
    if (typeof msg.duty === 'number') dutyCycle = msg.duty;
  } else if (msg.type === 'stop') {
    running = false;
  }
};

export {};
