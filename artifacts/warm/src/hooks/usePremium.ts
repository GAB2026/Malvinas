/**
 * Premium state management.
 *
 * Current implementation: localStorage flag (works for sideloaded APKs and
 * web testing). When publishing to Google Play, replace `purchase()` and
 * `restore()` with calls to the Google Play Billing plugin:
 *   npm install @revenuecat/purchases-capacitor
 *   or: npm install @capacitor-community/in-app-purchases
 *
 * The product ID to register in Play Console: "warm_premium_lifetime"
 */

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'warm_premium_v1';

/** Product ID to configure in Google Play Console */
export const PREMIUM_PRODUCT_ID = 'warm_premium_lifetime';

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export interface PremiumHook {
  isPremium: boolean;
  /** Triggers the purchase flow. Returns true if successful. */
  purchase: () => Promise<boolean>;
  /** Restores a previous purchase (required by Play Store policy). */
  restore: () => Promise<boolean>;
}

export function usePremium(): PremiumHook {
  const [isPremium, setIsPremium] = useState<boolean>(readStored);

  const purchase = useCallback(async (): Promise<boolean> => {
    // ── TODO (Play Store): replace this block with real billing ──────────────
    // Example with RevenueCat:
    //   const { customerInfo } = await Purchases.purchaseProduct({ productIdentifier: PREMIUM_PRODUCT_ID });
    //   const hasPremium = customerInfo.entitlements.active['premium'] !== undefined;
    //   if (hasPremium) { localStorage.setItem(STORAGE_KEY, '1'); setIsPremium(true); }
    //   return hasPremium;
    // ─────────────────────────────────────────────────────────────────────────
    localStorage.setItem(STORAGE_KEY, '1');
    setIsPremium(true);
    return true;
  }, []);

  const restore = useCallback(async (): Promise<boolean> => {
    // ── TODO (Play Store): replace with billing restore call ─────────────────
    // Example: const { customerInfo } = await Purchases.restorePurchases();
    // ─────────────────────────────────────────────────────────────────────────
    const stored = readStored();
    setIsPremium(stored);
    return stored;
  }, []);

  return { isPremium, purchase, restore };
}
