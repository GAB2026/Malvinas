import { useEffect, useRef, useState } from 'react';
import { THERMAL_AVAILABLE } from '@/lib/thermal';
import type { DeviceTier } from '@/lib/heat/heatEngine';

export interface CalibrationResult {
  ambientC: number;
  thermalMaxC: number;
  highMinutes: number;
  mediumMinutes: number;
  lowMinutes: number;
  calibratedAt: number;
  usingRealSensor: boolean;
  /** Device performance tier, determined by the startup benchmark. */
  deviceTier: DeviceTier;
  /** Measured kOps/s per worker during the 3-second benchmark. */
  kOpsPerSec: number;
}

/**
 * Tier thresholds (kOps/s per single worker, FPU mode):
 *
 *  < 180  → budget   (A53/A55, software-emulated sin/cos; e.g. MT6762, SC9863A)
 *  180-399 → mid     (A55+, mid-range SoCs with partial hw transcendental)
 *  ≥ 400  → high    (A77+, Snapdragon 865+, full hardware FPU)
 *
 * When kOps/s is low (budget/mid), the engine switches workers to FMLA mode
 * which uses hardware multiply-accumulate — a net win in heat/cycle vs
 * software-emulated transcendentals.
 */
const TIER_THRESHOLDS = { high: 400, mid: 180 } as const;

function kOpsToTier(kOps: number): DeviceTier {
  if (kOps >= TIER_THRESHOLDS.high) return 'high';
  if (kOps >= TIER_THRESHOLDS.mid)  return 'mid';
  return 'budget';
}

const BASE_RESULT: Omit<CalibrationResult, 'deviceTier' | 'kOpsPerSec'> = {
  ambientC:        34,
  thermalMaxC:     90,
  highMinutes:     15,
  mediumMinutes:   20,
  lowMinutes:      35,
  calibratedAt:    0,
  usingRealSensor: THERMAL_AVAILABLE,
};

/**
 * Run a 3-second single-worker benchmark in the background.
 * Resolves with measured kOps/s per worker.
 * Returns 0 on any error (engine falls back to 'high' tier safely).
 */
function runBenchmark(): Promise<number> {
  return new Promise(resolve => {
    let worker: Worker | null = null;
    let totalIters = 0;
    const START_MS = performance.now();
    const DURATION_MS = 3000;

    const finish = () => {
      worker?.terminate();
      worker = null;
      const elapsed = performance.now() - START_MS;
      // iters × 10 000 ops / elapsed_ms = kOps/s
      const kOps = elapsed > 0 ? Math.round(totalIters * 10_000 / elapsed) : 0;
      resolve(kOps);
    };

    try {
      worker = new Worker(
        new URL('../lib/heat/cpuWorker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.onmessage = (e: MessageEvent) => {
        if (e.data?.type === 'heartbeat') {
          totalIters += e.data.iters ?? 0;
        }
        if (performance.now() - START_MS >= DURATION_MS) finish();
      };
      worker.onerror = () => resolve(0);
      worker.postMessage({ type: 'start', duty: 1.0, computeMode: 'fpu' });
      // Hard timeout in case postMessage callbacks stall
      setTimeout(finish, DURATION_MS + 500);
    } catch {
      resolve(0);
    }
  });
}

export function useCalibration() {
  const benchmarkRan = useRef(false);
  const [result, setResult] = useState<CalibrationResult>({
    ...BASE_RESULT,
    calibratedAt: Date.now(),
    deviceTier: 'high', // optimistic default; updated after benchmark
    kOpsPerSec: 0,
  });

  useEffect(() => {
    if (benchmarkRan.current) return;
    benchmarkRan.current = true;

    // Defer benchmark by 1 frame so the first paint completes first
    requestAnimationFrame(() => {
      runBenchmark().then(kOps => {
        const tier = kOpsToTier(kOps);
        setResult(prev => ({
          ...prev,
          calibratedAt: Date.now(),
          deviceTier: tier,
          kOpsPerSec: kOps,
        }));
      });
    });
  }, []);

  return {
    result,
    calibrating: false,
    progress: 1,
    runCalibration: async () => {},
    reset: () => {},
  };
}
