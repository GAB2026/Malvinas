---
name: usePremium lock mechanism
description: How the duration-button lock works — final confirmed model
---

## Rule — v3.34+ (confirmed working)
`isLocked(mins)` = `!_isPremium && _usedDurations.has(mins)`

All three buttons (5, 10, 15 min) follow the same model:
- Start unlocked (free to use once)
- After one session: `consumeDuration(mins)` → `_usedDurations.add(mins)` → button locks
- Locks permanently until purchase

**Why:** Module-level Set survives all React re-renders and re-mounts.
`isLocked()` reads it directly — zero stale-closure or batching risk.
v3.33 confirmed working on real device.

**Premium key:** `warm_premium_v2` (NOT v1). The v1 key had stale `'1'` from
test builds on device, causing all locks to disappear. Never revert to v1.

**How to apply:**
```ts
const PREMIUM_KEY        = 'warm_premium_v2';
const USED_DURATIONS_KEY = 'warm_used_durations_v1';

let _isPremium = false;
const _usedDurations = new Set<number>();
// init both from localStorage in IIFE at module load

const isLocked = (mins: number) => !_isPremium && _usedDurations.has(mins);

const consumeDuration = (mins: number) => {
  if (_isPremium || _usedDurations.has(mins)) return;
  _usedDurations.add(mins);
  persistUsed();   // writes to USED_DURATIONS_KEY
  forceUpdate();   // setTick(t => t+1)
};
```

## Testing
`__resetForTests()` clears `_isPremium` and `_usedDurations`.
Call with `localStorage.clear()` in `beforeEach`.

## Version history
- v3.7: lock on HIGH intensity (Alta). Worked. Used isPremium from localStorage.
- v3.28–v3.31: "one free use per duration" — broke on device (stale premium key).
- v3.32: permanent lock for 10/15 — wrong model.
- v3.33: combined (10/15 always locked, 5 one free) — confirmed working on device.
- v3.34: all three buttons equal (one free use each). Same mechanism as v3.33.
