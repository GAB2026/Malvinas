import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HeatEngine,
  workerCountFor,
  type Intensity,
} from '@/lib/heat/heatEngine';

export type { Intensity } from '@/lib/heat/heatEngine';

export const SESSION_LIMIT_SECONDS = 15 * 60;
export const LOW_BATTERY_CUTOFF = 0.15;

export type StopReason =
  | 'user'
  | 'time-limit'
  | 'low-battery'
  | 'tab-hidden'
  | null;

interface BatteryManagerLike extends EventTarget {
  level: number;
  charging: boolean;
}

export interface WarmSession {
  running: boolean;
  intensity: Intensity;
  setIntensity: (i: Intensity) => void;
  start: () => void;
  stop: () => void;
  /** seconds since session start */
  elapsed: number;
  /** seconds remaining before auto-stop */
  remaining: number;
  /** simulated heat level 0..1 — ramps up over time, scaled by intensity */
  heatLevel: number;
  /** why the last session ended (null while running / before first run) */
  stopReason: StopReason;
  /** whether a screen wake lock is currently held */
  wakeLockActive: boolean;
  /** battery level 0..1, or null when the Battery API is unavailable */
  batteryLevel: number | null;
  /** number of CPU workers used at the current intensity */
  workerCount: number;
}

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

export function useWarmSession(): WarmSession {
  const engineRef = useRef<HeatEngine | null>(null);
  if (!engineRef.current) engineRef.current = new HeatEngine();

  const [running, setRunning] = useState(false);
  const [intensity, setIntensityState] = useState<Intensity>('medium');
  const [elapsed, setElapsed] = useState(0);
  const [stopReason, setStopReason] = useState<StopReason>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const startedAtRef = useRef(0);
  const runningRef = useRef(false);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
    } catch {
      // ignore
    }
    wakeLockRef.current = null;
    setWakeLockActive(false);
  }, []);

  const stopWith = useCallback(
    (reason: StopReason) => {
      engineRef.current?.stop();
      runningRef.current = false;
      setRunning(false);
      setStopReason(reason);
      void releaseWakeLock();
    },
    [releaseWakeLock],
  );

  const acquireWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (t: 'screen') => Promise<any> };
      };
      if (nav.wakeLock) {
        const lock = await nav.wakeLock.request('screen');
        wakeLockRef.current = lock;
        setWakeLockActive(true);
        lock.addEventListener?.('release', () => setWakeLockActive(false));
      }
    } catch {
      setWakeLockActive(false);
    }
  }, []);

  const start = useCallback(() => {
    if (runningRef.current) return;
    engineRef.current!.start(intensity);
    startedAtRef.current = Date.now();
    runningRef.current = true;
    setElapsed(0);
    setStopReason(null);
    setRunning(true);
    void acquireWakeLock();
  }, [intensity, acquireWakeLock]);

  const stop = useCallback(() => stopWith('user'), [stopWith]);

  const setIntensity = useCallback((i: Intensity) => {
    setIntensityState(i);
    if (runningRef.current) engineRef.current!.setIntensity(i);
  }, []);

  // Timer + auto-stop at session limit.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsed(secs);
      if (secs >= SESSION_LIMIT_SECONDS) stopWith('time-limit');
    }, 1000);
    return () => clearInterval(id);
  }, [running, stopWith]);

  // Stop all load when the tab is hidden; re-acquire wake lock on return.
  // Also perform a wall-clock safety check on visibility restore: if the
  // browser throttled or dropped the setInterval while the tab was in the
  // background, the session may have exceeded SESSION_LIMIT_SECONDS without
  // the interval ever firing.  Checking Date.now() here closes that gap.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (runningRef.current) stopWith('tab-hidden');
      } else if (runningRef.current) {
        const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
        if (secs >= SESSION_LIMIT_SECONDS) stopWith('time-limit');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [stopWith]);

  // Battery monitoring + low-battery cutoff (where supported).
  useEffect(() => {
    let battery: BatteryManagerLike | null = null;
    const onLevel = () => {
      if (!battery) return;
      setBatteryLevel(battery.level);
      if (
        runningRef.current &&
        !battery.charging &&
        battery.level <= LOW_BATTERY_CUTOFF
      ) {
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

  // Clean teardown on unmount.
  useEffect(() => {
    const engine = engineRef.current;
    return () => {
      engine?.stop();
      void wakeLockRef.current?.release()?.catch(() => {});
    };
  }, []);

  const maxHeat = MAX_HEAT[intensity];
  const tau = RAMP_TAU[intensity];
  const heatLevel = running
    ? maxHeat * (1 - Math.exp(-elapsed / tau))
    : 0;

  return {
    running,
    intensity,
    setIntensity,
    start,
    stop,
    elapsed,
    remaining: Math.max(0, SESSION_LIMIT_SECONDS - elapsed),
    heatLevel,
    stopReason,
    wakeLockActive,
    batteryLevel,
    workerCount: workerCountFor(intensity),
  };
}
