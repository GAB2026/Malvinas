import { THERMAL_AVAILABLE } from '@/lib/thermal';

export interface CalibrationResult {
  ambientC: number;
  thermalMaxC: number;
  highMinutes: number;
  mediumMinutes: number;
  lowMinutes: number;
  calibratedAt: number;
  usingRealSensor: boolean;
}

// Fixed defaults — no calibration run needed.
// highMinutes is ignored for HIGH intensity (useWarmSession hardcodes 15 min).
// usingRealSensor drives burst scheduling and cooling detection on Android.
const INSTANT_RESULT: CalibrationResult = {
  ambientC: 34,
  thermalMaxC: 90,
  highMinutes: 15,
  mediumMinutes: 20,
  lowMinutes: 35,
  calibratedAt: Date.now(),
  usingRealSensor: THERMAL_AVAILABLE,
};

export function useCalibration() {
  return {
    result: INSTANT_RESULT,
    calibrating: false,
    progress: 1,
    runCalibration: async () => {},
    reset: () => {},
  };
}
