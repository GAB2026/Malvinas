/**
 * Premium + per-duration trial management.
 *
 * Free tier:
 *   • Each duration (5 / 10 / 15 min) may be used ONCE for free.
 *   • Once all three have been used, premium is required to continue.
 *
 * Premium ($2.99 one-time): unlimited sessions, all durations.
 *
 * TODO (Play Store): replace purchase() / restore() bodies with
 * RevenueCat or @capacitor-community/in-app-purchases calls.
 * Product ID: "warm_premium_lifetime"
 */

import { useState, useCallback } from 'react';

const PREMIUM_KEY       = 'warm_premium_v1';
const USED_DURATIONS_KEY = 'warm_duration_used_v1';   // comma-separated mins, e.g. "5,15"

export const PREMIUM_PRODUCT_ID = 'warm_premium_lifetime';
export const TRIAL_DURATIONS    = [5, 10, 15] as const;

// ── Storage helpers ───────────────────────────────────────────────────────────
function readPremium(): boolean {
  try { return localStorage.getItem(PREMIUM_KEY) === '1'; } catch { return false; }
}
function readUsedDurations(): number[] {
  try {
    const raw = localStorage.getItem(USED_DURATIONS_KEY) ?? '';
    return raw.split(',').map(Number).filter(n => TRIAL_DURATIONS.includes(n as typeof TRIAL_DURATIONS[number]));
  } catch { return []; }
}
function writeUsedDurations(used: number[]): void {
  try { localStorage.setItem(USED_DURATIONS_KEY, used.join(',')); } catch { /* ignore */ }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export interface PremiumHook {
  isPremium: boolean;
  /** Which duration options (in minutes) have been used and are now locked. */
  usedDurations: number[];
  /** True when all three durations have been used and the user is not premium. */
  allDurationsLocked: boolean;
  /** Whether a specific duration (minutes) is locked for a free user. */
  isDurationLocked: (mins: number) => boolean;
  /** Mark a duration as consumed. No-op when premium. Call at session start. */
  consumeDuration: (mins: number) => void;
  purchase: () => Promise<boolean>;
  restore:  () => Promise<boolean>;
}

export function usePremium(): PremiumHook {
  const [isPremium,      setIsPremium]      = useState<boolean>(readPremium);
  const [usedDurations,  setUsedDurations]  = useState<number[]>(readUsedDurations);

  const isDurationLocked = useCallback((mins: number) => {
    if (isPremium) return false;
    return usedDurations.includes(mins);
  }, [isPremium, usedDurations]);

  const allDurationsLocked = !isPremium &&
    TRIAL_DURATIONS.every(d => usedDurations.includes(d));

  const consumeDuration = useCallback((mins: number) => {
    if (isPremium) return;
    setUsedDurations(prev => {
      if (prev.includes(mins)) return prev;
      const next = [...prev, mins];
      writeUsedDurations(next);
      return next;
    });
  }, [isPremium]);

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

  return {
    isPremium, usedDurations, allDurationsLocked,
    isDurationLocked, consumeDuration, purchase, restore,
  };
}
