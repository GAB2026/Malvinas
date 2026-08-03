import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HeatEngine,
  workerCountFor,
  type Intensity,
  type WorkerHeartbeat,
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
 * Minimum °C rise above the settling baseline required to leave the warming
 * phase. Lower thresholds → transition triggers as soon as genuine heating
 * is detected, rather than waiting for a large delta that may never arrive.
 */
// TEST v2.9: delta raised to 15 so target = baseline+15 ≥ 100°C — effectively
// disables the delta gate and lets the 95°C absolute/fast-track conditions
// or the 8-min timeout be the only exits from the warming phase.
const WARMUP_DELTA_C: Record<Intensity, number> = { low: 2, medium: 3, high: 4 };

/**
 * Default target temperature in °C per intensity level.
 * Derived from AMBIENT_C + WARMUP_DELTA_C.  Exported so tests can assert
 * the invariants without duplicating the arithmetic.
 */
export const TARGET_TEMP_C: Record<Intensity, number> = {
  low:    AMBIENT_C + WARMUP_DELTA_C.low,
  medium: AMBIENT_C + WARMUP_DELTA_C.medium,
  high:   AMBIENT_C + WARMUP_DELTA_C.high,
};

/**
 * Maximum warmup duration (seconds) before forcing transition regardless of
 * sensor reading.  Also the sole gate when no real sensor is available.
 */
const MAX_WARMUP_SECS: Record<Intensity, number> = {
  low:    20 * 60,  // 20 min
  medium: 12 * 60,  // 12 min
  high:    8 * 60,  //  8 min
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
  /** True when burst scheduling is active to fight CPU throttling. */
  burstActive: boolean;
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
  const [warmingBaseline, setWarmingBaseline] = useState<number | null>(null);

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

  // ── Worker throughput tracking ────────────────────────────────────────────
  // Accumulates completed 10 k-op blocks from all worker heartbeats between
  // main-thread ticks.  Reset each tick.  The iter count is the only valid
  // signal for CPU suspension: if the OS freezes a worker thread,
  // performance.now() in the worker still advances, but iter count drops.
  const hbIterAccRef      = useRef(0);     // sum of completed 10 k-op blocks
  const lastTickMsRef     = useRef<number | null>(null); // wall-clock of last tick
  // Stays false until the first heartbeat is received so that kOps/s reports
  // null ("no data yet") instead of 0 ("data received, but zero throughput").
  const hbEverReceivedRef = useRef(false);
  const [workerKOpsPerSec, setWorkerKOpsPerSec] = useState<number | null>(null);

  // ── Burst / throttle detection ────────────────────────────────────────────
  // Baseline = rolling average of kOps during first BASELINE_TICKS ticks.
  // When kOps drops below THROTTLE_RATIO × baseline for THROTTLE_COUNT
  // consecutive ticks, burst mode is enabled.  It disables when kOps
  // recovers above RECOVERY_RATIO × baseline for RECOVERY_COUNT ticks.
  const BASELINE_TICKS  = 15;   // ticks (~15 s) to establish baseline
  const THROTTLE_RATIO  = 0.65; // <65% of baseline → throttling
  const RECOVERY_RATIO  = 0.80; // >80% of baseline → recovered
  const THROTTLE_COUNT  = 3;    // consecutive ticks needed to enable burst
  const RECOVERY_COUNT  = 5;    // consecutive ticks needed to disable burst
  const baselineKOpsRef    = useRef<number | null>(null);
  const baselineSumRef     = useRef(0);
  const baselineCountRef   = useRef(0);
  const throttleCountRef   = useRef(0);
  const recoveryCountRef   = useRef(0);
  const [burstActive, setBurstActive] = useState(false);
  const burstActiveRef     = useRef(false); // mirrors state for tick closure

  const ambientC = calibration?.ambientC ?? AMBIENT_C;

  /** Session max in seconds. HIGH is always 15 min; other intensities from calibration. */
  const sessionMaxSecs = useCallback((i: Intensity): number => {
    if (i === 'high') return 15 * 60;
    if (!calibration) return 20 * 60;
    return i === 'medium' ? calibration.mediumMinutes * 60 : calibration.lowMinutes * 60;
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
    // Clear throughput metrics so overlay resets between sessions
    hbIterAccRef.current      = 0;
    lastTickMsRef.current     = null;
    hbEverReceivedRef.current = false;
    setWorkerKOpsPerSec(null);
    // Stop burst mode
    engineRef.current?.disableBurst();
    burstActiveRef.current = false;
    setBurstActive(false);
    // Reset burst/throttle detection state
    baselineKOpsRef.current  = null;
    baselineSumRef.current   = 0;
    baselineCountRef.current = 0;
    throttleCountRef.current = 0;
    recoveryCountRef.current = 0;
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
    // Update all state BEFORE touching the engine so React renders
    // "Calentando" on the very next frame. Creating N Web Workers is
    // synchronous and blocks the JS thread for several hundred ms on Android,
    // which delays every batched setState that follows it.
    const now = Date.now();
    startedAtRef.current = now;
    therapStartRef.current = null;
    warmingBaselineRef.current = null;
    setWarmingBaseline(null);
    tempReadInFlightRef.current = false; // reset any stale in-flight flag
    // Reset throughput accumulators for fresh session
    hbIterAccRef.current      = 0;
    lastTickMsRef.current     = null;
    hbEverReceivedRef.current = false;
    setWorkerKOpsPerSec(null);
    // Reset burst/throttle detection for fresh session
    baselineKOpsRef.current  = null;
    baselineSumRef.current   = 0;
    baselineCountRef.current = 0;
    throttleCountRef.current = 0;
    recoveryCountRef.current = 0;
    burstActiveRef.current   = false;
    setBurstActive(false);
    runningRef.current = true;
    phaseRef.current = 'warming';
    setElapsed(0);
    setTherapElapsed(0);
    setPhase('warming');
    setStopReason(null);
    setRunning(true);
    void acquireWakeLock();
    // Defer worker creation to after React renders the warming state.
    // Double rAF ensures the browser has painted at least one frame first.
    // Guard with runningRef so a rapid tap→stop before the frame fires
    // doesn't leave orphaned workers running.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (runningRef.current) engineRef.current!.start(intensityRef.current);
    }));
  }, [acquireWakeLock]);

  const stop = useCallback(() => stopWith('user'), [stopWith]);

  const setIntensity = useCallback((i: Intensity) => {
    intensityRef.current = i;
    setIntensityState(i);
    if (runningRef.current) engineRef.current!.setIntensity(i);
  }, []);

  // ── Worker heartbeat subscription ─────────────────────────────────────────
  // Subscribe once on mount; the callback ref stays stable across sessions.
  useEffect(() => {
    const engine = engineRef.current!;
    const unsub = engine.onHeartbeat((hb: WorkerHeartbeat) => {
      hbIterAccRef.current += hb.iters;
      hbEverReceivedRef.current = true;
    });
    return unsub;
  }, []);

  // ── Main tick ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const id = setInterval(async () => {
      const now  = Date.now();
      const secs = Math.floor((now - startedAtRef.current) / 1000);
      setElapsed(secs);

      // ── Snapshot worker throughput (accumulated since last tick) ────────
      // Use actual elapsed time between ticks rather than assuming 1000 ms;
      // setInterval is not perfectly precise and tick skew accumulates.
      // Formula: 1 iter = 10 000 FPU ops = 10 kOps
      //          kOps/s = (iters × 10) / (tickElapsedMs / 1000)
      //                 = iters × 10 000 / tickElapsedMs
      const iters = hbIterAccRef.current;
      hbIterAccRef.current = 0;
      const tickElapsedMs = lastTickMsRef.current !== null
        ? now - lastTickMsRef.current
        : 1000; // first tick: assume nominal interval
      lastTickMsRef.current = now;
      // Only publish a value after the first heartbeat so the overlay shows
      // "— (sin sesión)" rather than "0 kOps/s" while workers warm up.
      const kOps = hbEverReceivedRef.current && tickElapsedMs > 0
        ? Math.round(iters * 10_000 / tickElapsedMs)
        : null;
      setWorkerKOpsPerSec(kOps);

      // ── Burst / throttle detection (only at HIGH intensity, real sensor) ──
      if (kOps !== null && intensityRef.current === 'high' && calibration?.usingRealSensor) {
        // Build baseline during first BASELINE_TICKS ticks
        if (baselineCountRef.current < BASELINE_TICKS) {
          baselineSumRef.current  += kOps;
          baselineCountRef.current++;
          if (baselineCountRef.current === BASELINE_TICKS) {
            baselineKOpsRef.current = baselineSumRef.current / BASELINE_TICKS;
          }
        } else if (baselineKOpsRef.current !== null) {
          const baseline = baselineKOpsRef.current;
          if (!engineRef.current!.running) { /* session stopped — skip */ }
          else if (burstActiveRef.current) {
            // Check recovery
            if (kOps >= baseline * RECOVERY_RATIO) {
              recoveryCountRef.current++;
              throttleCountRef.current = 0;
              if (recoveryCountRef.current >= RECOVERY_COUNT) {
                engineRef.current!.disableBurst();
                burstActiveRef.current = false;
                setBurstActive(false);
                recoveryCountRef.current = 0;
              }
            } else {
              recoveryCountRef.current = 0;
            }
          } else {
            // Check throttling
            if (kOps < baseline * THROTTLE_RATIO) {
              throttleCountRef.current++;
              recoveryCountRef.current = 0;
              if (throttleCountRef.current >= THROTTLE_COUNT) {
                engineRef.current!.enableBurst();
                burstActiveRef.current = true;
                setBurstActive(true);
                throttleCountRef.current = 0;
              }
            } else {
              throttleCountRef.current = 0;
            }
          }
        }
      }

      // Warming → therapeutic transition (run BEFORE async calls)
      if (phaseRef.current === 'warming') {
        const intensity = intensityRef.current;

        // When a real hardware sensor is present, use its reading exclusively
        // (null while in-flight).  When no sensor exists (web env, test env),
        // fall back to the simulated model — same source already used for the
        // displayed temperature — so the transition fires on schedule instead
        // of waiting for the full MAX_WARMUP_SECS timeout.
        const hasRealSensor = !!(calibration?.usingRealSensor);
        const rawC    = thermalCRef.current;
        const currentC = rawC !== null ? rawC
          : (hasRealSensor ? null : simulatedTemp(intensity, secs));

        // Brief settle window to avoid a stale sensor triggering transition
        // immediately at session start.  After that, transition as soon as
        // the device reaches the target temperature or the timeout fires.
        const SETTLE_SECS = 10;
        const THERAPEUTIC_ABS_C = 85;
        const timedOut     = secs >= MAX_WARMUP_SECS[intensity];
        const minTimeDone  = secs > SETTLE_SECS;
        const currentlyHot = minTimeDone && currentC !== null && currentC >= THERAPEUTIC_ABS_C;

        if (currentlyHot || timedOut) {
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

  const SETTLE_SECS_CONST = 45;
    elapsed > SETTLE_SECS_CONST && warmingBaseline !== null && warmingBaseline >= 60;

  return {
    running, intensity, setIntensity, start, stop,
    phase, elapsed, therapeuticElapsed, therapeuticRemaining,
    deviceTempC, heatLevel, stopReason, wakeLockActive, batteryLevel,
    workerCount: workerCountFor(intensity),
    coolingDown, burstActive,
  };
}
