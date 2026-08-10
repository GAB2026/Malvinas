---
name: usePremium lock mechanism
description: How the duration-button lock works and the root cause of previous failures
---

## Rule — v3.32+ (the approach that works)
`isLocked(mins)` = `!_isPremium && mins > FREE_MINS` where `FREE_MINS = 5`.

- 5 min: always free (unlimited)
- 10 min: always premium-locked from first launch
- 15 min: always premium-locked from first launch

`_isPremium` is a module-level boolean, read from localStorage once at module
load via an IIFE, and never mutated during the session (only on purchase/restore).
There is NO "consume one free use" logic — the lock is permanent.

**Why:** This mirrors the v3.7 model that provably worked on device (lock appeared
on ALTA intensity). The "one free use per duration" approach (v3.28–v3.31) required
mutating state mid-session, causing stale closures and React-batching delays in
Capacitor's WebView — the lock was written but never reflected in the UI.
`isPremium` from localStorage is read-once and never changes mid-session,
so there is zero stale-closure risk.

**How to apply:**
```ts
const FREE_MINS = 5;
let _isPremium = false;
(function init() {
  try { _isPremium = localStorage.getItem(PREMIUM_KEY) === '1'; } catch {}
})();

// in usePremium():
const isLocked = (mins: number): boolean => !_isPremium && mins > FREE_MINS;
// No consumeDuration() — removed entirely
```

## UI
Locked buttons (10, 15 min) show lock icon + 'Premium' label from the very
first render — no free session needed to see the lock.
Free button (5 min) shows its number normally.

## Testing
Export `__resetForTests()` to clear `_isPremium` between unit tests.
Call `localStorage.clear()` AND `__resetForTests()` in `beforeEach`.
No `_usedDurations` Set in tests — it no longer exists.

## Version history
- v3.7: lock on HIGH intensity (Alta). Worked. Used isPremium from localStorage.
- v3.28–v3.31: "one free use per duration" — broke on device (stale state).
- v3.32: reverted to v3.7 principle, applied to duration buttons. 61 tests pass.
