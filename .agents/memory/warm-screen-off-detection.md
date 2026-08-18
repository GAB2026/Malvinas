---
name: Warm screen-off vs background detection
description: Definitive fix for screen-off GPU corruption + how native-pause is fired correctly for each case.
---

## The fundamental constraints

1. **GPU texture loss**: Hardware-accelerated WebViews on Samsung/OEM devices lose GPU textures during screen-off/on cycles, producing colored fragment artifacts (green/red gradients). Fix: `webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null)` in `onCreate()`. Software rendering uses a CPU bitmap — immune to GPU texture loss. Canvas 2D thermal gradient is imperceptible overhead.

2. **evaluateJavascript is async**: Even called before `super.onPause()`, `PauseTimers()` (called by `webView.onPause()` inside `super.onPause()`) freezes JS execution. Any JS queued in `onPause()` only runs after `onResume()` — too late.

## Lifecycle rules
- **Screen-off (power button):** `ACTION_SCREEN_OFF` → `onPause()` → `onResume()`. `onStop()` is NOT called.
- **True background (home/app switch):** `onPause()` → `onStop()` → `onStart()` → `onResume()`.

## Definitive implementation (v3.58)

### onCreate()
```java
webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null); // GPU artifact fix
```

### Screen-off detection
`BroadcastReceiver` for `ACTION_SCREEN_OFF` sets `screenOffPending = true`. Differentiates screen-off from billing dialog (both have `appWasStopped=false` in `onResume()`).

### onPause()
Nothing. Calling JS here is unreliable due to PauseTimers.

### onStop()
Set `appWasStopped = true`. Fire `native-pause` via `webView.post()` — JS timers are still live at onStop time (PauseTimers runs during onPause, not onStop).

### onResume()
- `screenOffPending=true`: show overlay, fire `native-pause` (JS active after `super.onResume()` → `ResumeTimers()`), hide overlay after 400ms.
- `appWasStopped=true`: URL check, reload if null/blank.
- Neither: billing dialog return → no action.

## What NOT to do
- Do NOT call `evaluateJavascript()` in `onPause()` — PauseTimers freezes it.
- Do NOT use a timed JS probe in `onResume()` — false reloads.
- Do NOT try to show overlay from BroadcastReceiver for GPU fix — timing is unreliable; software rendering is the real fix.

## Relevant file
`artifacts/warm/android/app/src/main/java/com/funapp/warm/MainActivity.java`
