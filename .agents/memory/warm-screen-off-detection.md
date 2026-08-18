---
name: Warm screen-off vs background detection
description: How to distinguish power-button screen-off from true app backgrounding in MainActivity, and why native-pause must live in onStop not onPause.
---

## The rule
- **Power button (screen off):** Android fires `onPause()` + `onResume()` only. `onStop()` is NOT called.
- **True background (home button / app switch):** Android fires `onPause()` → `onStop()` → `onStart()` → `onResume()`.

## Critical: why native-pause must NOT go in onPause()
`super.onPause()` calls `bridge.handleOnPause()` → `webView.onPause()` → **PauseTimers()** — this freezes JS timer execution. Any `evaluateJavascript()` queued after this (via `webView.post()`) only runs after `onResume()` re-enables timers via `ResumeTimers()`. This means `native-pause` would fire **after** the user is already looking at the screen — stopping the session too late and causing blank screen / flicker.

## Correct placement
- `native-pause` → fire in **`onStop()`** only. By the time `onStop()` runs, the WebView's JS engine is still active (PauseTimers doesn't block `evaluateJavascript` at the stop stage). The process isn't killed until after `onStop()` returns.
- Screen-off (`onPause` without `onStop`): do nothing extra — the session continues running in JS, which is correct (user may be leaving phone on charger).

## WebView reload guard
Track `private boolean appWasStopped = false`. Set `true` in `onStop()`. In `onResume()`, skip any reload logic if `!appWasStopped`. Reset to `false` after reading. For true background return: only reload if URL is null/blank — no timed JS probe (it caused flicker).

**Why:** The WebView is healthy after screen-off; only consider reload when the process may have been killed (true background = onStop fired). The timed evaluateJavascript probe was removed because the callback returning null during normal transitions triggered false reloads.

## Relevant file
`artifacts/warm/android/app/src/main/java/com/funapp/warm/MainActivity.java`
