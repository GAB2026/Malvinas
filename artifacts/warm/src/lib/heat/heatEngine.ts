import { GpuLoad } from './gpuLoad';

export type Intensity = 'low' | 'medium' | 'high';

/**
 * Device performance tier derived from the startup benchmark.
 *
 * Matches the 4-tier classification from the device Excel analysis:
 *
 *  flagship  — Snapdragon 865, Exynos 990, Dimensity 9xxx  (~8–12 W TDP)
 *               328 configs (2.7 %).  Full hardware VFP transcendentals.
 *
 *  high_mid  — Snapdragon 7xx, Exynos 1xxx                 (~5–8 W TDP)
 *               205 configs (1.7 %).  Hardware FPU but lower clock / core count.
 *
 *  mid       — Snapdragon 6xx, Helio G9x                   (~3–5 W TDP)
 *               936 configs (7.6 %).  A55 cores; sin/cos software-emulated
 *               (libm); FMLA generates more heat per cycle than emulated tan.
 *
 *  budget    — Spreadtrum SC9863A, MT6762, misc OEMs        (~1–3 W TDP)
 *               5 835 configs (47.4 %).  A53/A55 with weak FPU; FMLA is the
 *               only hardware-accelerated path for sustained heat.
 *
 * "Sin clasificar" (~40 % of the sheet) land in whichever tier the benchmark
 * measures — no special handling needed.
 */
export type DeviceTier = 'flagship' | 'high_mid' | 'mid' | 'budget';

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
 * Extra workers beyond navigator.hardwareConcurrency at HIGH intensity.
 *
 * flagship  +3: big.LITTLE clusters (4P+4E) need extra tasks to force the OS
 *               scheduler to park work on all efficiency cores too.
 * high_mid  +2: similar big.LITTLE but fewer performance cores.
 * mid       +1: one extra to catch any idle E-core.
 * budget     0: over-subscribing A53/A55 clusters triggers thermal throttling
 *               faster than it adds heat; one worker per logical core is optimal.
 */
const HIGH_EXTRA: Record<DeviceTier, number> = {
  flagship: 3,
  high_mid: 2,
  mid:      1,
  budget:   0,
};

/**
 * Compute mode per tier.
 *
 * flagship / high_mid → 'fpu': sin/cos/tan/atan2/sqrt are hardware VFP
 *   instructions on Cortex-A77+ and equivalent; they generate maximum heat.
 *
 * mid / budget → 'fmla': transcendentals are SOFTWARE-EMULATED on A55/A53
 *   (libm), so they are slow and cool.  FMLA (float multiply-accumulate) IS
 *   hardware on every ARM core since Cortex-A5; 8 independent chains keep
 *   both FPU issue slots full — net heat/cycle beats software sin/cos by 3–5×.
 */
const COMPUTE_MODE: Record<DeviceTier, 'fpu' | 'fmla'> = {
  flagship: 'fpu',
  high_mid: 'fpu',
  mid:      'fmla',
  budget:   'fmla',
};

/**
 * Data reported by each worker on every heartbeat (~every 500 ms).
 * - iters: completed 10 k-op blocks (valid throttle signal).
 * - checksum: opaque FP result that prevents dead-code elimination.
 */
export interface WorkerHeartbeat {
  iters: number;
  checksum: number;
}

function createWorker(): Worker {
  return new Worker(new URL('./cpuWorker.ts', import.meta.url), { type: 'module' });
}

export function workerCountFor(intensity: Intensity, tier: DeviceTier = 'flagship'): number {
  const cores = Math.max(2, navigator.hardwareConcurrency || 4);
  if (intensity === 'high') return cores + HIGH_EXTRA[tier];
  return Math.max(1, Math.round(cores * PROFILES[intensity].workerFraction));
}

export class HeatEngine {
  private workers: Worker[] = [];
  private gpu = new GpuLoad();
  private _running = false;
  private _intensity: Intensity = 'medium';
  private _tier: DeviceTier = 'flagship';
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

  start(intensity: Intensity, tier: DeviceTier = 'flagship') {
    this.stop();
    this._intensity = intensity;
    this._tier      = tier;
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
