---
name: Warm screen-off vs background detection
description: Definitive fix for screen-off blank/freeze: BroadcastReceiver shows overlay before WebView surface is paused; native-pause fires in onResume where JS is guaranteed active.
---

## The fundamental constraint
`evaluateJavascript()` is asynchronous. Even called BEFORE `super.onPause()`, it only executes after `onResume()` — because `super.onPause()` → `webView.onPause()` → `PauseTimers()` freezes all JS execution. There is NO reliable way to run JS synchronously in onPause().

## Lifecycle rules
- **Screen-off (power button):** `ACTION_SCREEN_OFF` → `onPause()` → `onResume()`. `onStop()` is NOT called.
- **True background (home/app switch):** `onPause()` → `onStop()` → `onStart()` → `onResume()`.

## Definitive fix (v3.56)

### Screen-off
1. `BroadcastReceiver` receives `ACTION_SCREEN_OFF` **before** `onPause()` fires.
2. In the receiver: show the dark overlay (`reloadOverlay`) immediately — before Android suspends the WebView surface. This prevents the white blank flash.
3. `onPause()` / `onStop()`: nothing extra (screen-off doesn't call onStop).
4. `onResume()`: `super.onResume()` re-enables JS timers via `ResumeTimers()`. NOW call `evaluateJavascript("native-pause")` — guaranteed to execute. Post `hideOverlay` after 350ms so the stopped-session UI renders before the overlay fades.

### True background
1. `onStop()`: set `appWasStopped=true`. Fire `native-pause` via `webView.post()` — JS timers are still active at `onStop()` time (PauseTimers runs during onPause, not onStop), so the script executes correctly.
2. `onResume()`: URL check if `appWasStopped`. Reload only if URL is null/blank.

### Billing dialog / other brief pauses
`appWasStopped=false` and `screenOffPending=false` → early return, no action.

## Key flags
- `private boolean appWasStopped` — set in `onStop()`, read+reset in `onResume()`
- `private boolean screenOffPending` — set in BroadcastReceiver on SCREEN_OFF, reset in `onResume()`
- `BroadcastReceiver screenStateReceiver` — registered in `onCreate()`, unregistered in `onDestroy()`

## What NOT to do
- Do NOT call `evaluateJavascript()` in `onPause()` — PauseTimers makes it fire after onResume (too late).
- Do NOT use a timed JS probe (postDelayed + evaluateJavascript) in onResume — returns null during normal transitions, causing false reloads.
- Do NOT call `webView.onResume()` inside `onPause()` — non-standard, breaks Capacitor plugin lifecycle.

## Relevant file
`artifacts/warm/android/app/src/main/java/com/funapp/warm/MainActivity.java`
