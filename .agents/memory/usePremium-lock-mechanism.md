---
name: usePremium lock mechanism
description: How the duration-button lock works and the root cause of previous failures
---

## Rule — v3.33+ (combined model, confirmed correct intent)
`isLocked(mins)` = `!_isPremium && (mins > FREE_MINS || _usedDurations.has(mins))`
where `FREE_MINS = 5`.

| Button | Behavior |
|--------|----------|
| 5 min  | One free use → `consumeDuration(5)` → locks permanently |
| 10 min | Always locked from first launch (no free use) |
| 15 min | Always locked from first launch (no free use) |

**Why:** Combines v3.7's "always-locked high intensity" with v3.31's "one free use" for the 5-min button. The 10/15 lock is permanent (like v3.7's Alta), so it can't break due to stale state. The 5-min lock uses the module-level Set — no React batching risk.

**Premium key:** `warm_premium_v2` (NOT v1). The v1 key had stale `'1'` written during test builds on device, causing all locks to disappear. Never revert to v1.

**How to apply:**
```ts
const FREE_MINS = 5;
let _isPremium = false;
const _usedDurations = new Set<number>();
// init from localStorage warm_premium_v2 + warm_used_durations_v1

const isLocked = (mins: number) =>
  !_isPremium && (mins > FREE_MINS || _usedDurations.has(mins));

const consumeDuration = (mins: number) => {
  if (_isPremium || _usedDurations.has(mins) || mins > FREE_MINS) return;
  _usedDurations.add(mins);
  persistUsed();
  forceUpdate();
};
```

## Testing
`__resetForTests()` clears both `_isPremium` and `_usedDurations`.
Call with `localStorage.clear()` in `beforeEach`.
Mock's `isLocked`: `!_isPremium && (mins > 5 || _usedDurations.has(mins))`.

## Version history
- v3.7: lock on HIGH intensity (Alta). Worked.
- v3.28–v3.31: "one free use per duration" — broke on device.
- v3.32: permanent lock for 10/15, 5 always free — wrong (changed too much).
- v3.33: combined model as intended. 66 tests pass.
