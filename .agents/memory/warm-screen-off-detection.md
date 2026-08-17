---
name: Warm screen-off vs background detection
description: How to distinguish power-button screen-off from true app backgrounding in MainActivity, and why it matters for WebView reload logic.
---

## The rule
- **Power button (screen off):** Android fires `onPause()` + `onResume()` only. `onStop()` is NOT called.
- **True background (user switches apps / home button):** Android fires `onPause()` → `onStop()` → `onStart()` → `onResume()`.

## Why it matters
`onResume()` runs a WebView renderer probe with a timeout. If the probe times out (normal after screen-off), it calls `webView.loadUrl()` which wipes the page — causing blank screen / flicker.

## How to apply
Track `private boolean appWasStopped = false` in `MainActivity.java`. Set it `true` in `onStop()`. In `onResume()`, skip the renderer probe if `!appWasStopped`; reset the flag to `false` after reading it.

**Why:** The WebView is still healthy after a screen-off; only probe/reload when the process may have been killed (true background = onStop fired).

## Relevant file
`artifacts/warm/android/app/src/main/java/com/funapp/warm/MainActivity.java`
