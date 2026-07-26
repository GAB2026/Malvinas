import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useWarmSession,
  SESSION_LIMIT_SECONDS,
  LOW_BATTERY_CUTOFF,
} from '../useWarmSession';

// ─── Battery API mock helpers ────────────────────────────────────────────────

type BatteryCallback = () => void;

interface MockBattery extends EventTarget {
  level: number;
  charging: boolean;
  _fire: (event: string) => void;
}

function makeMockBattery(level = 1, charging = false): MockBattery {
  const listeners: Record<string, BatteryCallback[]> = {};
  const battery: MockBattery = {
    level,
    charging,
    addEventListener(type: string, cb: BatteryCallback) {
      (listeners[type] ??= []).push(cb);
    },
    removeEventListener(type: string, cb: BatteryCallback) {
      listeners[type] = (listeners[type] ?? []).filter((f) => f !== cb);
    },
    dispatchEvent(_e: Event) {
      return true;
    },
    _fire(event: string) {
      for (const cb of listeners[event] ?? []) cb();
    },
  };
  return battery;
}

// ─── WakeLock mock helpers ────────────────────────────────────────────────────

function installWakeLockMock() {
  const released = { value: false };
  const mockLock = {
    release: vi.fn(async () => {
      released.value = true;
    }),
    addEventListener: vi.fn(),
  };
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request: vi.fn(async () => mockLock) },
  });
  return { mockLock, released };
}

function removeWakeLockMock() {
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: undefined,
  });
}

// ─── Helper: install Battery API on navigator ─────────────────────────────────

function installBatteryMock(battery: MockBattery) {
  const nav = navigator as Navigator & {
    getBattery?: () => Promise<MockBattery>;
  };
  (nav as any).getBattery = vi.fn(() => Promise.resolve(battery));
  return () => {
    delete (nav as any).getBattery;
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useWarmSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installWakeLockMock();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeWakeLockMock();
  });

  // ── start / stop ──────────────────────────────────────────────────────────

  it('is not running on initial render', () => {
    const { result } = renderHook(() => useWarmSession());
    expect(result.current.running).toBe(false);
    expect(result.current.stopReason).toBeNull();
  });

  it('running becomes true after start()', () => {
    const { result } = renderHook(() => useWarmSession());
    act(() => result.current.start());
    expect(result.current.running).toBe(true);
  });

  it('running becomes false after stop() and stopReason is "user"', () => {
    const { result } = renderHook(() => useWarmSession());
    act(() => result.current.start());
    act(() => result.current.stop());
    expect(result.current.running).toBe(false);
    expect(result.current.stopReason).toBe('user');
  });

  it('elapsed increments each second while running', () => {
    const { result } = renderHook(() => useWarmSession());
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.elapsed).toBeGreaterThanOrEqual(3);
  });

  it('remaining starts at SESSION_LIMIT_SECONDS', () => {
    const { result } = renderHook(() => useWarmSession());
    act(() => result.current.start());
    expect(result.current.remaining).toBeLessThanOrEqual(SESSION_LIMIT_SECONDS);
    expect(result.current.remaining).toBeGreaterThan(0);
  });

  it('elapsed resets to 0 on a new start', () => {
    const { result } = renderHook(() => useWarmSession());
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(5000));
    act(() => result.current.stop());
    act(() => result.current.start());
    expect(result.current.elapsed).toBe(0);
  });

  // ── intensity switching ───────────────────────────────────────────────────

  it('setIntensity changes intensity when not running', () => {
    const { result } = renderHook(() => useWarmSession());
    act(() => result.current.setIntensity('high'));
    expect(result.current.intensity).toBe('high');
  });

  it('setIntensity changes intensity while running', () => {
    const { result } = renderHook(() => useWarmSession());
    act(() => result.current.start());
    act(() => result.current.setIntensity('low'));
    expect(result.current.intensity).toBe('low');
    expect(result.current.running).toBe(true);
  });

  it('workerCount changes when intensity changes', () => {
    const { result } = renderHook(() => useWarmSession());
    act(() => result.current.setIntensity('low'));
    const lowCount = result.current.workerCount;
    act(() => result.current.setIntensity('high'));
    const highCount = result.current.workerCount;
    // On a multi-core device high should use more workers;
    // allow equal only on single-core hosts.
    expect(highCount).toBeGreaterThanOrEqual(lowCount);
  });

  // ── auto-stop: time limit ─────────────────────────────────────────────────

  it('auto-stops with stopReason "time-limit" after SESSION_LIMIT_SECONDS', () => {
    const { result } = renderHook(() => useWarmSession());
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(SESSION_LIMIT_SECONDS * 1000 + 1000));
    expect(result.current.running).toBe(false);
    expect(result.current.stopReason).toBe('time-limit');
  });

  // ── auto-stop: tab hidden ─────────────────────────────────────────────────

  it('stops with stopReason "tab-hidden" when the tab is hidden', () => {
    const { result } = renderHook(() => useWarmSession());
    act(() => result.current.start());

    act(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.running).toBe(false);
    expect(result.current.stopReason).toBe('tab-hidden');

    // Restore
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
  });

  it('does NOT stop when tab becomes visible (not hidden)', () => {
    const { result } = renderHook(() => useWarmSession());
    act(() => result.current.start());

    act(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.running).toBe(true);
  });

  // ── auto-stop: low battery ────────────────────────────────────────────────

  it('stops with stopReason "low-battery" when battery drops to cutoff (not charging)', async () => {
    const battery = makeMockBattery(0.5, false);
    const removeBattery = installBatteryMock(battery);

    const { result } = renderHook(() => useWarmSession());

    // Wait for the getBattery promise to resolve.
    await act(async () => {
      result.current.start();
    });

    act(() => {
      battery.level = LOW_BATTERY_CUTOFF;
      battery._fire('levelchange');
    });

    expect(result.current.running).toBe(false);
    expect(result.current.stopReason).toBe('low-battery');

    removeBattery();
  });

  it('does NOT stop on low battery when charging', async () => {
    const battery = makeMockBattery(0.5, true); // charging = true
    const removeBattery = installBatteryMock(battery);

    const { result } = renderHook(() => useWarmSession());

    await act(async () => {
      result.current.start();
    });

    act(() => {
      battery.level = LOW_BATTERY_CUTOFF;
      battery._fire('levelchange');
    });

    expect(result.current.running).toBe(true);

    removeBattery();
  });

  it('stops when charger is unplugged at low battery', async () => {
    const battery = makeMockBattery(LOW_BATTERY_CUTOFF, true); // already low but charging
    const removeBattery = installBatteryMock(battery);

    const { result } = renderHook(() => useWarmSession());

    await act(async () => {
      result.current.start();
    });

    // Unplug charger
    act(() => {
      battery.charging = false;
      battery._fire('chargingchange');
    });

    expect(result.current.running).toBe(false);
    expect(result.current.stopReason).toBe('low-battery');

    removeBattery();
  });

  it('reports batteryLevel from the Battery API', async () => {
    const battery = makeMockBattery(0.72, false);
    const removeBattery = installBatteryMock(battery);

    const { result } = renderHook(() => useWarmSession());

    await act(async () => {
      result.current.start();
    });

    expect(result.current.batteryLevel).toBeCloseTo(0.72);

    removeBattery();
  });

  // ── heatLevel ramp ────────────────────────────────────────────────────────

  it('heatLevel is 0 when not running', () => {
    const { result } = renderHook(() => useWarmSession());
    expect(result.current.heatLevel).toBe(0);
  });

  it('heatLevel increases over time while running', () => {
    const { result } = renderHook(() => useWarmSession());
    act(() => result.current.start());
    const heat0 = result.current.heatLevel;
    act(() => vi.advanceTimersByTime(30000));
    expect(result.current.heatLevel).toBeGreaterThan(heat0);
  });

  it('heatLevel resets to 0 immediately after stop', () => {
    const { result } = renderHook(() => useWarmSession());
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(30000));
    act(() => result.current.stop());
    expect(result.current.heatLevel).toBe(0);
  });

  // ── double-start guard ────────────────────────────────────────────────────

  it('calling start() while already running is a no-op', () => {
    const { result } = renderHook(() => useWarmSession());
    act(() => result.current.start());
    const startedAt = result.current.elapsed;
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.start()); // second call
    // Still running without reset
    expect(result.current.running).toBe(true);
    expect(result.current.elapsed).toBeGreaterThan(startedAt);
  });

  // ── cleanup on unmount ────────────────────────────────────────────────────

  it('engine stops cleanly on unmount (no thrown errors)', () => {
    const { result, unmount } = renderHook(() => useWarmSession());
    act(() => result.current.start());
    expect(() => unmount()).not.toThrow();
  });
});
