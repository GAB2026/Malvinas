/**
 * Premium + Medium-intensity trial management.
 *
 * Free tier:
 *   • Low  — unlimited sessions
 *   • Medium — MEDIUM_TRIAL_LIMIT free sessions, then premium required
 *   • High  — always premium
 *
 * Premium ($2.99 one-time): all intensities + 30-min sessions, unlimited.
 *
 * TODO (Play Store): replace purchase() / restore() bodies with
 * RevenueCat or @capacitor-community/in-app-purchases calls.
 * Product ID: "warm_premium_lifetime"
 */

import { useState, useCallback } from 'react';

const PREMIUM_KEY      = 'warm_premium_v1';
const TRIALS_KEY       = 'warm_medium_trials_v1';

export const MEDIUM_TRIAL_LIMIT = 2;
export const PREMIUM_PRODUCT_ID = 'warm_premium_lifetime';

// ── Storage helpers ───────────────────────────────────────────────────────────
function readPremium(): boolean {
  try { return localStorage.getItem(PREMIUM_KEY) === '1'; } catch { return false; }
}
function readTrialsUsed(): number {
  try { return Math.max(0, parseInt(localStorage.getItem(TRIALS_KEY) ?? '0', 10)); }
  catch { return 0; }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export interface PremiumHook {
  isPremium: boolean;
  /** Free Medium sessions remaining (Infinity when premium). */
  mediumTrialsLeft: number;
  /** True if user may use Medium intensity (trial available or premium). */
  canUseMedium: boolean;
  /** Debit one Medium trial. No-op when premium. Call at session start. */
  consumeMediumTrial: () => void;
  purchase: () => Promise<boolean>;
  restore:  () => Promise<boolean>;
}

export function usePremium(): PremiumHook {
  const [isPremium,   setIsPremium]   = useState<boolean>(readPremium);
  const [trialsUsed,  setTrialsUsed]  = useState<number>(readTrialsUsed);

  const mediumTrialsLeft = isPremium
    ? Infinity
    : Math.max(0, MEDIUM_TRIAL_LIMIT - trialsUsed);

  const canUseMedium = isPremium || mediumTrialsLeft > 0;

  const consumeMediumTrial = useCallback(() => {
    if (isPremium) return;
    const next = readTrialsUsed() + 1;
    try { localStorage.setItem(TRIALS_KEY, String(next)); } catch { /* ignore */ }
    setTrialsUsed(next);
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

  return { isPremium, mediumTrialsLeft, canUseMedium, consumeMediumTrial, purchase, restore };
}
