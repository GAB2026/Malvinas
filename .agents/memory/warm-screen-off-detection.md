---
name: Warm screen-off vs background detection
description: Definitive fix for screen-off GPU corruption + how native-pause is fired correctly for each case.
---

## The fundamental constraints

1. **GPU texture loss**: Hardware-accelerated WebViews on Samsung/OEM devices lose GPU textures during screen-off/on cycles, producing colored fragment artifacts (green/red gradients). Fix: `webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null)` in `onCreate()`. Software rendering uses a CPU bitmap — immune to GPU texture loss. Canvas 2D thermal gradient is imperceptible overhead.

2. **evaluateJavascript is async / webView.post() is dangerous with software rendering**: With `LAYER_TYPE_SOFTWARE`, the WebView draws on the CPU/main thread. When Web Workers are actively burning CPU (heat engine), the main thread is under pressure. `webView.post()` enqueues a Runnable but it can be delayed indefinitely — workers keep running in background, saturate CPU, and on resume the main thread cannot render. Result: app appears frozen.

   **Fix**: Call `evaluateJavascript()` DIRECTLY in `onStop()` (no `post()` wrapper). It's already on the main thread. `PauseTimers()` (called by `super.onPause()`) freezes setTimeout/setInterval but does NOT block `evaluateJavascript()` itself — and `dispatchEvent()` is synchronous, so the native-pause handler executes inline.

3. **PauseTimers timing**: `PauseTimers()` is called during `super.onPause()` → `webView.onPause()`, which fires BEFORE `onStop()`. JS timers (setTimeout/setInterval) are therefore paused at `onStop()` time. However, `evaluateJavascript()` + synchronous `dispatchEvent()` still works.

## Lifecycle rules
- **Screen-off (power button):** `ACTION_SCREEN_OFF` → `onPause()` → `onResume()`. `onStop()` is NOT called.
- **True background (home/app switch):** `onPause()` → `onStop()` → `onStart()` → `onResume()`.

## Definitive implementation (v3.59)

### onCreate()
```java
webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null); // GPU artifact fix
```

### Screen-off detection
`BroadcastReceiver` for `ACTION_SCREEN_OFF` sets `screenOffPending = true`. Differentiates screen-off from billing dialog (both have `appWasStopped=false` in `onResume()`).

### onPause()
Nothing. JS not called here.

### onStop()
Set `appWasStopped = true`. Fire `native-pause` via DIRECT `evaluateJavascript()` call (NOT via `webView.post()` — causes freeze with software rendering + active workers).

### onResume()
- `screenOffPending=true`: show overlay, fire `native-pause` (JS active after `super.onResume()` → `ResumeTimers()`), hide overlay after 400ms.
- `appWasStopped=true`: fire `native-pause` again as safety net (idempotent); only call `showOverlayAndReload` if URL is null/blank (renderer was killed). With software rendering, CPU bitmap survives normal background suspension.
- Neither: billing dialog return → no action.

## Button rendering (v3.59)
Duration buttons must have `min-h-[76px]` and `transition-colors` (NOT `transition-all`). `transition-all` causes intermediate states when button content switches between number (text-3xl) and Lock icon (size-20), making the font appear to alternate sizes.

## What NOT to do
- Do NOT use `webView.post()` to call `evaluateJavascript()` in `onStop()` — causes freeze with software rendering + active workers.
- Do NOT call `evaluateJavascript()` in `onPause()` — PauseTimers may partially affect it.
- Do NOT use `transition-all` on duration buttons — content-size transitions cause visual glitches on lock/unlock.
- Do NOT use a timed JS probe in `onResume()` — false reloads.

## Relevant files
- `artifacts/warm/android/app/src/main/java/com/funapp/warm/MainActivity.java`
- `artifacts/warm/src/pages/Home.tsx`
