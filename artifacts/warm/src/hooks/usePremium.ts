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
 * Implementation note:
 *   usedDurations is stored in React state (the canonical source for rendering)
 *   AND persisted to localStorage (so it survives app restarts).
 *   This avoids every form of stale-closure or module-var reset bug.
 *
 * TODO (Play Store): replace purchase() / restore() bodies with
 * RevenueCat or @capacitor-community/in-app-purchases calls.
 * Product ID: "warm_premium_lifetime"
 */

import { useState } from 'react';

const PREMIUM_KEY        = 'warm_premium_v1';
const USED_DURATIONS_KEY = 'warm_used_durations_v1'; // e.g. "5,10"

export const PREMIUM_PRODUCT_ID = 'warm_premium_lifetime';

// ── Persistence helpers ────────────────────────────────────────────────────────

function readPremium(): boolean {
  try { return localStorage.getItem(PREMIUM_KEY) === '1'; } catch { return false; }
}

function readUsedDurations(): Set<number> {
  try {
    const raw = localStorage.getItem(USED_DURATIONS_KEY) ?? '';
    return new Set(raw.split(',').map(Number).filter(n => n > 0));
  } catch { return new Set(); }
}

function writeUsedDurations(set: Set<number>): void {
  try { localStorage.setItem(USED_DURATIONS_KEY, [...set].join(',')); } catch { /* quota */ }
}

// ── Hook interface ─────────────────────────────────────────────────────────────

export interface PremiumHook {
  isPremium: boolean;
  usedDurations: ReadonlySet<number>;
  /** True when the free trial for this duration has been consumed and user is not premium. */
  isLocked: (mins: number) => boolean;
  /** Mark a duration's free trial as consumed. No-op when premium or already consumed. */
  consumeDuration: (mins: number) => void;
  purchase: () => Promise<boolean>;
  restore:  () => Promise<boolean>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePremium(): PremiumHook {
  const [isPremium,      setIsPremium]      = useState<boolean>(readPremium);
  // usedDurations is the canonical source of truth for rendering.
  // It is initialised from localStorage and updated via setUsedDurations so
  // React always has the correct value when it re-renders the buttons.
  const [usedDurations, setUsedDurations]  = useState<Set<number>>(readUsedDurations);

  const isLocked = (mins: number): boolean =>
    !isPremium && usedDurations.has(mins);

  const consumeDuration = (mins: number): void => {
    if (isPremium || usedDurations.has(mins)) return;
    // Functional update so that concurrent calls in the same batch accumulate
    // correctly: each updater receives the latest state, not the closed-over snapshot.
    setUsedDurations(prev => {
      if (prev.has(mins)) return prev;
      const next = new Set(prev);
      next.add(mins);
      writeUsedDurations(next);   // persist inside updater (idempotent write)
      return next;
    });
  };

  const purchase = async (): Promise<boolean> => {
    // TODO: await Purchases.purchaseProduct({ productIdentifier: PREMIUM_PRODUCT_ID })
    try { localStorage.setItem(PREMIUM_KEY, '1'); } catch { /* ignore */ }
    setIsPremium(true);
    return true;
  };

  const restore = async (): Promise<boolean> => {
    // TODO: await Purchases.restorePurchases()
    const stored = readPremium();
    setIsPremium(stored);
    return stored;
  };

  return { isPremium, usedDurations, isLocked, consumeDuration, purchase, restore };
}
