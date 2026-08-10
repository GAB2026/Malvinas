---
name: usePremium lock mechanism
description: How the duration-button lock works and the critical gotcha with React state batching
---

## Rule
`consumeDuration` must use a **functional setState** (`setUsedDurations(prev => ...)`) — never create the next Set from the closed-over `usedDurations` snapshot.

**Why:** If multiple `consumeDuration` calls land in the same React render batch (or if the hook re-mounts and the closure snapshot is stale), each call reads the same `usedDurations` from its closure and the last write wins. With functional updates React chains the updaters so each one receives the result of the previous, accumulating correctly.

**How to apply:** Always write `consumeDuration` like this:
```ts
setUsedDurations(prev => {
  if (prev.has(mins)) return prev;   // idempotent
  const next = new Set(prev);
  next.add(mins);
  writeUsedDurations(next);          // persist inside updater (idempotent write)
  return next;
});
```
`isLocked(mins)` reads `usedDurations` from React state (not localStorage), so after `setUsedDurations` triggers a re-render, `isLocked` returns the correct value automatically.

## Source of truth
`usedDurations` is React state (via `useState`). localStorage is secondary persistence for app-restart recovery only. Never call `localStorage.getItem` inside `isLocked` — read from state.

## Tests
`src/hooks/__tests__/usePremium.test.ts` — 8 tests covering single use, multi-use, re-mount persistence, premium bypass. When testing multiple `consumeDuration` calls, wrap each in its own `act()` so the functional updater runs between calls.

## Root cause history
Pre-v3.30: `consumeDuration` wrote `setUsedDurations(next)` where `next` was built from the closed-over snapshot. In the real app (single call per session start) this worked fine. In tests calling it 3× in one act(), the last call won and the other two locks were lost. The functional-update form fixes both cases.
