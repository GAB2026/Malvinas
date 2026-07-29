import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HeatEngine,
  workerCountFor,
  type Intensity,
} from '@/lib/heat/heatEngine';
import { readDeviceTemp } from '@/lib/thermal';
import type { CalibrationResult } from './useCalibration';

export type { Intensity } from '@/lib/heat/heatEngine';

export const LOW_BATTERY_CUTOFF = 0.15;

export type StopReason =
  | 'user'
  | 'time-limit'
  | 'low-battery'
  | 'tab-hidden'
  | null;

export type Phase = 'idle' | 'warming' | 'therapeutic' | 'cooling';

interface BatteryManagerLike extends EventTarget {
  level: number;
  charging: boolean;
}

// ── Simulated heat ramp (visual only) ────────────────────────────────────────
const AMBIENT_C = 34;
const MAX_DELTA_C: Record<Intensity, number> = { low: 5, medium: 8, high: 16 };
const RAMP_TAU: Record<Intensity, number>    = { low: 240, medium: 150, high: 90 };
const MAX_HEAT: Record<Intensity, number>    = { low: 0.55, medium: 0.8, high: 1 };

function simulatedTemp(intensity: Intensity, elapsedSecs: number): number {
  const hl = MAX_HEAT[intensity] * (1 - Math.exp(-elapsedSecs / RAMP_TAU[intensity]));
  return AMBIENT_C + MAX_DELTA_C[intensity] * (hl / MAX_HEAT[intensity]);
}

/**
 * Minimum °C rise above ambient required to leave the warming phase.
 * Used only when a real thermal sensor is available.
 */
const WARMUP_DELTA_C: Record<Intensity, number> = { low: 3, medium: 5, high: 7 };

/**
 * Maximum warmup duration (seconds) before forcing transition regardless of
 * sensor reading.  Also the sole gate when no real sensor is available.
 */
const MAX_WARMUP_SECS: Record<Intensity, number> = {
  low:    12 * 60,  // 12 min
  medium:  8 * 60,  //  8 min
  high:    5 * 60,  //  5 min
};

// ── Hook interface ─────────────────────────────────────────────────────────────
export interface WarmSession {
  running: boolean;
  intensity: Intensity;
  setIntensity: (i: Intensity) => void;
  start: () => void;
  stop: () => void;
  phase: Phase;
  elapsed: number;
  therapeuticElapsed: number;
  therapeuticRemaining: number;
  /** Displayed temperature in °C — real sensor when available, else simulated. */
  deviceTempC: number;
  /** 0..1 heat ramp for visual effects (simulated model). */
  heatLevel: number;
  stopReason: StopReason;
  wakeLockActive: boolean;
  batteryLevel: number | null;
  workerCount: number;
  /** Whether button is locked while device cools back to ambient. */
  coolingDown: boolean;
}

// ── Implementation ─────────────────────────────────────────────────────────────
export function useWarmSession(calibration: CalibrationResult | null): WarmSession {
  const engineRef = useRef<HeatEngine | null>(null);
  if (!engineRef.current) engineRef.current = new HeatEngine();

  const [running, setRunning]               = useState(false);
  const [intensity, setIntensityState]      = useState<Intensity>('medium');
  const [elapsed, setElapsed]               = useState(0);
  const [therapeuticElapsed, setTherapElapsed] = useState(0);
  const [phase, setPhase]                   = useState<Phase>('idle');
  const [stopReason, setStopReason]         = useState<StopReason>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [batteryLevel, setBatteryLevel]     = useState<number | null>(null);
  const [thermalC, setThermalC]             = useState<number | null>(null);
  const [coolingDown, setCoolingDown]       = useState(false);

  const wakeLockRef     = useRef<{ release: () => Promise<void> } | null>(null);
  const startedAtRef    = useRef(0);
  const therapStartRef  = useRef<number | null>(null);
  const runningRef      = useRef(false);
  const intensityRef    = useRef<Intensity>('medium');
  const phaseRef        = useRef<Phase>('idle');
  const coolingRef      = useRef(false);
  // Mirror of thermalC state as a ref so the interval callback always reads
  // the latest value without a stale closure.
  const thermalCRef        = useRef<number | null>(null);
  const tempReadInFlightRef = useRef(false);
  // Baseline temperature recorded at session start (first real reading).
  // Delta is measured from HERE, not from calibration's ambientC, so a
  // phone that's already warm doesn't skip the warming phase instantly.
  const warmingBaselineRef = useRef<number | null>(null);

  const ambientC = calibration?.ambientC ?? AMBIENT_C;

  /** Session max in seconds for the current intensity from calibration. */
  const sessionMaxSecs = useCallback((i: Intensity): number => {
    if (!calibration) return 15 * 60;
    const m = i === 'high' ? calibration.highMinutes
            : i === 'medium' ? calibration.mediumMinutes
            : calibration.lowMinutes;
    return m * 60;
  }, [calibration]);


  const releaseWakeLock = useCallback(async () => {
    try { await wakeLockRef.current?.release(); } catch { /* ignore */ }
    wakeLockRef.current = null;
    setWakeLockActive(false);
  }, []);

  const stopWith = useCallback((reason: StopReason) => {
    engineRef.current?.stop();
    runningRef.current = false;
    phaseRef.current = 'idle';
    therapStartRef.current = null;
    setRunning(false);
    setPhase('idle');
    setStopReason(reason);
    void releaseWakeLock();
    // Start cooldown if we have real thermal data
    if (calibration?.usingRealSensor) {
      coolingRef.current = true;
      setCoolingDown(true);
    }
  }, [releaseWakeLock, calibration]);

  const acquireWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<unknown> } };
      if (nav.wakeLock) {
        const lock = await nav.wakeLock.request('screen');
        wakeLockRef.current = lock as { release: () => Promise<void> };
        setWakeLockActive(true);
        (lock as EventTarget).addEventListener?.('release', () => setWakeLockActive(false));
      }
    } catch { setWakeLockActive(false); }
  }, []);

  const start = useCallback(() => {
    if (runningRef.current || coolingRef.current) return;
    engineRef.current!.start(intensityRef.current);
    const now = Date.now();
    startedAtRef.current = now;
    therapStartRef.current = null;
    warmingBaselineRef.current = null;
    tempReadInFlightRef.current = false; // reset any stale in-flight flag
    runningRef.current = true;
    phaseRef.current = 'warming';
    setElapsed(0);
    setTherapElapsed(0);
    setPhase('warming');
    setStopReason(null);
    setRunning(true);
    void acquireWakeLock();
  }, [acquireWakeLock]);

  const stop = useCallback(() => stopWith('user'), [stopWith]);

  const setIntensity = useCallback((i: Intensity) => {
    intensityRef.current = i;
    setIntensityState(i);
    if (runningRef.current) engineRef.current!.setIntensity(i);
  }, []);

  // ── Main tick ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const id = setInterval(async () => {
      const now  = Date.now();
      const secs = Math.floor((now - startedAtRef.current) / 1000);
      setElapsed(secs);

      // Warming → therapeutic transition (run BEFORE async calls)
      if (phaseRef.current === 'warming') {
        const intensity = intensityRef.current;
        const currentC  = thermalCRef.current;

        // Build baseline as the rolling MAX seen in the first SETTLE_SECS.
        // A stale sensor often returns a cold value first, then the real
        // (post-calibration) hot value a second later. Taking the max ensures
        // the baseline reflects the true starting temperature, so the gate
        // requires a genuine rise above it — not just a stale→real jump.
        const SETTLE_SECS = 45;
        if (currentC !== null && secs <= SETTLE_SECS) {
          if (warmingBaselineRef.current === null || currentC > warmingBaselineRef.current) {
            warmingBaselineRef.current = currentC;
          }
        }

        const timedOut    = secs >= MAX_WARMUP_SECS[intensity];
        // Don't gate on temperature until the baseline has had time to settle.
        const minTimeDone = secs > SETTLE_SECS;
        const baseline    = warmingBaselineRef.current;
        const targetC     = (baseline ?? ambientC) + WARMUP_DELTA_C[intensity];
        const tempReached = minTimeDone && currentC !== null && baseline !== null && currentC >= targetC;

        if (tempReached || timedOut) {
          therapStartRef.current = now;
          phaseRef.current = 'therapeutic';
          setPhase('therapeutic');
        }
      }

      if (phaseRef.current === 'therapeutic' && therapStartRef.current) {
        const tSecs = Math.floor((now - therapStartRef.current) / 1000);
        setTherapElapsed(tSecs);
        if (tSecs >= sessionMaxSecs(intensityRef.current)) {
          stopWith('time-limit');
          return;
        }
      }

      // Real thermal read — one call at a time, 8 s timeout max.
      // Without this guard, slow sensors accumulate concurrent calls whose
      // late-resolving values corrupt the warming baseline.
      if (!tempReadInFlightRef.current) {
        tempReadInFlightRef.current = true;
        const timedRead = Promise.race([
          readDeviceTemp(),
          new Promise<null>(r => setTimeout(() => r(null), 8000)),
        ]);
        timedRead.then(real => {
          if (real !== null) {
            thermalCRef.current = real;
            setThermalC(real);
          }
          tempReadInFlightRef.current = false;
        }).catch(() => { tempReadInFlightRef.current = false; });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, stopWith, sessionMaxSecs]);

  // ── Cooldown poll — unlock button when device returns to ambient ────────────
  useEffect(() => {
    if (!coolingDown) return;
    const id = setInterval(async () => {
      const temp = await readDeviceTemp();
      if (temp === null || temp <= ambientC + 3) {
        coolingRef.current = false;
        setCoolingDown(false);
        clearInterval(id);
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [coolingDown, ambientC]);

  // ── Visibility guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && runningRef.current) stopWith('tab-hidden');
      else if (!document.hidden && runningRef.current && phaseRef.current === 'therapeutic' && therapStartRef.current) {
        const tSecs = Math.floor((Date.now() - therapStartRef.current) / 1000);
        if (tSecs >= sessionMaxSecs(intensityRef.current)) stopWith('time-limit');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [stopWith, sessionMaxSecs]);

  // ── Battery ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let battery: BatteryManagerLike | null = null;
    const onLevel = () => {
      if (!battery) return;
      setBatteryLevel(battery.level);
      if (runningRef.current && !battery.charging && battery.level <= LOW_BATTERY_CUTOFF)
        stopWith('low-battery');
    };
    (navigator as any).getBattery?.().then((b: BatteryManagerLike) => {
      battery = b; onLevel();
      b.addEventListener('levelchange', onLevel);
      b.addEventListener('chargingchange', onLevel);
    });
    return () => {
      battery?.removeEventListener('levelchange', onLevel);
      battery?.removeEventListener('chargingchange', onLevel);
    };
  }, [stopWith]);

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const engine = engineRef.current;
    return () => { engine?.stop(); void wakeLockRef.current?.release()?.catch(() => {}); };
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────────
  const maxHeat  = MAX_HEAT[intensity];
  const tau      = RAMP_TAU[intensity];
  const heatLevel = running ? maxHeat * (1 - Math.exp(-elapsed / tau)) : 0;
  const simTemp   = running ? simulatedTemp(intensity, elapsed) : ambientC;
  const deviceTempC = thermalC ?? simTemp;

  const therapLimit = sessionMaxSecs(intensity);
  const therapeuticRemaining = phase === 'therapeutic'
    ? Math.max(0, therapLimit - therapeuticElapsed) : 0;

  return {
    running, intensity, setIntensity, start, stop,
    phase, elapsed, therapeuticElapsed, therapeuticRemaining,
    deviceTempC, heatLevel, stopReason, wakeLockActive, batteryLevel,
    workerCount: workerCountFor(intensity),
    coolingDown,
  };
}
