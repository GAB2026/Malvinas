---
name: usePremium lock mechanism
description: How the duration-button lock works and the root cause of previous failures
---

## Rule
`_usedDurations` MUST be a **module-level Set**, not React state. React state has
stale-closure / batching risks in Capacitor's WebView. Module-level variables survive
all re-renders and re-mounts within the same JS page-load.

**Why confirmed:** Browser screenshot with hardcoded `new Set([5])` at module level
showed the lock rendering correctly. Previous React-state approaches showed no
locks — the Set was being lost between renders/batches.

**How to apply:**
```ts
// module level — single source of truth
let _isPremium = false;
const _usedDurations = new Set<number>();

// init once from localStorage at module load
(function init() {
  try { /* read PREMIUM_KEY */ } catch {}
  try { /* read USED_DURATIONS_KEY and populate _usedDurations */ } catch {}
})();

// in usePremium():
const isLocked = (mins: number) => !_isPremium && _usedDurations.has(mins);
const consumeDuration = (mins: number) => {
  if (_isPremium || _usedDurations.has(mins)) return;
  _usedDurations.add(mins);
  persistUsed();          // localStorage for cross-restart persistence
  setTick(t => t + 1);   // force re-render only
};
```

## UI
Locked buttons show: amber/yellow border (`border-yellow-500/60 bg-yellow-950/40`),
large Lock icon (size=20), "Premium" text. The number is hidden. This is unmissable.
Previous design (13px icon at top-right corner) was too subtle.

## Testing
Export `__resetForTests()` to clear `_usedDurations` and `_isPremium` between unit
tests. Call `localStorage.clear()` AND `__resetForTests()` in `beforeEach`.
The mock in `Home.test.tsx` uses its own `const _usedDurations = new Set<number>()`
— reset with `.clear()` (not reassignment).

## Version shipped
v3.31 (versionCode 41) — module-level approach + new lock UI.
