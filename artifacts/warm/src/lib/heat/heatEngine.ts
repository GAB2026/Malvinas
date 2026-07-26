import { GpuLoad } from './gpuLoad';

export type Intensity = 'low' | 'medium' | 'high';

interface IntensityProfile {
  /** number of CPU workers, relative to hardwareConcurrency */
  workerFraction: number;
  /** busy fraction of each worker's period */
  duty: number;
  /** GPU load intensity in [0,1] */
  gpu: number;
}

const PROFILES: Record<Intensity, IntensityProfile> = {
  low:    { workerFraction: 0.35, duty: 0.45, gpu: 0.25 },
  medium: { workerFraction: 0.6,  duty: 0.70, gpu: 0.55 },
  // High: full duty (no idle gap) + full GPU (two canvases at max resolution).
  high:   { workerFraction: 1,    duty: 1.0,  gpu: 1.0  },
};

export function workerCountFor(intensity: Intensity): number {
  const cores = Math.max(2, navigator.hardwareConcurrency || 4);
  return Math.max(1, Math.round(cores * PROFILES[intensity].workerFraction));
}

/**
 * HeatEngine drives sustained CPU (web worker pool) and GPU (WebGL shader)
 * load. It has no UI concerns; start/stop/setIntensity only.
 */
export class HeatEngine {
  private workers: Worker[] = [];
  private gpu = new GpuLoad();
  private _running = false;
  private _intensity: Intensity = 'medium';

  get running() {
    return this._running;
  }

  get intensity() {
    return this._intensity;
  }

  start(intensity: Intensity) {
    this.stop();
    this._intensity = intensity;
    const profile = PROFILES[intensity];
    const count = workerCountFor(intensity);
    for (let i = 0; i < count; i++) {
      const w = new Worker(new URL('./cpuWorker.ts', import.meta.url), {
        type: 'module',
      });
      w.postMessage({ type: 'start', duty: profile.duty });
      this.workers.push(w);
    }
    this.gpu.begin(profile.gpu);
    this._running = true;
  }

  setIntensity(intensity: Intensity) {
    if (!this._running) {
      this._intensity = intensity;
      return;
    }
    // Restart with the new profile (worker count changes between levels).
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
