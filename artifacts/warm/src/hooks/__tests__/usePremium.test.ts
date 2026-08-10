import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePremium, __resetForTests, FREE_MINS } from '../usePremium';

// Reset module-level state AND localStorage before each test so tests are isolated.
beforeEach(() => {
  localStorage.clear();
  __resetForTests();
});

describe('usePremium — combined lock model', () => {
  // ── 5-min (FREE_MINS) — one free use, then locked ─────────────────────────

  it('5-min button starts unlocked (one free use available)', () => {
    const { result } = renderHook(() => usePremium());
    expect(result.current.isLocked(FREE_MINS)).toBe(false);
    expect(result.current.isLocked(5)).toBe(false);
  });

  it('5-min button locks after consumeDuration(5)', async () => {
    const { result } = renderHook(() => usePremium());
    await act(async () => { result.current.consumeDuration(5); });
    expect(result.current.isLocked(5)).toBe(true);
  });

  it('5-min lock persists to localStorage', async () => {
    const { result } = renderHook(() => usePremium());
    await act(async () => { result.current.consumeDuration(5); });
    expect(localStorage.getItem('warm_used_durations_v1')).toBe('5');
  });

  it('calling consumeDuration(5) twice is a no-op on second call', async () => {
    const { result } = renderHook(() => usePremium());
    await act(async () => { result.current.consumeDuration(5); });
    await act(async () => { result.current.consumeDuration(5); }); // no-op
    expect(result.current.isLocked(5)).toBe(true);
    expect(localStorage.getItem('warm_used_durations_v1')).toBe('5');
  });

  // ── 10-min and 15-min — always locked from first launch ───────────────────

  it('10-min button is locked from the very first render', () => {
    const { result } = renderHook(() => usePremium());
    expect(result.current.isLocked(10)).toBe(true);
  });

  it('15-min button is locked from the very first render', () => {
    const { result } = renderHook(() => usePremium());
    expect(result.current.isLocked(15)).toBe(true);
  });

  it('consumeDuration(10) is a no-op — 10-min stays locked', async () => {
    const { result } = renderHook(() => usePremium());
    await act(async () => { result.current.consumeDuration(10); });
    expect(result.current.isLocked(10)).toBe(true);
    // Should NOT have written to localStorage
    expect(localStorage.getItem('warm_used_durations_v1')).toBeNull();
  });

  // ── Premium unlocks everything ─────────────────────────────────────────────

  it('purchase() unlocks all buttons including 10 and 15 min', async () => {
    const { result } = renderHook(() => usePremium());

    // 10 and 15 are locked before purchase
    expect(result.current.isLocked(10)).toBe(true);
    expect(result.current.isLocked(15)).toBe(true);

    await act(async () => { await result.current.purchase(); });

    expect(result.current.isPremium).toBe(true);
    expect(result.current.isLocked(5)).toBe(false);
    expect(result.current.isLocked(10)).toBe(false);
    expect(result.current.isLocked(15)).toBe(false);
  });

  it('purchase() persists to localStorage under warm_premium_v2', async () => {
    const { result } = renderHook(() => usePremium());
    await act(async () => { await result.current.purchase(); });
    expect(localStorage.getItem('warm_premium_v2')).toBe('1');
  });

  it('restore() reads warm_premium_v2 key', async () => {
    localStorage.setItem('warm_premium_v2', '1');
    const { result } = renderHook(() => usePremium());
    await act(async () => { await result.current.restore(); });
    expect(result.current.isPremium).toBe(true);
    expect(result.current.isLocked(10)).toBe(false);
  });

  it('old warm_premium_v1 key does NOT unlock buttons (stale test data ignored)', () => {
    // Simulate a device that had premium set via the old key
    localStorage.setItem('warm_premium_v1', '1');
    const { result } = renderHook(() => usePremium());
    // New code reads warm_premium_v2, so this should still be locked
    expect(result.current.isPremium).toBe(false);
    expect(result.current.isLocked(10)).toBe(true);
  });

  it('isLocked reflects state immediately after consumeDuration in same cycle', async () => {
    const { result } = renderHook(() => usePremium());
    expect(result.current.isLocked(5)).toBe(false);
    await act(async () => { result.current.consumeDuration(5); });
    expect(result.current.isLocked(5)).toBe(true);
  });
});
