---
name: Warm screen-off vs background detection
description: Definitive fix for screen-off GPU corruption + how native-pause is fired correctly for each case.
---

## The fundamental constraints

1. **GPU texture loss**: Hardware-accelerated WebViews on Samsung/OEM devices lose GPU textures during screen-off/on cycles, producing colored fragment artifacts (green/red gradients).

2. **LAYER_TYPE_SOFTWARE must NOT be applied globally**. It disables GPU compositing for all Framer Motion animations and CSS keyframe animations. Combined with active Web Workers burning CPU, this causes:
   - CSS keyframe animations (flame-outer, flame-inner, etc.) run on the CPU/main thread → stutter, visible "size alternation" as heatLevel updates every second
   - Framer Motion animations lose hardware acceleration → janky/unstable
   - Web Workers compete with software-rendering main thread → main thread starved → app appears frozen after background

3. **The correct approach: DYNAMIC layer switching**
   - Default: `LAYER_TYPE_HARDWARE` (normal GPU rendering)
   - `ACTION_SCREEN_OFF`: switch to `LAYER_TYPE_SOFTWARE` — releases GPU texture cleanly
   - `onResume()` (screen-off return): show overlay → fire native-pause → switch back to `LAYER_TYPE_HARDWARE` (GPU creates fresh texture from software bitmap, overlay hides the 1-2 warmup frames) → hide overlay after 500ms

4. **Direct evaluateJavascript in onStop() (not via webView.post())**. `webView.post()` enqueues on the message queue; with heavy CPU load (workers + rendering), the Runnable can be delayed. Call `evaluateJavascript` directly in `onStop()` — it's already on the main thread, and `dispatchEvent()` is synchronous so `stopWith()` executes inline.

## Lifecycle rules
- **Screen-off (power button):** `ACTION_SCREEN_OFF` → `onPause()` → `onResume()`. `onStop()` is NOT called.
- **True background (home/app switch):** `onPause()` → `onStop()` → `onStart()` → `onResume()`.
- **PauseTimers()**: called inside `super.onPause()` → `webView.onPause()`. Pauses setTimeout/setInterval but does NOT block `evaluateJavascript()` + synchronous `dispatchEvent()`.

## Definitive implementation (v3.60)

### onCreate()
No `setLayerType()` call — keep hardware acceleration.

### ACTION_SCREEN_OFF (BroadcastReceiver)
```java
screenOffPending = true;
if (bridge != null) {
    WebView wv = bridge.getWebView();
    if (wv != null) wv.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
}
```

### onPause()
Nothing.

### onStop()
```java
appWasStopped = true;
// Direct call, no webView.post():
webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('native-pause'));", null);
```

### onResume()
- `screenOffPending=true`:
  1. Show overlay
  2. `evaluateJavascript("native-pause")` (JS active after ResumeTimers())
  3. `webView.setLayerType(LAYER_TYPE_HARDWARE, null)` — fresh GPU texture under overlay
  4. `postDelayed(hideOverlay, 500)`
- `appWasStopped=true`:
  1. Fire `evaluateJavascript("native-pause")` as safety net
  2. Only `showOverlayAndReload()` if URL is null/blank (renderer killed)
- Neither: billing dialog → no action.

## Button rendering
Duration buttons: `transition-colors` (NOT `transition-all`). Lock icon at `size={30}`, Premium label at `text-xs` — proportional to button height when flex-stretch equalizes row.

## What NOT to do
- Do NOT set `LAYER_TYPE_SOFTWARE` globally in `onCreate()` — breaks all animations.
- Do NOT use `webView.post()` for `evaluateJavascript()` in `onStop()` under load.
- Do NOT call `evaluateJavascript()` in `onPause()`.
- Do NOT use `transition-all` on duration buttons.

## Relevant files
- `artifacts/warm/android/app/src/main/java/com/funapp/warm/MainActivity.java`
- `artifacts/warm/src/pages/Home.tsx`
