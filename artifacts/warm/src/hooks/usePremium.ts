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
 * Design note — NO useCallback / module-level state:
 *   isLocked() and consumeDuration() read/write localStorage directly on every
 *   call.  This is intentional: it eliminates every form of stale-closure bug
 *   that plagues memoized hooks on Android's React-batching quirks.
 *   localStorage.getItem is synchronous and O(1) — the overhead is invisible.
 *
 * TODO (Play Store): replace purchase() / restore() bodies with
 * RevenueCat or @capacitor-community/in-app-purchases calls.
 * Product ID: "warm_premium_lifetime"
 */

import { useState } from 'react';

const PREMIUM_KEY        = 'warm_premium_v1';
const USED_DURATIONS_KEY = 'warm_used_durations_v1'; // e.g. "5,10"

export const PREMIUM_PRODUCT_ID = 'warm_premium_lifetime';

// ── localStorage helpers ───────────────────────────────────────────────────────

function readPremium(): boolean {
  try { return localStorage.getItem(PREMIUM_KEY) === '1'; } catch { return false; }
}

/** Always reads the current on-disk value — never stale. */
function readUsedDurations(): Set<number> {
  try {
    const raw = localStorage.getItem(USED_DURATIONS_KEY) ?? '';
    return new Set(raw.split(',').map(Number).filter(n => n > 0));
  } catch { return new Set(); }
}

function writeUsedDurations(set: Set<number>): void {
  try { localStorage.setItem(USED_DURATIONS_KEY, [...set].join(',')); } catch { /* ignore */ }
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
  // `tick` is only used to force a re-render after consumeDuration writes to
  // localStorage, so the lock icon appears on the same frame as session end.
  const [, setTick] = useState(0);

  // ── NOT memoized on purpose ──────────────────────────────────────────────
  // Reads localStorage on every call → impossible to return a stale value.
  const isLocked = (mins: number): boolean => {
    if (isPremium) return false;
    return readUsedDurations().has(mins);
  };

  const consumeDuration = (mins: number): void => {
    if (isPremium) return;
    const used = readUsedDurations();
    if (used.has(mins)) return;        // already consumed
    used.add(mins);
    writeUsedDurations(used);          // persist immediately
    setTick(t => t + 1);              // trigger re-render → lock appears
  };
  // ────────────────────────────────────────────────────────────────────────

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

  return { isPremium, isLocked, consumeDuration, purchase, restore };
}
