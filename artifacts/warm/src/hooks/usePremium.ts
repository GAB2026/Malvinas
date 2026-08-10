/**
 * Premium management — one free use per duration button (5, 10, 15 min).
 *
 * Free tier:
 *   • Each duration (5 / 10 / 15 min) gets ONE free session.
 *   • After that single use the button shows a yellow lock 🔒.
 *   • Tapping a locked button opens the paywall.
 *
 * Premium ($2.99 one-time): all buttons always unlocked.
 *
 * NOTE: _usedDurations lives at module level (outside React) so it is never
 * stale inside closures and is immune to React batching quirks on Android.
 *
 * TODO (Play Store): replace purchase() / restore() bodies with
 * RevenueCat or @capacitor-community/in-app-purchases calls.
 * Product ID: "warm_premium_lifetime"
 */

import { useState, useCallback } from 'react';

const PREMIUM_KEY      = 'warm_premium_v1';
const USED_DURATIONS_KEY = 'warm_used_durations_v1'; // stored as comma-separated list e.g. "5,15"

export const PREMIUM_PRODUCT_ID = 'warm_premium_lifetime';

// ── Module-level singleton ─────────────────────────────────────────────────────
// Initialised once from localStorage on app load; mutated in-place on each use.
// Reading _usedDurations directly avoids stale closure issues on Android.

function loadUsedDurations(): Set<number> {
  try {
    const raw = localStorage.getItem(USED_DURATIONS_KEY) ?? '';
    const nums = raw.split(',').map(Number).filter(n => n > 0);
    return new Set(nums);
  } catch {
    return new Set();
  }
}

function persistUsedDurations(set: Set<number>) {
  try {
    localStorage.setItem(USED_DURATIONS_KEY, [...set].join(','));
  } catch { /* ignore */ }
}

let _usedDurations: Set<number> = loadUsedDurations();

function readPremium(): boolean {
  try { return localStorage.getItem(PREMIUM_KEY) === '1'; } catch { return false; }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export interface PremiumHook {
  isPremium: boolean;
  /** True when the free trial for this duration has been consumed and user is not premium. */
  isLocked: (mins: number) => boolean;
  /** Mark a duration's free trial as consumed. No-op when premium or already consumed. */
  consumeDuration: (mins: number) => void;
  purchase: () => Promise<boolean>;
  restore:  () => Promise<boolean>;
}

export function usePremium(): PremiumHook {
  const [isPremium, setIsPremium] = useState<boolean>(readPremium);
  // Tick is only for triggering re-renders after consumeDuration mutates the module var.
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick(n => n + 1), []);

  const isLocked = useCallback((mins: number): boolean => {
    if (isPremium) return false;
    return _usedDurations.has(mins);
  }, [isPremium]);

  const consumeDuration = useCallback((mins: number) => {
    if (isPremium || _usedDurations.has(mins)) return;
    _usedDurations.add(mins);             // mutate module var immediately
    persistUsedDurations(_usedDurations);
    forceUpdate();                        // trigger re-render so lock icon appears
  }, [isPremium, forceUpdate]);

  const purchase = useCallback(async (): Promise<boolean> => {
    // TODO: await Purchases.purchaseProduct({ productIdentifier: PREMIUM_PRODUCT_ID })
    try { localStorage.setItem(PREMIUM_KEY, '1'); } catch { /* ignore */ }
    setIsPremium(true);
    return true;
  }, []);

  const restore = useCallback(async (): Promise<boolean> => {
    // TODO: await Purchases.restorePurchases()
    const stored = readPremium();
    setIsPremium(stored);
    return stored;
  }, []);

  return { isPremium, isLocked, consumeDuration, purchase, restore };
}
