/**
 * Premium management — 5-min button trial.
 *
 * Free tier:
 *   • 5-min session — ONE free use; locked afterwards.
 *   • 10-min and 15-min — always free (for now).
 *
 * Premium ($2.99 one-time): unlocks the 5-min button permanently.
 *
 * NOTE: _5minUsed lives at module level (outside React) so it is never
 * stale inside closures and is immune to React batching quirks on Android.
 *
 * TODO (Play Store): replace purchase() / restore() bodies with
 * RevenueCat or @capacitor-community/in-app-purchases calls.
 * Product ID: "warm_premium_lifetime"
 */

import { useState, useCallback } from 'react';

const PREMIUM_KEY   = 'warm_premium_v1';
const USED_5MIN_KEY = 'warm_5min_used_v1';

export const PREMIUM_PRODUCT_ID = 'warm_premium_lifetime';

// ── Module-level singleton ─────────────────────────────────────────────────────
// Initialised once from localStorage on app load; never reset by React renders.
// Reading _5minUsed directly in the hook avoids stale closure issues entirely.
let _5minUsed: boolean = (() => {
  try { return localStorage.getItem(USED_5MIN_KEY) === '1'; } catch { return false; }
})();

function readPremium(): boolean {
  try { return localStorage.getItem(PREMIUM_KEY) === '1'; } catch { return false; }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export interface PremiumHook {
  isPremium: boolean;
  /** True when the 5-min free trial has been consumed and user is not premium. */
  is5MinLocked: boolean;
  /** Mark the 5-min trial as consumed. No-op when premium or already consumed. */
  consume5Min: () => void;
  purchase: () => Promise<boolean>;
  restore:  () => Promise<boolean>;
}

export function usePremium(): PremiumHook {
  const [isPremium, setIsPremium] = useState<boolean>(readPremium);
  // Tick is only for triggering re-renders after consume5Min mutates the module var.
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick(n => n + 1), []);

  // Read the module-level var directly — never stale, never batched incorrectly.
  const is5MinLocked = !isPremium && _5minUsed;

  const consume5Min = useCallback(() => {
    if (isPremium || _5minUsed) return;
    _5minUsed = true;                                    // mutate module var immediately
    try { localStorage.setItem(USED_5MIN_KEY, '1'); } catch { /* ignore */ }
    forceUpdate();                                       // trigger re-render so lock icon appears
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

  return { isPremium, is5MinLocked, consume5Min, purchase, restore };
}
