import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePremium } from '../usePremium';

// jsdom provides localStorage — clear it before each test.
beforeEach(() => {
  localStorage.clear();
});

describe('usePremium — lock mechanism', () => {
  it('all buttons unlocked before any use', () => {
    const { result } = renderHook(() => usePremium());
    expect(result.current.isLocked(5)).toBe(false);
    expect(result.current.isLocked(10)).toBe(false);
    expect(result.current.isLocked(15)).toBe(false);
  });

  it('5-min button locks after consumeDuration(5), others stay unlocked', async () => {
    const { result } = renderHook(() => usePremium());

    await act(async () => {
      result.current.consumeDuration(5);
    });

    expect(result.current.isLocked(5)).toBe(true);
    expect(result.current.isLocked(10)).toBe(false);
    expect(result.current.isLocked(15)).toBe(false);
  });

  it('10-min button locks independently of 5-min', async () => {
    const { result } = renderHook(() => usePremium());

    await act(async () => {
      result.current.consumeDuration(10);
    });

    expect(result.current.isLocked(5)).toBe(false);
    expect(result.current.isLocked(10)).toBe(true);
    expect(result.current.isLocked(15)).toBe(false);
  });

  it('all three lock after all are used (one at a time)', async () => {
    const { result } = renderHook(() => usePremium());

    // Each consumeDuration call must be in its own act() so the functional
    // state updater runs and the next call sees the updated state.
    await act(async () => { result.current.consumeDuration(5); });
    await act(async () => { result.current.consumeDuration(10); });
    await act(async () => { result.current.consumeDuration(15); });

    expect(result.current.isLocked(5)).toBe(true);
    expect(result.current.isLocked(10)).toBe(true);
    expect(result.current.isLocked(15)).toBe(true);
  });

  it('calling consumeDuration twice on the same button has no effect', async () => {
    const { result } = renderHook(() => usePremium());

    await act(async () => {
      result.current.consumeDuration(5);
      result.current.consumeDuration(5); // second call — no-op
    });

    expect(result.current.isLocked(5)).toBe(true);
    // localStorage should contain "5" only once
    expect(localStorage.getItem('warm_used_durations_v1')).toBe('5');
  });

  it('lock persists across hook re-mounts (simulates app restart)', async () => {
    // First mount: use 5-min
    const first = renderHook(() => usePremium());
    await act(async () => {
      first.result.current.consumeDuration(5);
    });
    first.unmount();

    // Second mount (simulates fresh app launch with same localStorage)
    const second = renderHook(() => usePremium());
    expect(second.result.current.isLocked(5)).toBe(true);
    expect(second.result.current.isLocked(10)).toBe(false);
  });

  it('isLocked reflects the state AFTER consumeDuration in the same render cycle', async () => {
    const { result } = renderHook(() => usePremium());

    // Before
    expect(result.current.isLocked(10)).toBe(false);

    await act(async () => {
      result.current.consumeDuration(10);
    });

    // After — same hook instance, re-rendered
    expect(result.current.isLocked(10)).toBe(true);
  });

  it('premium user sees no locks regardless of used durations', async () => {
    const { result } = renderHook(() => usePremium());

    await act(async () => {
      result.current.consumeDuration(5);
      result.current.consumeDuration(10);
      result.current.consumeDuration(15);
      await result.current.purchase();
    });

    expect(result.current.isLocked(5)).toBe(false);
    expect(result.current.isLocked(10)).toBe(false);
    expect(result.current.isLocked(15)).toBe(false);
  });
});
