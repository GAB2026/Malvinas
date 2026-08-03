import { useCallback, useEffect, useRef, useState } from 'react';
import { HeatEngine } from '@/lib/heat/heatEngine';
import { readDeviceTemp, THERMAL_AVAILABLE } from '@/lib/thermal';

const STORAGE_KEY = 'warm-calibration-v4'; // bumped → forces recalibration on v3.2 upgrade
const CALIBRATION_SECS = 60;
const SAMPLE_INTERVAL_SECS = 5;

export interface CalibrationResult {
  ambientC: number;
  thermalMaxC: number;
  highMinutes: number;
  mediumMinutes: number;
  lowMinutes: number;
  calibratedAt: number;
  usingRealSensor: boolean;
}

/** Defaults used when thermal sensor is unavailable or on web. */
const DEFAULT_RESULT: CalibrationResult = {
  ambientC: 34,
  thermalMaxC: 75,
  highMinutes: 10,
  mediumMinutes: 20,
  lowMinutes: 35,
  calibratedAt: Date.now(),
  usingRealSensor: false,
};

function load(): CalibrationResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CalibrationResult;
  } catch {
    return null;
  }
}

function save(r: CalibrationResult) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
}

function deriveMinutes(
  ambientC: number,
  thermalMaxC: number,
  riseRatePerSec: number   // °C/s measured at HIGH (100% load)
): Pick<CalibrationResult, 'highMinutes' | 'mediumMinutes' | 'lowMinutes'> {
  const delta = thermalMaxC - ambientC;

  // Relative load factors vs HIGH
  const highFactor   = 1.00;
  const mediumFactor = 0.60;
  const lowFactor    = 0.35;

  const secsFor = (targetFraction: number, loadFactor: number) =>
    (delta * targetFraction) / (riseRatePerSec * loadFactor);

  const highSecs   = secsFor(0.95, highFactor);
  const mediumSecs = secsFor(0.80, mediumFactor);
  const lowSecs    = secsFor(0.65, lowFactor);

  // Clamp to sane ranges (seconds → minutes)
  const clamp = (s: number, minM: number, maxM: number) =>
    Math.round(Math.min(Math.max(s / 60, minM), maxM));

  return {
    highMinutes:   clamp(highSecs,   8, 20),
    mediumMinutes: clamp(mediumSecs, 15, 35),
    lowMinutes:    clamp(lowSecs,   25, 50),
  };
}

export function useCalibration() {
  const [result, setResult]       = useState<CalibrationResult | null>(() => load());
  const [calibrating, setCalibrating] = useState(false);
  const [progress, setProgress]   = useState(0);   // 0..1
  const engineRef = useRef<HeatEngine | null>(null);

  const runCalibration = useCallback(async () => {
    setCalibrating(true);
    setProgress(0);

    // On web / non-native: no thermal sensor — use defaults immediately
    if (!THERMAL_AVAILABLE) {
      await new Promise(r => setTimeout(r, 400)); // brief visual feedback
      const calibrated = { ...DEFAULT_RESULT, calibratedAt: Date.now() };
      save(calibrated);
      setResult(calibrated);
      setProgress(1);
      setCalibrating(false);
      return;
    }

    // Average several cold readings BEFORE starting the engine so we capture
    // the true resting temperature rather than a leftover-heat value.
    // We poll up to 5 times over 10 s and take the MINIMUM (coldest) reading
    // to guard against a stale-hot sensor returning one warm outlier.
    const PRE_SAMPLES = 5;
    const PRE_INTERVAL_MS = 2000;
    const preReadings: number[] = [];
    for (let i = 0; i < PRE_SAMPLES; i++) {
      const t = await readDeviceTemp();
      if (t !== null) preReadings.push(t);
      await new Promise(r => setTimeout(r, PRE_INTERVAL_MS));
    }
    // Use minimum of pre-readings as ambient (eliminates stale-hot outliers).
    // Fall back to default if we got nothing.
    const ambient = preReadings.length > 0
      ? Math.min(...preReadings)
      : DEFAULT_RESULT.ambientC;

    const engine = new HeatEngine();
    engineRef.current = engine;
    engine.start('high');

    const samples: { t: number; temp: number }[] = [];
    let elapsed = 0;

    await new Promise<void>((resolve) => {
      const iv = setInterval(async () => {
        elapsed += SAMPLE_INTERVAL_SECS;
        const temp = await readDeviceTemp();
        if (temp !== null) samples.push({ t: elapsed, temp });
        setProgress(Math.min(elapsed / CALIBRATION_SECS, 1));
        if (elapsed >= CALIBRATION_SECS) {
          clearInterval(iv);
          resolve();
        }
      }, SAMPLE_INTERVAL_SECS * 1000);
    });

    engine.stop();
    engineRef.current = null;

    let calibrated: CalibrationResult;

    if (samples.length >= 3) {
      // Linear regression: temp = ambient + rate * t
      const n = samples.length;
      const sumT   = samples.reduce((a, s) => a + s.t, 0);
      const sumY   = samples.reduce((a, s) => a + s.temp, 0);
      const sumTY  = samples.reduce((a, s) => a + s.t * s.temp, 0);
      const sumT2  = samples.reduce((a, s) => a + s.t * s.t, 0);
      const rate   = (n * sumTY - sumT * sumY) / (n * sumT2 - sumT * sumT); // °C/s
      const lastTemp = samples[samples.length - 1].temp;
      // Thermal max: extrapolate ceiling; cap at 90°C (hardware safety limit)
      const thermalMaxC = Math.min(lastTemp + rate * 120, 90);

      calibrated = {
        ambientC: ambient,
        thermalMaxC,
        ...deriveMinutes(ambient, thermalMaxC, Math.max(rate, 0.02)),
        calibratedAt: Date.now(),
        usingRealSensor: true,
      };
    } else {
      // No real sensor data — use defaults but record ambient if we got it
      calibrated = { ...DEFAULT_RESULT, ambientC: ambient, calibratedAt: Date.now() };
    }

    save(calibrated);
    setResult(calibrated);
    setCalibrating(false);
    setProgress(1);
  }, []);

  // If no calibration stored and not web, start automatically
  useEffect(() => {
    if (!result && !calibrating) runCalibration();
  }, [result, calibrating, runCalibration]);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setResult(null);
    setProgress(0);
  }, []);

  return { result, calibrating, progress, runCalibration, reset };
}
