/**
 * usePremium tests — web/dev mode (no window.WarmBilling native bridge).
 *
 * In this environment isNative() returns false, so:
 *   • purchase()  — grants premium immediately (dev shortcut)
 *   • restore()   — reads from optimistic cache (warm_premium_billing_v1)
 *   • billing-result events still update state when dispatched manually
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePremium, __resetForTests } from '../usePremium';

const CACHE_KEY = 'warm_premium_billing_v1';

beforeEach(() => {
  localStorage.clear();
  __resetForTests();
});

// ── Free-tier locking ─────────────────────────────────────────────────────────

describe('usePremium — one free use per button', () => {
  it('all three buttons start unlocked (no uses consumed yet)', () => {
    const { result } = renderHook(() => usePremium());
    expect(result.current.isLocked(5)).toBe(false);
    expect(result.current.isLocked(10)).toBe(false);
    expect(result.current.isLocked(15)).toBe(false);
  });

  it('5-min locks after consumeDuration(5)', async () => {
    const { result } = renderHook(() => usePremium());
    await act(async () => { result.current.consumeDuration(5); });
    expect(result.current.isLocked(5)).toBe(true);
    expect(result.current.isLocked(10)).toBe(false);
    expect(result.current.isLocked(15)).toBe(false);
  });

  it('10-min locks after consumeDuration(10)', async () => {
    const { result } = renderHook(() => usePremium());
    await act(async () => { result.current.consumeDuration(10); });
    expect(result.current.isLocked(5)).toBe(false);
    expect(result.current.isLocked(10)).toBe(true);
    expect(result.current.isLocked(15)).toBe(false);
  });

  it('15-min locks after consumeDuration(15)', async () => {
    const { result } = renderHook(() => usePremium());
    await act(async () => { result.current.consumeDuration(15); });
    expect(result.current.isLocked(5)).toBe(false);
    expect(result.current.isLocked(10)).toBe(false);
    expect(result.current.isLocked(15)).toBe(true);
  });

  it('each button locks independently', async () => {
    const { result } = renderHook(() => usePremium());
    await act(async () => { result.current.consumeDuration(5); });
    await act(async () => { result.current.consumeDuration(15); });
    expect(result.current.isLocked(5)).toBe(true);
    expect(result.current.isLocked(10)).toBe(false);
    expect(result.current.isLocked(15)).toBe(true);
  });

  it('calling consumeDuration twice on same button is a no-op', async () => {
    const { result } = renderHook(() => usePremium());
    await act(async () => { result.current.consumeDuration(10); });
    await act(async () => { result.current.consumeDuration(10); });
    expect(result.current.isLocked(10)).toBe(true);
    expect(localStorage.getItem('warm_used_durations_v1')).toBe('10');
  });

  it('used durations persist to localStorage', async () => {
    const { result } = renderHook(() => usePremium());
    await act(async () => { result.current.consumeDuration(5); });
    await act(async () => { result.current.consumeDuration(10); });
    const stored = localStorage.getItem('warm_used_durations_v1')!;
    expect(stored.split(',')).toContain('5');
    expect(stored.split(',')).toContain('10');
  });

  it('isLocked reflects state immediately after consumeDuration', async () => {
    const { result } = renderHook(() => usePremium());
    expect(result.current.isLocked(15)).toBe(false);
    await act(async () => { result.current.consumeDuration(15); });
    expect(result.current.isLocked(15)).toBe(true);
  });
});

// ── Dev/web purchase and restore ──────────────────────────────────────────────

describe('usePremium — dev mode purchase / restore (no native bridge)', () => {
  it('purchase() unlocks all buttons', async () => {
    const { result } = renderHook(() => usePremium());
    await act(async () => { result.current.consumeDuration(5); });
    await act(async () => { result.current.consumeDuration(10); });
    await act(async () => { result.current.consumeDuration(15); });
    await act(async () => { await result.current.purchase(); });
    expect(result.current.isPremium).toBe(true);
    expect(result.current.isLocked(5)).toBe(false);
    expect(result.current.isLocked(10)).toBe(false);
    expect(result.current.isLocked(15)).toBe(false);
  });

  it('purchase() persists under warm_premium_billing_v1', async () => {
    const { result } = renderHook(() => usePremium());
    await act(async () => { await result.current.purchase(); });
    expect(localStorage.getItem(CACHE_KEY)).toBe('1');
  });

  it('restore() reads warm_premium_billing_v1 and unlocks all buttons', async () => {
    localStorage.setItem(CACHE_KEY, '1');
    __resetForTests();
    // Re-seed from localStorage after reset
    localStorage.setItem(CACHE_KEY, '1');
    const { result } = renderHook(() => usePremium());
    await act(async () => { await result.current.restore(); });
    expect(result.current.isPremium).toBe(true);
    expect(result.current.isLocked(5)).toBe(false);
    expect(result.current.isLocked(10)).toBe(false);
    expect(result.current.isLocked(15)).toBe(false);
  });

  it('stale warm_premium_v2 key does NOT unlock buttons', () => {
    localStorage.setItem('warm_premium_v2', '1');
    const { result } = renderHook(() => usePremium());
    expect(result.current.isPremium).toBe(false);
  });

  it('stale warm_premium_v1 key does NOT unlock buttons', () => {
    localStorage.setItem('warm_premium_v1', '1');
    const { result } = renderHook(() => usePremium());
    expect(result.current.isPremium).toBe(false);
  });
});

// ── Billing event integration ─────────────────────────────────────────────────

describe('usePremium — billing-result event handling', () => {
  it('PURCHASES_QUERIED with hasPremium:true unlocks premium', async () => {
    const { result } = renderHook(() => usePremium());
    await act(async () => {
      window.dispatchEvent(new CustomEvent('billing-result', {
        detail: { type: 'PURCHASES_QUERIED', hasPremium: true },
      }));
    });
    expect(result.current.isPremium).toBe(true);
    expect(localStorage.getItem(CACHE_KEY)).toBe('1');
  });

  it('PURCHASES_QUERIED with hasPremium:false clears premium', async () => {
    localStorage.setItem(CACHE_KEY, '1');
    __resetForTests();
    localStorage.setItem(CACHE_KEY, '1');
    const { result } = renderHook(() => usePremium());
    // Billing says not purchased — clear the optimistic cache
    await act(async () => {
      window.dispatchEvent(new CustomEvent('billing-result', {
        detail: { type: 'PURCHASES_QUERIED', hasPremium: false },
      }));
    });
    expect(result.current.isPremium).toBe(false);
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('PURCHASE_SUCCESS sets isPremium to true', async () => {
    const { result } = renderHook(() => usePremium());
    await act(async () => {
      window.dispatchEvent(new CustomEvent('billing-result', {
        detail: { type: 'PURCHASE_SUCCESS', hasPremium: true },
      }));
    });
    expect(result.current.isPremium).toBe(true);
  });

  it('PURCHASE_CANCELLED does not change premium state', async () => {
    const { result } = renderHook(() => usePremium());
    await act(async () => {
      window.dispatchEvent(new CustomEvent('billing-result', {
        detail: { type: 'PURCHASE_CANCELLED' },
      }));
    });
    expect(result.current.isPremium).toBe(false);
  });

  it('multiple hook instances all re-render on billing event', async () => {
    const { result: r1 } = renderHook(() => usePremium());
    const { result: r2 } = renderHook(() => usePremium());
    await act(async () => {
      window.dispatchEvent(new CustomEvent('billing-result', {
        detail: { type: 'PURCHASES_QUERIED', hasPremium: true },
      }));
    });
    expect(r1.current.isPremium).toBe(true);
    expect(r2.current.isPremium).toBe(true);
  });
});
