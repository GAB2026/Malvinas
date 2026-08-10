import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── usePremium mock ──────────────────────────────────────────────────────────
// Mirrors the current PremiumHook interface. The module-level _usedDurations
// Set is mutated by consumeDuration (mirroring production behaviour).

const _usedDurations = new Set<number>();
let _isPremium = false;

vi.mock('@/hooks/usePremium', () => ({
  PREMIUM_PRODUCT_ID: 'warm_premium_lifetime',
  usePremium: () => ({
    isPremium: _isPremium,
    usedDurations: _usedDurations,
    isLocked: (mins: number) => !_isPremium && _usedDurations.has(mins),
    consumeDuration: (mins: number) => {
      if (_isPremium || _usedDurations.has(mins)) return;
      _usedDurations.add(mins);
    },
    purchase:  vi.fn().mockResolvedValue(true),
    restore:   vi.fn().mockResolvedValue(false),
  }),
}));

// ─── useCalibration mock ──────────────────────────────────────────────────────

vi.mock('@/hooks/useCalibration', () => ({
  useCalibration: () => ({
    result: {
      ambientC: 34,
      usingRealSensor: false,
      highMinutes: 10,
      mediumMinutes: 20,
      lowMinutes: 35,
    },
    calibrating: false,
    progress: 1,
    reset: vi.fn(),
  }),
}));

// ─── AnimatedFlame mock ───────────────────────────────────────────────────────

vi.mock('@/components/AnimatedFlame', () => ({
  default: ({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) =>
    React.createElement('button', { onClick, disabled, 'data-testid': 'animated-flame' }, '🔥'),
}));

// ─── Chime mock ───────────────────────────────────────────────────────────────

vi.mock('@/lib/chime', () => ({
  playCompletionChime: vi.fn().mockResolvedValue(undefined),
}));

// ─── Framer-motion stub ───────────────────────────────────────────────────────

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target: object, tag: string) =>
        ({ children, animate: _a, initial: _i, exit: _e, transition: _t, ...rest }: any) =>
          React.createElement(tag, rest, children),
    },
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// ─── useWarmSession mock ──────────────────────────────────────────────────────

vi.mock('@/hooks/useWarmSession', () => ({
  useWarmSession: () => (globalThis as any).__warmSessionMock,
}));

import type { StopReason, Phase } from '@/hooks/useWarmSession';
import Home from '../Home';

const baseSession = {
  running: false,
  intensity: 'high' as const,
  start: vi.fn(),
  stop: vi.fn(),
  phase: 'idle' as Phase,
  elapsed: 0,
  therapeuticElapsed: 0,
  therapeuticRemaining: 0,
  warmingRemaining: 0,
  deviceTempC: 34,
  heatLevel: 0,
  stopReason: null as StopReason,
  wakeLockActive: false,
  batteryLevel: null as number | null,
  workerCount: 8,
  coolingDown: false,
  burstActive: false,
  sessionDurationSecs: 15 * 60,
  setSessionDuration: vi.fn(),
};

function setMockSession(overrides: Partial<typeof baseSession>) {
  (globalThis as any).__warmSessionMock = { ...baseSession, ...overrides };
}

const AUTO_DISMISS_MS = 5000;

function renderWithStopReason(stopReason: StopReason) {
  setMockSession({ running: false, stopReason });
  return render(<Home />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Home — auto-stop toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _usedDurations.clear();
    _isPremium = false;
    setMockSession({});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('shows "Therapeutic session complete" for time-limit stop', () => {
    renderWithStopReason('time-limit');
    expect(screen.getByText('Therapeutic session complete')).toBeInTheDocument();
  });

  it('shows "Battery too low — session stopped" for low-battery stop', () => {
    renderWithStopReason('low-battery');
    expect(screen.getByText('Battery too low — session stopped')).toBeInTheDocument();
  });

  it('does NOT show a toast when the stop reason is "user"', () => {
    renderWithStopReason('user');
    expect(screen.queryByText('Therapeutic session complete')).not.toBeInTheDocument();
    expect(screen.queryByText('Battery too low — session stopped')).not.toBeInTheDocument();
  });

  it('shows no toast when stopReason is null', () => {
    renderWithStopReason(null);
    expect(screen.queryByText(/session complete|too low/)).not.toBeInTheDocument();
  });

  it('toast disappears after AUTO_DISMISS_MS', () => {
    renderWithStopReason('time-limit');
    expect(screen.getByText('Therapeutic session complete')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(AUTO_DISMISS_MS + 100); });
    expect(screen.queryByText('Therapeutic session complete')).not.toBeInTheDocument();
  });

  it('toast is still visible just before the dismiss timeout', () => {
    renderWithStopReason('low-battery');
    act(() => { vi.advanceTimersByTime(AUTO_DISMISS_MS - 500); });
    expect(screen.getByText('Battery too low — session stopped')).toBeInTheDocument();
  });

  it('shows warming phase indicator when phase is warming', () => {
    setMockSession({ running: true, phase: 'warming', deviceTempC: 36, heatLevel: 0.1, warmingRemaining: 200 });
    render(<Home />);
    // English phaseWarming = 'Calibrating peak temperature…'
    expect(screen.getByText(/Calibrating/i)).toBeInTheDocument();
  });

  it('shows therapeutic phase indicator when phase is therapeutic', () => {
    setMockSession({ running: true, phase: 'therapeutic', deviceTempC: 40, heatLevel: 0.6, therapeuticRemaining: 600 });
    render(<Home />);
    // English phaseTherapeutic = 'Therapy active'
    expect(screen.getByText(/Therapy active/i)).toBeInTheDocument();
  });
});

describe('Home — duration button lock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _usedDurations.clear();   // const Set — clear, not reassign
    _isPremium = false;
    setMockSession({});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders 3 duration buttons showing numbers when nothing is locked', () => {
    render(<Home />);
    // Unlocked buttons show their minute numbers
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    // No "Premium" badge should be visible
    expect(screen.queryByText('Premium')).not.toBeInTheDocument();
  });

  it('locked button shows "Premium" label instead of the minute number', () => {
    // Pre-seed: 5-min was used
    _usedDurations.add(5);
    setMockSession({ running: false, stopReason: null });
    render(<Home />);

    // The locked 5-min button replaces its content with a lock icon + "Premium" text
    expect(screen.getByText('Premium')).toBeInTheDocument();
    // The other two buttons still show their numbers
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    // The number "5" should NOT be visible (the button shows "Premium" instead)
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });

  it('consumeDuration is called when flame is tapped to start a session', () => {
    // baseSession.sessionDurationSecs = 15*60, so selectedMins = 15.
    setMockSession({ running: false, stopReason: null });
    render(<Home />);

    const flame = screen.getByTestId('animated-flame');
    act(() => { fireEvent.click(flame); });

    // consumeDuration(15) should have been called — 15-min button is now locked.
    expect(_usedDurations.has(15)).toBe(true);
  });

  it('tapping a locked button does not start a session', () => {
    _usedDurations.add(5);
    setMockSession({ running: false, stopReason: null });
    render(<Home />);

    // Find the "Premium" badge button and click it
    const premiumBadge = screen.getByText('Premium');
    const lockedBtn = premiumBadge.closest('button')!;
    act(() => { fireEvent.click(lockedBtn); });

    // start() should NOT have been called
    expect(baseSession.start).not.toHaveBeenCalled();
  });
});
