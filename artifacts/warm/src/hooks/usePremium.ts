/**
 * Premium management — Google Play Billing as source of truth.
 *
 * Free tier:
 *   • 5-min button  — ONE free session, then locked
 *   • 10-min button — ONE free session, then locked
 *   • 15-min button — ONE free session, then locked
 *
 * Premium ($2.99 one-time): all buttons always unlocked.
 *
 * Architecture:
 *   On native Android, window.WarmBilling (JavascriptInterface) is the only
 *   authority on purchase state.  localStorage is used ONLY as an optimistic
 *   cache to prevent a "locked" flash before the first billing query resolves.
 *
 *   On web/dev (no window.WarmBilling), the hook falls back to the localStorage-
 *   only behaviour so unit tests and browser development continue to work.
 *
 * Scenarios handled:
 *   • App open         — queryPurchases() called on mount and on every onResume()
 *                        (Java side). JS receives PURCHASES_QUERIED.
 *   • New purchase     — launchBillingFlow() → Play dialog → PURCHASE_SUCCESS.
 *   • Reinstall /
 *     device change    — queryPurchases() on mount returns active entitlement.
 *   • Restore          — explicit restore() call → queryPurchases().
 *   • App closed mid-
 *     purchase         — PENDING state held by Play; next queryPurchases() resolves.
 *   • Already owned    — Java handles ITEM_ALREADY_OWNED → queryPurchasesInternal().
 */

import { useState, useEffect } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

export const PREMIUM_PRODUCT_ID = 'warm_premium_lifetime';

/**
 * Optimistic cache key.  Set to '1' only after billing confirms the purchase.
 * Cleared when billing says no active purchase.
 * Never used as the decision — only to prevent UI flash on first render.
 */
const BILLING_CACHE_KEY   = 'warm_premium_billing_v1';
const USED_DURATIONS_KEY  = 'warm_used_durations_v1';

// ── Native bridge detection ───────────────────────────────────────────────────

function isNative(): boolean {
  return typeof (window as Window & { WarmBilling?: unknown }).WarmBilling !== 'undefined';
}

function nativeBilling() {
  return (window as Window & { WarmBilling: { queryPurchases(): void; launchBillingFlow(): void } }).WarmBilling;
}

// ── Module-level state (survives re-renders and re-mounts) ────────────────────

let _isPremium       = false;
const _usedDurations = new Set<number>();

// Subscribers — hook instances register here to receive re-render triggers
// when billing state changes from a native event.
const _subscribers = new Set<() => void>();

function notifySubscribers(): void {
  _subscribers.forEach(fn => fn());
}

// ── Initialisation ────────────────────────────────────────────────────────────

(function init() {
  // Seed from optimistic cache — prevents "locked" flash before billing resolves.
  try { _isPremium = localStorage.getItem(BILLING_CACHE_KEY) === '1'; } catch { /* ignore */ }
  try {
    const raw = localStorage.getItem(USED_DURATIONS_KEY) ?? '';
    raw.split(',').map(Number).filter(n => n > 0 && n < 100)
       .forEach(n => _usedDurations.add(n));
  } catch { /* ignore */ }
})();

// ── Billing event listener (set up once, module-level) ────────────────────────

let _billingListenerSetup = false;

function ensureBillingListener(): void {
  if (_billingListenerSetup) return;
  _billingListenerSetup = true;

  window.addEventListener('billing-result', (e: Event) => {
    const detail = (e as CustomEvent<{
      type: string;
      hasPremium?: boolean;
      code?: number;
    }>).detail;

    if (detail.type === 'PURCHASES_QUERIED' || detail.type === 'PURCHASE_SUCCESS') {
      const prev = _isPremium;
      _isPremium = !!detail.hasPremium;
      // Update optimistic cache
      try {
        if (_isPremium) {
          localStorage.setItem(BILLING_CACHE_KEY, '1');
        } else {
          localStorage.removeItem(BILLING_CACHE_KEY);
        }
      } catch { /* ignore */ }
      // Only re-render if state actually changed
      if (_isPremium !== prev || detail.type === 'PURCHASE_SUCCESS') {
        notifySubscribers();
      }
    }
    // PURCHASE_PENDING, PURCHASE_CANCELLED, PURCHASE_ERROR:
    // These don't change _isPremium — the paywall sheet handles them via
    // the per-call promise returned by purchase().
  });
}

// ── Persistence helpers ───────────────────────────────────────────────────────

function persistUsed(): void {
  try {
    localStorage.setItem(USED_DURATIONS_KEY, [..._usedDurations].join(','));
  } catch { /* storage quota / unavailable */ }
}

// ── Hook interface ────────────────────────────────────────────────────────────

export interface PremiumHook {
  isPremium:     boolean;
  usedDurations: ReadonlySet<number>;
  /** Returns true when the button should show a lock (free use already consumed). */
  isLocked:       (mins: number) => boolean;
  /** Consume the one free use for this duration. No-op if premium or already consumed. */
  consumeDuration:(mins: number) => void;
  /**
   * Open the Play Store purchase dialog.
   * Resolves true on success, false on cancel/error.
   * On web/dev: immediately grants premium (dev shortcut).
   */
  purchase:  () => Promise<boolean>;
  /**
   * Query Play for existing purchases — restores premium after reinstall
   * or device change without going through the purchase flow again.
   * On web/dev: reads from optimistic cache.
   */
  restore:   () => Promise<boolean>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePremium(): PremiumHook {
  const [, setTick] = useState(0);
  const forceUpdate = () => setTick(t => t + 1);

  useEffect(() => {
    // Register for billing state changes (from native billing events)
    _subscribers.add(forceUpdate);
    ensureBillingListener();

    // On mount: ask native side for current purchase state
    if (isNative()) {
      nativeBilling().queryPurchases();
    }

    return () => { _subscribers.delete(forceUpdate); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──────────────────────────────────────────────────────────────

  const isLocked = (mins: number): boolean =>
    !_isPremium && _usedDurations.has(mins);

  const consumeDuration = (mins: number): void => {
    if (_isPremium || _usedDurations.has(mins)) return;
    _usedDurations.add(mins);
    persistUsed();
    forceUpdate();
  };

  // ── Purchase ──────────────────────────────────────────────────────────────

  const purchase = async (): Promise<boolean> => {
    if (!isNative()) {
      // Web / dev fallback — grant premium immediately for development
      _isPremium = true;
      try { localStorage.setItem(BILLING_CACHE_KEY, '1'); } catch { /* ignore */ }
      notifySubscribers();
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const handler = (e: Event) => {
        const detail = (e as CustomEvent<{ type: string }>).detail;
        if (
          detail.type === 'PURCHASE_SUCCESS'  ||
          detail.type === 'PURCHASE_CANCELLED'||
          detail.type === 'PURCHASE_ERROR'    ||
          detail.type === 'PURCHASE_PENDING'
        ) {
          window.removeEventListener('billing-result', handler);
          resolve(detail.type === 'PURCHASE_SUCCESS');
        }
      };
      window.addEventListener('billing-result', handler);
      nativeBilling().launchBillingFlow();
    });
  };

  // ── Restore ───────────────────────────────────────────────────────────────

  const restore = async (): Promise<boolean> => {
    if (!isNative()) {
      // Web / dev fallback — read from optimistic cache
      try { _isPremium = localStorage.getItem(BILLING_CACHE_KEY) === '1'; } catch { /* ignore */ }
      notifySubscribers();
      return _isPremium;
    }

    return new Promise<boolean>((resolve) => {
      const handler = (e: Event) => {
        const detail = (e as CustomEvent<{ type: string; hasPremium?: boolean }>).detail;
        if (detail.type === 'PURCHASES_QUERIED') {
          window.removeEventListener('billing-result', handler);
          resolve(!!detail.hasPremium);
        }
      };
      window.addEventListener('billing-result', handler);
      nativeBilling().queryPurchases();
    });
  };

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    isPremium:      _isPremium,
    usedDurations:  _usedDurations,
    isLocked,
    consumeDuration,
    purchase,
    restore,
  };
}

/** Exposed only for unit tests — resets all module-level state. */
export function __resetForTests(): void {
  _isPremium = false;
  _usedDurations.clear();
  _subscribers.clear();
  _billingListenerSetup = false;
  try { localStorage.clear(); } catch { /* ignore */ }
}
