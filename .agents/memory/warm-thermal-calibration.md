---
name: Warm thermal calibration
description: How the device calibration flow works and the web/native branching decision.
---

## Rule
`useCalibration.ts` checks `THERMAL_AVAILABLE` (from `src/lib/thermal.ts`) at the start of `runCalibration`. On web/non-native it saves `DEFAULT_RESULT` immediately (400ms visual delay only). The full 60-second HeatEngine sampling run only executes on real Android where the thermal plugin is available.

**Why:** Without this guard the web preview would hang on the calibration screen for 60 seconds on every cold start, with 0% progress and no sensor data — confusing during development and for testers on web.

**How to apply:** Any future change to calibration timing or defaults must preserve this branch. The `THERMAL_AVAILABLE` constant is the single source of truth; do not duplicate the `isNativePlatform()` check inline.

## Calibration result shape (`CalibrationResult`)
- `ambientC` — baseline temp at start of calibration
- `thermalMaxC` — peak temp reached during 60s HIGH run (or DEFAULT fallback 45°C)
- `highMinutes / mediumMinutes / lowMinutes` — session durations derived from rise rate
- `usingRealSensor` — false when on web or sensor read returned null
- `calibratedAt` — epoch ms; stored in `localStorage` key `warm-calibration-v2`

## Session duration binding
`useWarmSession(calibration)` now takes the `CalibrationResult | null` as its only argument. Passing `null` falls back to 15-min default for all modes. The old `sessionDurationMin` / `setSessionDuration` interface has been removed — duration is now derived from calibration, not user input.

## Cooldown lock
After a session ends on a real-sensor device (`calibration.usingRealSensor === true`), `coolingDown` stays true and the flame button is disabled until a 10-second poll confirms `thermalC <= ambientC + 3°C`. On web, cooldown is never triggered.
