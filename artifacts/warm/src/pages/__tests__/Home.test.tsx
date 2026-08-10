import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── usePremium mock ──────────────────────────────────────────────────────────
// Mirrors the new PremiumHook interface:
//   isLocked(mins) = !_isPremium && mins > FREE_MINS (5)
// No consumeDuration — the lock is permanent from first launch.

let _isPremium = false;

vi.mock('@/hooks/usePremium', () => ({
  PREMIUM_PRODUCT_ID: 'warm_premium_lifetime',
  FREE_MINS: 5,
  usePremium: () => ({
    isPremium: _isPremium,
    isLocked: (mins: number) => !_isPremium && mins > 5,
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
    expect(screen.getByText(/Calibrating/i)).toBeInTheDocument();
  });

  it('shows therapeutic phase indicator when phase is therapeutic', () => {
    setMockSession({ running: true, phase: 'therapeutic', deviceTempC: 40, heatLevel: 0.6, therapeuticRemaining: 600 });
    render(<Home />);
    expect(screen.getByText(/Therapy active/i)).toBeInTheDocument();
  });
});

describe('Home — duration button lock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _isPremium = false;
    setMockSession({});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders 5-min button unlocked (free tier)', () => {
    render(<Home />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('10-min and 15-min buttons show "Premium" lock for non-premium users', () => {
    render(<Home />);
    // Two locked buttons → two "Premium" labels
    const premiumLabels = screen.getAllByText('Premium');
    expect(premiumLabels).toHaveLength(2);
    // Numbers for locked buttons are hidden
    expect(screen.queryByText('10')).not.toBeInTheDocument();
    expect(screen.queryByText('15')).not.toBeInTheDocument();
  });

  it('premium user sees all three buttons unlocked with numbers', () => {
    _isPremium = true;
    render(<Home />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.queryByText('Premium')).not.toBeInTheDocument();
  });

  it('tapping a locked duration button does not start a session', () => {
    // Default session: 15 min (locked for non-premium)
    setMockSession({ running: false, stopReason: null });
    render(<Home />);

    // Click the flame — should open paywall, NOT start
    const flame = screen.getByTestId('animated-flame');
    act(() => { fireEvent.click(flame); });

    expect(baseSession.start).not.toHaveBeenCalled();
  });

  it('tapping flame with 5-min selected (free) starts the session', () => {
    // Set session to 5 min (free)
    setMockSession({ running: false, stopReason: null, sessionDurationSecs: 5 * 60 });
    render(<Home />);

    const flame = screen.getByTestId('animated-flame');
    act(() => { fireEvent.click(flame); });

    expect(baseSession.start).toHaveBeenCalled();
  });

  it('lock is visible from the very first render — no free use required', () => {
    // Non-premium, first ever render — 10 and 15 should already be locked
    render(<Home />);
    const premiumLabels = screen.getAllByText('Premium');
    expect(premiumLabels.length).toBeGreaterThanOrEqual(1);
  });
});
