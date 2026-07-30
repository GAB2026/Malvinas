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
 * Data reported by each worker on every heartbeat (~every 500 ms).
 * - iters: number of completed 10 k-op FPU blocks in this burn slice.
 *   This is the valid signal for CPU throttling: if the OS suspends a
 *   worker thread, performance.now() in the worker still advances (so
 *   wall-clock burn-time is unreliable), but iters drops.
 * - checksum: opaque FP result — forces V8 to keep the computation live
 *   and confirms the computation was not dead-code-eliminated.
 */
export interface WorkerHeartbeat {
  iters: number;
  checksum: number;
}

/**
 * Workers are bundled by Vite via the import.meta.url pattern, which produces
 * a real asset URL (e.g. /warm/assets/cpuWorker-xxx.js).  This passes
 * Capacitor's Content-Security-Policy, unlike blob: URLs which are blocked.
 */
function createWorker(): Worker {
  // {type:'module'} is required: Vite bundles the worker as a real asset URL
  // that passes Capacitor's CSP. Confirmed working in v1.1.0.
  return new Worker(new URL('./cpuWorker.ts', import.meta.url), { type: 'module' });
}

export function workerCountFor(intensity: Intensity): number {
  const cores = Math.max(2, navigator.hardwareConcurrency || 4);
  // At HIGH: saturate ALL cores (performance + efficiency) by spawning cores+2.
  // Extra workers ensure the OS schedules work onto little cores too.
  if (intensity === 'high') return cores + 2;
  return Math.max(1, Math.round(cores * PROFILES[intensity].workerFraction));
}

export class HeatEngine {
  private workers: Worker[] = [];
  private gpu = new GpuLoad();
  private _running = false;
  private _intensity: Intensity = 'medium';
  private _heartbeatHandlers: Array<(hb: WorkerHeartbeat) => void> = [];

  get running()    { return this._running; }
  get intensity()  { return this._intensity; }

  /**
   * Register a callback that fires on every worker heartbeat.
   * Returns an unsubscribe function.
   */
  onHeartbeat(handler: (hb: WorkerHeartbeat) => void): () => void {
    this._heartbeatHandlers.push(handler);
    return () => {
      this._heartbeatHandlers = this._heartbeatHandlers.filter(h => h !== handler);
    };
  }

  private _dispatchHeartbeat(hb: WorkerHeartbeat) {
    for (const h of this._heartbeatHandlers) h(hb);
  }

  start(intensity: Intensity) {
    this.stop();
    this._intensity = intensity;
    const profile = PROFILES[intensity];
    const count   = workerCountFor(intensity);
    for (let i = 0; i < count; i++) {
      const w = createWorker();
      w.onmessage = (e: MessageEvent) => {
        if (e.data?.type === 'heartbeat') {
          this._dispatchHeartbeat({
            iters:    e.data.iters ?? 0,
            checksum: e.data.v     ?? 0,
          });
        }
      };
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
