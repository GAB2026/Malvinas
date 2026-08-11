import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePremium, __resetForTests } from '../usePremium';

beforeEach(() => {
  localStorage.clear();
  __resetForTests();
});

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

  it('purchase() persists under warm_premium_v2', async () => {
    const { result } = renderHook(() => usePremium());
    await act(async () => { await result.current.purchase(); });
    expect(localStorage.getItem('warm_premium_v2')).toBe('1');
  });

  it('restore() reads warm_premium_v2 and unlocks all buttons', async () => {
    localStorage.setItem('warm_premium_v2', '1');
    const { result } = renderHook(() => usePremium());
    await act(async () => { await result.current.restore(); });
    expect(result.current.isPremium).toBe(true);
    expect(result.current.isLocked(5)).toBe(false);
    expect(result.current.isLocked(10)).toBe(false);
    expect(result.current.isLocked(15)).toBe(false);
  });

  it('stale warm_premium_v1 key does NOT unlock buttons', () => {
    localStorage.setItem('warm_premium_v1', '1');
    const { result } = renderHook(() => usePremium());
    expect(result.current.isPremium).toBe(false);
    expect(result.current.isLocked(5)).toBe(false); // not yet consumed — unlocked
    expect(result.current.isLocked(10)).toBe(false);
  });
});
