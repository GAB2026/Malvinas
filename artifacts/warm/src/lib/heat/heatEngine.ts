import { GpuLoad } from './gpuLoad';

export type Intensity = 'low' | 'medium' | 'high';
export type DeviceTier = 'budget' | 'mid' | 'high';

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
 * How many extra workers to spawn beyond navigator.hardwareConcurrency
 * at HIGH intensity, per device tier.
 *
 * budget: 0 extra — over-subscribing budget chips causes more OS throttling
 *         than it adds heat.  Every core already gets one dedicated worker.
 * mid:    +1 — one extra to catch any efficiency cluster the OS may leave idle.
 * high:   +2 — flagship chips have big.LITTLE clusters; extra workers ensure
 *         the scheduler puts work on ALL physical cores.
 */
const HIGH_EXTRA: Record<DeviceTier, number> = {
  budget: 0,
  mid:    1,
  high:   2,
};

/**
 * Compute mode per device tier.
 *
 * budget/mid: 'fmla' — 8-chain float multiply-accumulate.  Generates more heat
 *   than software-emulated sin/cos/tan on Cortex-A53/A55 because FMLA is a
 *   real hardware instruction on every ARM core since Cortex-A5.
 *
 * high: 'fpu' — transcendental chains (sin/cos/tan/atan2/sqrt).  These ARE
 *   hardware on A77+ and generate the most heat per cycle on flagship chips.
 */
const COMPUTE_MODE: Record<DeviceTier, 'fpu' | 'fmla'> = {
  budget: 'fmla',
  mid:    'fmla',
  high:   'fpu',
};

/**
 * Data reported by each worker on every heartbeat (~every 500 ms).
 * - iters: number of completed 10 k-op blocks in this burn slice.
 * - checksum: opaque FP result that prevents dead-code elimination.
 */
export interface WorkerHeartbeat {
  iters: number;
  checksum: number;
}

function createWorker(): Worker {
  return new Worker(new URL('./cpuWorker.ts', import.meta.url), { type: 'module' });
}

export function workerCountFor(intensity: Intensity, tier: DeviceTier = 'high'): number {
  const cores = Math.max(2, navigator.hardwareConcurrency || 4);
  if (intensity === 'high') return cores + HIGH_EXTRA[tier];
  return Math.max(1, Math.round(cores * PROFILES[intensity].workerFraction));
}

export class HeatEngine {
  private workers: Worker[] = [];
  private gpu = new GpuLoad();
  private _running = false;
  private _intensity: Intensity = 'medium';
  private _tier: DeviceTier = 'high';
  private _heartbeatHandlers: Array<(hb: WorkerHeartbeat) => void> = [];

  // ── Burst scheduling ─────────────────────────────────────────────────────────
  private _burstRunning = false;
  private _burstHandle: ReturnType<typeof setTimeout> | null = null;

  get running()   { return this._running; }
  get intensity() { return this._intensity; }

  onHeartbeat(handler: (hb: WorkerHeartbeat) => void): () => void {
    this._heartbeatHandlers.push(handler);
    return () => {
      this._heartbeatHandlers = this._heartbeatHandlers.filter(h => h !== handler);
    };
  }

  private _dispatchHeartbeat(hb: WorkerHeartbeat) {
    for (const h of this._heartbeatHandlers) h(hb);
  }

  enableBurst() {
    if (this._burstRunning) return;
    this._burstRunning = true;
    this._burstStep(true);
  }

  disableBurst() {
    this._burstRunning = false;
    if (this._burstHandle !== null) { clearTimeout(this._burstHandle); this._burstHandle = null; }
    const duty = PROFILES[this._intensity].duty;
    for (const w of this.workers) w.postMessage({ type: 'setDuty', duty });
  }

  private _burstStep(isHigh: boolean) {
    if (!this._burstRunning || !this._running) return;
    const duty = isHigh ? 1.0 : 0.05;
    for (const w of this.workers) w.postMessage({ type: 'setDuty', duty });
    this._burstHandle = setTimeout(() => this._burstStep(!isHigh), isHigh ? 1500 : 500);
  }

  start(intensity: Intensity, tier: DeviceTier = 'high') {
    this.stop();
    this._intensity = intensity;
    this._tier = tier;
    const profile     = PROFILES[intensity];
    const count       = workerCountFor(intensity, tier);
    const computeMode = COMPUTE_MODE[tier];

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
      w.postMessage({ type: 'start', duty: profile.duty, computeMode });
      this.workers.push(w);
    }
    this.gpu.begin(profile.gpu);
    this._running = true;
  }

  setIntensity(intensity: Intensity) {
    if (!this._running) { this._intensity = intensity; return; }
    this.start(intensity, this._tier);
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
