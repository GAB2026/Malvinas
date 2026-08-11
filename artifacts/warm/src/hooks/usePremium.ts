/**
 * Premium management — combined locking model.
 *
 * Free tier:
 *   • 5-min button  — ONE free session, then locked
 *   • 10-min button — ONE free session, then locked
 *   • 15-min button — ONE free session, then locked
 *
 * Premium ($2.99 one-time): all buttons always unlocked.
 *
 * Lock logic:
 *   isLocked(mins) = !isPremium && usedDurations.has(mins)
 *
 * Module-level variables are the single source of truth — no stale closure,
 * no React-batching delay, no re-mount reset.
 *
 * NOTE: Uses warm_premium_v2 key to avoid stale '1' values from earlier test builds.
 *
 * TODO: replace purchase() / restore() stubs with RevenueCat SDK calls.
 *       Product ID: "warm_premium_lifetime"
 */

import { useState } from 'react';

const PREMIUM_KEY        = 'warm_premium_v2';       // v2 to avoid stale test data
const USED_DURATIONS_KEY = 'warm_used_durations_v1'; // e.g. "5"

export const PREMIUM_PRODUCT_ID = 'warm_premium_lifetime';

// ── Module-level state ────────────────────────────────────────────────────────
// These survive all re-renders and re-mounts within the same JS page-load.
// isLocked() reads them directly — zero stale-closure risk.

let _isPremium = false;
const _usedDurations = new Set<number>();

(function init() {
  try { _isPremium = localStorage.getItem(PREMIUM_KEY) === '1'; } catch { /* no storage */ }
  try {
    const raw = localStorage.getItem(USED_DURATIONS_KEY) ?? '';
    raw.split(',').map(Number).filter(n => n > 0 && n < 100)
       .forEach(n => _usedDurations.add(n));
  } catch { /* no storage */ }
})();

// ── Persistence ───────────────────────────────────────────────────────────────

function persistUsed(): void {
  try {
    localStorage.setItem(USED_DURATIONS_KEY, [..._usedDurations].join(','));
  } catch { /* storage quota / unavailable */ }
}

// ── Hook interface ────────────────────────────────────────────────────────────

export interface PremiumHook {
  isPremium: boolean;
  usedDurations: ReadonlySet<number>;
  /** Returns true when the button should show a lock (free use already consumed). */
  isLocked: (mins: number) => boolean;
  /** Consume the one free use for this duration. No-op if premium or already consumed. */
  consumeDuration: (mins: number) => void;
  purchase: () => Promise<boolean>;
  restore:  () => Promise<boolean>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePremium(): PremiumHook {
  // tick drives re-renders only — all data lives in module-level variables.
  const [, setTick] = useState(0);
  const forceUpdate = () => setTick(t => t + 1);

  const isLocked = (mins: number): boolean =>
    !_isPremium && _usedDurations.has(mins);

  const consumeDuration = (mins: number): void => {
    if (_isPremium || _usedDurations.has(mins)) return;
    _usedDurations.add(mins);
    persistUsed();
    forceUpdate();
  };

  const purchase = async (): Promise<boolean> => {
    _isPremium = true;
    try { localStorage.setItem(PREMIUM_KEY, '1'); } catch { /* ignore */ }
    forceUpdate();
    return true;
  };

  const restore = async (): Promise<boolean> => {
    try { _isPremium = localStorage.getItem(PREMIUM_KEY) === '1'; } catch { /* ignore */ }
    forceUpdate();
    return _isPremium;
  };

  return {
    isPremium:     _isPremium,
    usedDurations: _usedDurations,
    isLocked,
    consumeDuration,
    purchase,
    restore,
  };
}

/** Exposed only for unit tests — resets module-level state. */
export function __resetForTests(): void {
  _isPremium = false;
  _usedDurations.clear();
}
