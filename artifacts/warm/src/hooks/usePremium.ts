/**
 * Premium management — intensity-style locking applied to durations.
 *
 * Free tier  : 5-minute sessions (unlimited).
 * Premium    : 10-min and 15-min sessions (always locked for non-premium users).
 *
 * This intentionally mirrors the v3.7 model where "Alta" was always locked:
 *   isLocked(mins) = !isPremium && mins > FREE_MINS
 *
 * There is NO "one free use" concept — the lock is permanent from first launch.
 * isPremium is read from localStorage once at module load and never mutates
 * during a session (until purchase/restore). This guarantees zero stale-closure
 * or React-batching issues.
 *
 * TODO: replace purchase() / restore() stubs with RevenueCat SDK calls.
 *       Product ID: "warm_premium_lifetime"
 */

import { useState } from 'react';

const PREMIUM_KEY    = 'warm_premium_v1';
export const PREMIUM_PRODUCT_ID = 'warm_premium_lifetime';

/** Sessions of this duration or shorter are always free. */
export const FREE_MINS = 5;

// ── Module-level state ────────────────────────────────────────────────────────
// Single source of truth. Lives for the full JS page-load lifetime.
// isPremium never changes mid-session — no stale-closure risk.

let _isPremium = false;

(function init() {
  try { _isPremium = localStorage.getItem(PREMIUM_KEY) === '1'; } catch { /* no storage */ }
})();

// ── Hook interface ────────────────────────────────────────────────────────────

export interface PremiumHook {
  isPremium: boolean;
  /** True when this duration requires premium and the user has not purchased. */
  isLocked: (mins: number) => boolean;
  purchase: () => Promise<boolean>;
  restore:  () => Promise<boolean>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePremium(): PremiumHook {
  // tick is only for forcing re-renders — all data lives in _isPremium.
  const [, setTick] = useState(0);
  const forceUpdate = () => setTick(t => t + 1);

  /** Returns true when the button should show a lock icon. */
  const isLocked = (mins: number): boolean => !_isPremium && mins > FREE_MINS;

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

  return { isPremium: _isPremium, isLocked, purchase, restore };
}

/** Exposed only for unit tests — resets module-level state. */
export function __resetForTests(): void {
  _isPremium = false;
}
