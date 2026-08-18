---
name: Warm screen-off vs background detection
description: How to correctly fire native-pause on screen-off vs background, and the critical ordering rule with super.onPause().
---

## The rule
- **Power button (screen off):** Android fires `onPause()` + `onResume()` only. `onStop()` is NOT called.
- **True background (home button / app switch):** Android fires `onPause()` → `onStop()` → `onStart()` → `onResume()`.

## Critical: native-pause must fire BEFORE super.onPause()

`super.onPause()` calls `bridge.handleOnPause()` → `webView.onPause()` → **PauseTimers()** — this freezes JS timer execution. Any `evaluateJavascript()` called or queued AFTER this point only executes after `onResume()` re-enables timers. This causes the session to stop AFTER the user is already looking at the screen — showing the active session briefly then cutting to "stopped". Also causes blank/white flicker since the WebView is resumed before the JS state is correct.

**Solution:** call `webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('native-pause'));", null)` **BEFORE** `super.onPause()`. The WebView is still active at that point, JS executes immediately, session stops, and the WebView enters its paused state already showing the "stopped" UI. When the screen turns back on and `onResume()` resumes the WebView, it redraws the stopped state without any flash.

This fires for BOTH screen-off and true background — correct, because both cases should stop the session.

## WebView reload guard (onResume)
Track `private boolean appWasStopped = false`. Set `true` in `onStop()`. In `onResume()`:
- `!appWasStopped` (screen-off): re-query billing, return — no URL check needed, WebView is healthy
- `appWasStopped` (background): re-query billing, check URL (reload if null/blank), reset flag

Do NOT use a timed JS probe (evaluateJavascript with postDelayed timeout) — it caused false reloads and flicker when the callback returned null during normal transitions.

## Relevant file
`artifacts/warm/android/app/src/main/java/com/funapp/warm/MainActivity.java`
