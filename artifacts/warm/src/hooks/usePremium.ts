/**
 * Premium + per-duration trial management.
 *
 * Free tier:
 *   Each duration (5 / 10 / 15 min) may be used ONCE for free.
 *   Once all three have been used, premium is required to continue.
 *
 * Premium ($2.99 one-time): unlimited sessions, all durations.
 *
 * TODO (Play Store): replace purchase() / restore() bodies with
 * RevenueCat or @capacitor-community/in-app-purchases calls.
 * Product ID: "warm_premium_lifetime"
 */

import { useState, useCallback } from 'react';

export const PREMIUM_PRODUCT_ID = 'warm_premium_lifetime';
export const TRIAL_DURATIONS    = [5, 10, 15] as const;
type TrialDuration = typeof TRIAL_DURATIONS[number];

const PREMIUM_KEY  = 'warm_premium_v1';
const USED_KEY     = 'warm_used_durations_v1';  // e.g. "5,10"

// ── Module-level cache ────────────────────────────────────────────────────────
// Lives outside React so it is immune to component remounts and stale closures.
// Initialised once from localStorage; kept in sync on every write.

function loadUsedFromStorage(): Set<number> {
  try {
    const raw = localStorage.getItem(USED_KEY) ?? '';
    const nums = raw.split(',').map(Number).filter(
      (n): n is TrialDuration => (TRIAL_DURATIONS as readonly number[]).includes(n),
    );
    return new Set(nums);
  } catch {
    return new Set();
  }
}

function persistUsed(set: Set<number>): void {
  try { localStorage.setItem(USED_KEY, [...set].join(',')); } catch { /* ignore */ }
}

// Singleton Set — shared across all renders of usePremium
const _usedDurations: Set<number> = loadUsedFromStorage();

// ── Hook ─────────────────────────────────────────────────────────────────────
export interface PremiumHook {
  isPremium: boolean;
  /** Which duration options (minutes) have been used and are now locked. */
  usedDurations: number[];
  /** True when all three durations are used and the user is not premium. */
  allDurationsLocked: boolean;
  /** Whether a duration (minutes) is locked for a free user. */
  isDurationLocked: (mins: number) => boolean;
  /**
   * Mark a duration as consumed. Immediately updates the module cache,
   * persists to localStorage, and triggers a re-render.
   * No-op when premium or already consumed.
   */
  consumeDuration: (mins: number) => void;
  purchase: () => Promise<boolean>;
  restore:  () => Promise<boolean>;
}

export function usePremium(): PremiumHook {
  const [isPremium, setIsPremium] = useState<boolean>(() => {
    try { return localStorage.getItem(PREMIUM_KEY) === '1'; } catch { return false; }
  });

  // Tick is only for forcing re-renders after consumeDuration; the real
  // source of truth is the module-level _usedDurations Set.
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick(n => n + 1), []);

  const isDurationLocked = useCallback((mins: number): boolean => {
    if (isPremium) return false;
    return _usedDurations.has(mins);
  }, [isPremium]);

  const consumeDuration = useCallback((mins: number): void => {
    if (isPremium) return;
    if (_usedDurations.has(mins)) return;   // already consumed — nothing to do
    _usedDurations.add(mins);
    persistUsed(_usedDurations);
    forceUpdate();                          // re-render so locks appear immediately
  }, [isPremium, forceUpdate]);

  const allDurationsLocked =
    !isPremium && TRIAL_DURATIONS.every(d => _usedDurations.has(d));

  const purchase = useCallback(async (): Promise<boolean> => {
    // TODO: await Purchases.purchaseProduct({ productIdentifier: PREMIUM_PRODUCT_ID })
    try { localStorage.setItem(PREMIUM_KEY, '1'); } catch { /* ignore */ }
    setIsPremium(true);
    return true;
  }, []);

  const restore = useCallback(async (): Promise<boolean> => {
    // TODO: await Purchases.restorePurchases()
    try {
      const stored = localStorage.getItem(PREMIUM_KEY) === '1';
      setIsPremium(stored);
      return stored;
    } catch { return false; }
  }, []);

  return {
    isPremium,
    usedDurations: [..._usedDurations],
    allDurationsLocked,
    isDurationLocked,
    consumeDuration,
    purchase,
    restore,
  };
}
