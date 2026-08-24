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
  /** Device performance tier from the startup benchmark. */
  deviceTier: DeviceTier;
  /** Measured kOps/s per worker during the 3-second FPU benchmark. */
  kOpsPerSec: number;
}

/**
 * Tier thresholds (kOps/s per single worker, FPU mode).
 *
 * Derived from the Excel SoC analysis (12 312 known configurations):
 *
 *  ≥ 500  → flagship  (SD865 / Exynos 990 / Dimensity 9xxx — hw VFP, ~8–12 W)
 *  300–499 → high_mid (SD7xx / Exynos 1xxx — hw FPU, ~5–8 W)
 *  150–299 → mid      (SD6xx / Helio G9x — A55, libm sin/cos, ~3–5 W)
 *  < 150  → budget    (SC9863A / MT6762 — A53/A55, libm, ~1–3 W)
 *
 * "Sin clasificar" OEMs land wherever the benchmark measures them — no special
 * casing needed; the benchmark is the universal device fingerprint.
 *
 * These thresholds are deliberately conservative (real flagship chips will
 * score much higher than 500).  Adjust after gathering real-device data.
 */
const TIER_THRESHOLDS = { flagship: 500, high_mid: 300, mid: 150 } as const;

function kOpsToTier(kOps: number): DeviceTier {
  if (kOps >= TIER_THRESHOLDS.flagship) return 'flagship';
  if (kOps >= TIER_THRESHOLDS.high_mid) return 'high_mid';
  if (kOps >= TIER_THRESHOLDS.mid)      return 'mid';
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
 * Run a 3-second single-worker benchmark in the background (FPU mode).
 * Using FPU mode for the benchmark is intentional: it stress-tests the hardware
 * FPU path.  Chips where sin/cos are software-emulated score low → correctly
 * classified as mid/budget and switched to FMLA for the actual session.
 * Resolves with kOps/s; returns 0 on any error (engine defaults to flagship).
 */
function runBenchmark(): Promise<number> {
  return new Promise(resolve => {
    let worker: Worker | null = null;
    let totalIters = 0;
    const START_MS   = performance.now();
    const DURATION_MS = 3000;

    const finish = () => {
      worker?.terminate();
      worker = null;
      const elapsed = performance.now() - START_MS;
      const kOps = elapsed > 0 ? Math.round(totalIters * 10_000 / elapsed) : 0;
      resolve(kOps);
    };

    try {
      worker = new Worker(
        new URL('../lib/heat/cpuWorker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.onmessage = (e: MessageEvent) => {
        if (e.data?.type === 'heartbeat') totalIters += e.data.iters ?? 0;
        if (performance.now() - START_MS >= DURATION_MS) finish();
      };
      worker.onerror = () => resolve(0);
      worker.postMessage({ type: 'start', duty: 1.0, computeMode: 'fpu' });
      setTimeout(finish, DURATION_MS + 500); // hard safety timeout
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
    deviceTier: 'flagship', // optimistic default; updated after benchmark
    kOpsPerSec: 0,
  });

  useEffect(() => {
    if (benchmarkRan.current) return;
    benchmarkRan.current = true;

    // Defer by one frame so the first paint completes before the worker starts
    requestAnimationFrame(() => {
      runBenchmark().then(kOps => {
        setResult(prev => ({
          ...prev,
          calibratedAt: Date.now(),
          deviceTier: kOpsToTier(kOps),
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
