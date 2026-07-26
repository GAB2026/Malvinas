import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HeatEngine,
  workerCountFor,
  type Intensity,
} from '@/lib/heat/heatEngine';

export type { Intensity } from '@/lib/heat/heatEngine';

export const LOW_BATTERY_CUTOFF = 0.15;

export type StopReason =
  | 'user'
  | 'time-limit'
  | 'low-battery'
  | 'tab-hidden'
  | null;

/** Phase of a running session. */
export type Phase = 'idle' | 'warming' | 'therapeutic';

/** Available therapeutic durations (minutes). */
export const THERAPEUTIC_DURATIONS = [15, 30] as const;
export type TherapeuticDuration = (typeof THERAPEUTIC_DURATIONS)[number];

interface BatteryManagerLike extends EventTarget {
  level: number;
  charging: boolean;
}

// ── Temperature model ─────────────────────────────────────────────────────────
// These are calibrated estimates; real device sensors vary but the model
// produces realistic numbers consistent with user-observed battery drain rates.
const AMBIENT_C = 34; // typical idle Android temp

const MAX_DELTA_C: Record<Intensity, number> = {
  low: 5,   // peaks at ~39 °C
  medium: 8, // peaks at ~42 °C
  high: 16,  // peaks at ~50 °C (dual GPU canvas + duty 1.0)
};

/** Target °C that triggers transition from warming → therapeutic phase. */
export const TARGET_TEMP_C: Record<Intensity, number> = {
  low: 38,
  medium: 40,
  high: 45,
};

/** Ramp constant: how quickly heatLevel approaches its max (seconds). */
const RAMP_TAU: Record<Intensity, number> = {
  low: 240,
  medium: 150,
  high: 90,
};
const MAX_HEAT: Record<Intensity, number> = {
  low: 0.55,
  medium: 0.8,
  high: 1,
};

function computeTemp(intensity: Intensity, heatLevel: number): number {
  // Normalize heatLevel to 0..1 range
  const normalized = heatLevel / MAX_HEAT[intensity];
  return AMBIENT_C + MAX_DELTA_C[intensity] * normalized;
}

// ── Hook interface ────────────────────────────────────────────────────────────
export interface WarmSession {
  running: boolean;
  intensity: Intensity;
  setIntensity: (i: Intensity) => void;
  start: () => void;
  stop: () => void;
  /** Current session phase */
  phase: Phase;
  /** Elapsed seconds since session start (both phases combined) */
  elapsed: number;
  /** Elapsed seconds in therapeutic phase only */
  therapeuticElapsed: number;
  /** Seconds remaining in therapeutic phase (0 while warming or idle) */
  therapeuticRemaining: number;
  /** Simulated device temperature in °C */
  deviceTempC: number;
  /** Simulated heat level 0..1 — ramps up over time */
  heatLevel: number;
  /** Why the last session ended */
  stopReason: StopReason;
  /** Whether a screen wake lock is held */
  wakeLockActive: boolean;
  /** Battery level 0..1, or null when unavailable */
  batteryLevel: number | null;
  /** CPU workers at current intensity */
  workerCount: number;
  /** Selected therapeutic duration in minutes */
  sessionDurationMin: TherapeuticDuration;
  setSessionDuration: (d: TherapeuticDuration) => void;
}

// ── Implementation ────────────────────────────────────────────────────────────
export function useWarmSession(): WarmSession {
  const engineRef = useRef<HeatEngine | null>(null);
  if (!engineRef.current) engineRef.current = new HeatEngine();

  const [running, setRunning] = useState(false);
  const [intensity, setIntensityState] = useState<Intensity>('medium');
  const [elapsed, setElapsed] = useState(0);
  const [therapeuticElapsed, setTherapeuticElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [stopReason, setStopReason] = useState<StopReason>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [sessionDurationMin, setSessionDurationMinState] =
    useState<TherapeuticDuration>(15);

  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const startedAtRef = useRef(0);
  const therapeuticStartedAtRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const intensityRef = useRef<Intensity>('medium');
  const phaseRef = useRef<Phase>('idle');
  const sessionDurationRef = useRef<TherapeuticDuration>(15);

  const releaseWakeLock = useCallback(async () => {
    try { await wakeLockRef.current?.release(); } catch { /* ignore */ }
    wakeLockRef.current = null;
    setWakeLockActive(false);
  }, []);

  const stopWith = useCallback(
    (reason: StopReason) => {
      engineRef.current?.stop();
      runningRef.current = false;
      phaseRef.current = 'idle';
      therapeuticStartedAtRef.current = null;
      setRunning(false);
      setPhase('idle');
      setStopReason(reason);
      void releaseWakeLock();
    },
    [releaseWakeLock],
  );

  const acquireWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (t: 'screen') => Promise<unknown> };
      };
      if (nav.wakeLock) {
        const lock = await nav.wakeLock.request('screen');
        wakeLockRef.current = lock as { release: () => Promise<void> };
        setWakeLockActive(true);
        (lock as EventTarget).addEventListener?.('release', () =>
          setWakeLockActive(false),
        );
      }
    } catch { setWakeLockActive(false); }
  }, []);

  const start = useCallback(() => {
    if (runningRef.current) return;
    engineRef.current!.start(intensity);
    const now = Date.now();
    startedAtRef.current = now;
    therapeuticStartedAtRef.current = null;
    runningRef.current = true;
    phaseRef.current = 'warming';
    setElapsed(0);
    setTherapeuticElapsed(0);
    setPhase('warming');
    setStopReason(null);
    setRunning(true);
    void acquireWakeLock();
  }, [intensity, acquireWakeLock]);

  const stop = useCallback(() => stopWith('user'), [stopWith]);

  const setIntensity = useCallback((i: Intensity) => {
    intensityRef.current = i;
    setIntensityState(i);
    if (runningRef.current) engineRef.current!.setIntensity(i);
  }, []);

  const setSessionDuration = useCallback((d: TherapeuticDuration) => {
    sessionDurationRef.current = d;
    setSessionDurationMinState(d);
  }, []);

  // ── Main tick ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const now = Date.now();
      const secs = Math.floor((now - startedAtRef.current) / 1000);
      setElapsed(secs);

      // Compute simulated temperature to decide phase transition
      const tau = RAMP_TAU[intensityRef.current];
      const maxH = MAX_HEAT[intensityRef.current];
      const hl = maxH * (1 - Math.exp(-secs / tau));
      const tempC = computeTemp(intensityRef.current, hl);

      if (
        phaseRef.current === 'warming' &&
        tempC >= TARGET_TEMP_C[intensityRef.current]
      ) {
        // Transition to therapeutic phase
        therapeuticStartedAtRef.current = now;
        phaseRef.current = 'therapeutic';
        setPhase('therapeutic');
      }

      if (phaseRef.current === 'therapeutic' && therapeuticStartedAtRef.current) {
        const tSecs = Math.floor(
          (now - therapeuticStartedAtRef.current) / 1000,
        );
        setTherapeuticElapsed(tSecs);
        const limitSecs = sessionDurationRef.current * 60;
        if (tSecs >= limitSecs) {
          stopWith('time-limit');
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, stopWith]);

  // ── Visibility / safety wall-clock check ───────────────────────────────────
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (runningRef.current) stopWith('tab-hidden');
      } else if (runningRef.current) {
        // Catch timer drift while hidden
        if (phaseRef.current === 'therapeutic' && therapeuticStartedAtRef.current) {
          const tSecs = Math.floor(
            (Date.now() - therapeuticStartedAtRef.current) / 1000,
          );
          if (tSecs >= sessionDurationRef.current * 60) stopWith('time-limit');
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [stopWith]);

  // ── Battery monitoring ─────────────────────────────────────────────────────
  useEffect(() => {
    let battery: BatteryManagerLike | null = null;
    const onLevel = () => {
      if (!battery) return;
      setBatteryLevel(battery.level);
      if (runningRef.current && !battery.charging && battery.level <= LOW_BATTERY_CUTOFF) {
        stopWith('low-battery');
      }
    };
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<BatteryManagerLike>;
    };
    nav.getBattery?.().then((b) => {
      battery = b;
      onLevel();
      b.addEventListener('levelchange', onLevel);
      b.addEventListener('chargingchange', onLevel);
    });
    return () => {
      battery?.removeEventListener('levelchange', onLevel);
      battery?.removeEventListener('chargingchange', onLevel);
    };
  }, [stopWith]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    const engine = engineRef.current;
    return () => {
      engine?.stop();
      void wakeLockRef.current?.release()?.catch(() => {});
    };
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const maxHeat = MAX_HEAT[intensity];
  const tau = RAMP_TAU[intensity];
  const heatLevel = running ? maxHeat * (1 - Math.exp(-elapsed / tau)) : 0;
  const deviceTempC = running ? computeTemp(intensity, heatLevel) : AMBIENT_C;
  const therapeuticLimitSecs = sessionDurationMin * 60;
  const therapeuticRemaining =
    phase === 'therapeutic'
      ? Math.max(0, therapeuticLimitSecs - therapeuticElapsed)
      : 0;

  return {
    running,
    intensity,
    setIntensity,
    start,
    stop,
    phase,
    elapsed,
    therapeuticElapsed,
    therapeuticRemaining,
    deviceTempC,
    heatLevel,
    stopReason,
    wakeLockActive,
    batteryLevel,
    workerCount: workerCountFor(intensity),
    sessionDurationMin,
    setSessionDuration,
  };
}
