/**
 * Premium management — one free use per duration button (5, 10, 15 min).
 *
 * Architecture — module-level variables are the single source of truth:
 *   _usedDurations  A Set<number> that lives for the full JS page-load lifetime.
 *   _isPremium      Boolean, same lifetime.
 *
 *   Both are initialised once from localStorage when this module first loads.
 *   consumeDuration / purchase / restore mutate them directly, then call
 *   forceUpdate() so React re-renders the component.
 *
 *   isLocked() reads _usedDurations on every call — no stale closure, no
 *   React batching delay, no re-mount reset.
 *
 * Free tier:  each duration (5 / 10 / 15 min) gets ONE free session.
 * Premium ($2.99 one-time): all buttons always unlocked.
 *
 * TODO: replace purchase() / restore() stubs with RevenueCat SDK calls.
 *       Product ID: "warm_premium_lifetime"
 */

import { useState } from 'react';

const PREMIUM_KEY        = 'warm_premium_v1';
const USED_DURATIONS_KEY = 'warm_used_durations_v1';   // e.g. "5,10,15"

export const PREMIUM_PRODUCT_ID = 'warm_premium_lifetime';

// ── Module-level state ────────────────────────────────────────────────────────
// These survive all re-renders and re-mounts within the same JS page-load.
// They are the ONLY source of truth for isLocked().

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
  /** Returns true when the one free trial for this duration is spent and the user is not premium. */
  isLocked: (mins: number) => boolean;
  /** Consume the free trial for a duration. No-op if premium or already consumed. */
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
    forceUpdate();   // re-render so lock icon appears immediately
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
