/**
 * Premium + free-session-count management.
 *
 * Free tier: up to FREE_SESSION_LIMIT lifetime sessions.
 * Premium: unlimited sessions, Medium/High intensity, 30-min duration.
 *
 * For Google Play billing, replace purchase() / restore() with the
 * RevenueCat or @capacitor-community/in-app-purchases plugin calls
 * and keep the localStorage flags as a local cache.
 *
 * Product ID to register in Play Console: "warm_premium_lifetime"
 */

import { useState, useCallback } from 'react';

const PREMIUM_KEY  = 'warm_premium_v1';
const SESSIONS_KEY = 'warm_free_sessions_v1';

export const FREE_SESSION_LIMIT  = 5;
export const PREMIUM_PRODUCT_ID  = 'warm_premium_lifetime';

// ── Local-storage helpers ─────────────────────────────────────────────────────
function readPremium(): boolean {
  try { return localStorage.getItem(PREMIUM_KEY) === '1'; } catch { return false; }
}
function readSessionsUsed(): number {
  try { return Math.max(0, parseInt(localStorage.getItem(SESSIONS_KEY) ?? '0', 10)); }
  catch { return 0; }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export interface PremiumHook {
  isPremium: boolean;
  /** Remaining free sessions (Infinity when premium). */
  freeSessionsLeft: number;
  /** Call this at the moment the user taps Start (debited once per session). */
  consumeSession: () => void;
  /** Returns true when the user may start a session. */
  canStart: boolean;
  purchase: () => Promise<boolean>;
  restore:  () => Promise<boolean>;
}

export function usePremium(): PremiumHook {
  const [isPremium,     setIsPremium]     = useState<boolean>(readPremium);
  const [sessionsUsed,  setSessionsUsed]  = useState<number>(readSessionsUsed);

  const freeSessionsLeft = isPremium
    ? Infinity
    : Math.max(0, FREE_SESSION_LIMIT - sessionsUsed);

  const canStart = isPremium || freeSessionsLeft > 0;

  const consumeSession = useCallback(() => {
    if (isPremium) return;
    const next = readSessionsUsed() + 1;
    try { localStorage.setItem(SESSIONS_KEY, String(next)); } catch { /* ignore */ }
    setSessionsUsed(next);
  }, [isPremium]);

  const purchase = useCallback(async (): Promise<boolean> => {
    // ── TODO (Play Store): replace with Google Play Billing ──────────────────
    // const { customerInfo } = await Purchases.purchaseProduct({ productIdentifier: PREMIUM_PRODUCT_ID });
    // const ok = !!customerInfo.entitlements.active['premium'];
    // ─────────────────────────────────────────────────────────────────────────
    try { localStorage.setItem(PREMIUM_KEY, '1'); } catch { /* ignore */ }
    setIsPremium(true);
    return true;
  }, []);

  const restore = useCallback(async (): Promise<boolean> => {
    // ── TODO (Play Store): await Purchases.restorePurchases() ─────────────────
    const stored = readPremium();
    setIsPremium(stored);
    return stored;
  }, []);

  return { isPremium, freeSessionsLeft, canStart, consumeSession, purchase, restore };
}
