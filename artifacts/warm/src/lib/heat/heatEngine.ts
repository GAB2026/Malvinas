import { GpuLoad } from './gpuLoad';

export type Intensity = 'low' | 'medium' | 'high';

interface IntensityProfile {
  workerFraction: number;
  duty: number;
  gpu: number;
}

const PROFILES: Record<Intensity, IntensityProfile> = {
  low:    { workerFraction: 0.35, duty: 0.45, gpu: 0.25 },
  medium: { workerFraction: 0.6,  duty: 0.70, gpu: 0.55 },
  high:   { workerFraction: 1,    duty: 1.0,  gpu: 1.0  },
};

/**
 * Worker source embedded as a string so it can be turned into a Blob URL.
 * This avoids the `type: 'module'` limitation that silently fails on
 * Android WebView (Capacitor) and older browsers.
 */
const CPU_WORKER_SRC = `
var running = false;
var dutyCycle = 0.5;
var PERIOD_MS = 50;

function burn(ms) {
  var end = performance.now() + ms;
  var x = 0.5;
  while (performance.now() < end) {
    for (var i = 0; i < 12000; i++) {
      x = Math.sin(x * 2.1 + 0.3) * Math.cos(x * 1.7 + 0.5) + Math.sqrt(Math.abs(x * 3.1) + 0.001);
      x = Math.tan(x * 0.7 + 0.1) * Math.sin(x + 1.2) + Math.cos(x * 2.3);
      x = (x * 16807) % 2147483647;
      if (x === 0) x = 0.5;
    }
  }
  return x;
}

function loop() {
  if (!running) return;
  var busyMs = PERIOD_MS * dutyCycle;
  burn(busyMs);
  var idleMs = Math.max(0, PERIOD_MS - busyMs);
  setTimeout(loop, idleMs);
}

self.onmessage = function(e) {
  var msg = e.data;
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
`;

function createWorker(): Worker {
  const blob = new Blob([CPU_WORKER_SRC], { type: 'application/javascript' });
  const url  = URL.createObjectURL(blob);
  const w    = new Worker(url);
  URL.revokeObjectURL(url); // safe to revoke after Worker is created
  return w;
}

export function workerCountFor(intensity: Intensity): number {
  const cores = Math.max(2, navigator.hardwareConcurrency || 4);
  return Math.max(1, Math.round(cores * PROFILES[intensity].workerFraction));
}

export class HeatEngine {
  private workers: Worker[] = [];
  private gpu = new GpuLoad();
  private _running = false;
  private _intensity: Intensity = 'medium';

  get running()    { return this._running; }
  get intensity()  { return this._intensity; }

  start(intensity: Intensity) {
    this.stop();
    this._intensity = intensity;
    const profile = PROFILES[intensity];
    const count   = workerCountFor(intensity);
    for (let i = 0; i < count; i++) {
      const w = createWorker();
      w.postMessage({ type: 'start', duty: profile.duty });
      this.workers.push(w);
    }
    this.gpu.begin(profile.gpu);
    this._running = true;
  }

  setIntensity(intensity: Intensity) {
    if (!this._running) { this._intensity = intensity; return; }
    this.start(intensity);
  }

  stop() {
    for (const w of this.workers) {
      w.postMessage({ type: 'stop' });
      w.terminate();
    }
    this.workers = [];
    this.gpu.stop();
    this._running = false;
  }
}
