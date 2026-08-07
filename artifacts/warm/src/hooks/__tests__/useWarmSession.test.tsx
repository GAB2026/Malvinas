import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useWarmSession,
  LOW_BATTERY_CUTOFF,
  TARGET_TEMP_C,
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
    const { result } = renderHook(() => useWarmSession(null));
    expect(result.current.running).toBe(false);
    expect(result.current.stopReason).toBeNull();
    expect(result.current.phase).toBe('idle');
  });

  it('running becomes true and phase is "warming" after start()', () => {
    const { result } = renderHook(() => useWarmSession(null));
    act(() => result.current.start());
    expect(result.current.running).toBe(true);
    expect(result.current.phase).toBe('warming');
  });

  it('running becomes false after stop() and stopReason is "user"', () => {
    const { result } = renderHook(() => useWarmSession(null));
    act(() => result.current.start());
    act(() => result.current.stop());
    expect(result.current.running).toBe(false);
    expect(result.current.stopReason).toBe('user');
    expect(result.current.phase).toBe('idle');
  });

  it('elapsed increments each second while running', () => {
    const { result } = renderHook(() => useWarmSession(null));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.elapsed).toBeGreaterThanOrEqual(3);
  });

  it('elapsed resets to 0 on a new start', () => {
    const { result } = renderHook(() => useWarmSession(null));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(5000));
    act(() => result.current.stop());
    act(() => result.current.start());
    expect(result.current.elapsed).toBe(0);
  });

  // ── temperature model ─────────────────────────────────────────────────────

  it('deviceTempC starts near ambient (~34°C) when not running', () => {
    const { result } = renderHook(() => useWarmSession(null));
    expect(result.current.deviceTempC).toBeCloseTo(34, 0);
  });

  it('deviceTempC rises above ambient while running', () => {
    const { result } = renderHook(() => useWarmSession(null));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(60000)); // 60 s
    expect(result.current.deviceTempC).toBeGreaterThan(34);
  });

  // ── phase transitions ─────────────────────────────────────────────────────

  it('transitions to "therapeutic" phase once target temp is reached (~210 s)', () => {
    const { result } = renderHook(() => useWarmSession(null));
    act(() => result.current.start());
    // high target ~43°C reached at ~125 s; advance 300 s to be safe
    act(() => vi.advanceTimersByTime(300000));
    expect(result.current.phase).toBe('therapeutic');
    expect(result.current.therapeuticRemaining).toBeGreaterThan(0);
  });

  it('transitions to "therapeutic" phase at high intensity', () => {
    const { result } = renderHook(() => useWarmSession(null));
    act(() => result.current.start());
    // high target 43°C reached at ~125 s; advance 200 s
    act(() => vi.advanceTimersByTime(200000));
    expect(result.current.phase).toBe('therapeutic');
    // Transition fires when simulated temp (settle baseline ~40°C + delta 4°C
    // = target ~44°C) is reached, typically ~93 s after session start.
    // After 200 s, ~107 s of therapeutic time has elapsed → ~793 s remaining.
    expect(result.current.therapeuticRemaining).toBeLessThanOrEqual(900);
    expect(result.current.therapeuticRemaining).toBeGreaterThan(700);
  });

  // ── auto-stop: time limit ─────────────────────────────────────────────────

  it('auto-stops with stopReason "time-limit" after warming + 15 min therapeutic (high intensity)', () => {
    const { result } = renderHook(() => useWarmSession(null));
    act(() => result.current.start());
    // high warm-up ~125 s + 15*60=900 s therapeutic = ~1025 s; advance 1100 s
    act(() => vi.advanceTimersByTime(1100000));
    expect(result.current.running).toBe(false);
    expect(result.current.stopReason).toBe('time-limit');
  });

  // ── duration switching ────────────────────────────────────────────────────

  it('intensity is always "high"', () => {
    const { result } = renderHook(() => useWarmSession(null));
    expect(result.current.intensity).toBe('high');
  });

  it('setSessionDuration changes session duration', () => {
    const { result } = renderHook(() => useWarmSession(null));
    act(() => result.current.setSessionDuration(5 * 60));
    expect(result.current.sessionDurationSecs).toBe(300);
    act(() => result.current.setSessionDuration(10 * 60));
    expect(result.current.sessionDurationSecs).toBe(600);
  });

  // ── auto-stop: tab hidden ─────────────────────────────────────────────────

  it('stops with stopReason "tab-hidden" when the tab is hidden', () => {
    const { result } = renderHook(() => useWarmSession(null));
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

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
  });

  it('does NOT stop when tab becomes visible (not hidden)', () => {
    const { result } = renderHook(() => useWarmSession(null));
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

  it('auto-stops with "time-limit" on visibility restore when therapeutic phase overran', () => {
    const { result } = renderHook(() => useWarmSession(null));
    act(() => result.current.start());

    // Advance to therapeutic phase
    act(() => vi.advanceTimersByTime(200000));
    expect(result.current.phase).toBe('therapeutic');

    // Silently mark tab hidden without event (throttled browser)
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });

    // Move wall clock past therapeutic limit
    vi.setSystemTime(Date.now() + 1000 * 1000);

    // Restore visibility
    act(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.running).toBe(false);
    expect(result.current.stopReason).toBe('time-limit');

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
  });

  // ── auto-stop: low battery ────────────────────────────────────────────────

  it('stops with stopReason "low-battery" when battery drops to cutoff (not charging)', async () => {
    const battery = makeMockBattery(0.5, false);
    const removeBattery = installBatteryMock(battery);

    const { result } = renderHook(() => useWarmSession(null));

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
    const battery = makeMockBattery(0.5, true);
    const removeBattery = installBatteryMock(battery);

    const { result } = renderHook(() => useWarmSession(null));

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
    const battery = makeMockBattery(LOW_BATTERY_CUTOFF, true);
    const removeBattery = installBatteryMock(battery);

    const { result } = renderHook(() => useWarmSession(null));

    await act(async () => {
      result.current.start();
    });

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

    const { result } = renderHook(() => useWarmSession(null));

    await act(async () => {
      result.current.start();
    });

    expect(result.current.batteryLevel).toBeCloseTo(0.72);

    removeBattery();
  });

  // ── heatLevel ramp ────────────────────────────────────────────────────────

  it('heatLevel is 0 when not running', () => {
    const { result } = renderHook(() => useWarmSession(null));
    expect(result.current.heatLevel).toBe(0);
  });

  it('heatLevel increases over time while running', () => {
    const { result } = renderHook(() => useWarmSession(null));
    act(() => result.current.start());
    const heat0 = result.current.heatLevel;
    act(() => vi.advanceTimersByTime(30000));
    expect(result.current.heatLevel).toBeGreaterThan(heat0);
  });

  it('heatLevel resets to 0 immediately after stop', () => {
    const { result } = renderHook(() => useWarmSession(null));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(30000));
    act(() => result.current.stop());
    expect(result.current.heatLevel).toBe(0);
  });

  // ── double-start guard ────────────────────────────────────────────────────

  it('calling start() while already running is a no-op', () => {
    const { result } = renderHook(() => useWarmSession(null));
    act(() => result.current.start());
    const startedAt = result.current.elapsed;
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.start()); // second call
    expect(result.current.running).toBe(true);
    expect(result.current.elapsed).toBeGreaterThan(startedAt);
  });

  // ── target temperatures ───────────────────────────────────────────────────

  it('TARGET_TEMP_C values are in a safe and meaningful range', () => {
    expect(TARGET_TEMP_C.low).toBeGreaterThan(34);
    expect(TARGET_TEMP_C.low).toBeLessThan(TARGET_TEMP_C.medium);
    expect(TARGET_TEMP_C.medium).toBeLessThan(TARGET_TEMP_C.high);
    expect(TARGET_TEMP_C.high).toBeLessThan(55);
  });

  // ── cleanup on unmount ────────────────────────────────────────────────────

  it('engine stops cleanly on unmount (no thrown errors)', () => {
    const { result, unmount } = renderHook(() => useWarmSession(null));
    act(() => result.current.start());
    expect(() => unmount()).not.toThrow();
  });

});
