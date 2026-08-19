import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── usePremium mock ──────────────────────────────────────────────────────────
// All three buttons: one free use each, then locked.
// isLocked(mins) = !_isPremium && _usedDurations.has(mins)

const _usedDurations = new Set<number>();
let _isPremium = false;
const premiumMocks = vi.hoisted(() => ({
  purchase: vi.fn(),
  restore: vi.fn(),
}));

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
    purchase: premiumMocks.purchase,
    restore: premiumMocks.restore,
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
    premiumMocks.purchase.mockResolvedValue(true);
    premiumMocks.restore.mockResolvedValue(false);
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

  it('shows the safety warning modal (not a toast) for low-battery stop', () => {
    // Low-battery now opens a persistent modal sheet with the safety notice,
    // not the auto-dismissing toast used for other stop reasons.
    renderWithStopReason('low-battery');
    expect(screen.queryByText('Battery too low — session stopped')).not.toBeInTheDocument();
    expect(screen.getByText('Safety Notice')).toBeInTheDocument();
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

  it('safety modal stays visible until dismissed (no auto-timeout for low-battery)', () => {
    renderWithStopReason('low-battery');
    // Advance well past AUTO_DISMISS_MS — modal must still be present
    act(() => { vi.advanceTimersByTime(AUTO_DISMISS_MS + 5000); });
    expect(screen.getByText('Safety Notice')).toBeInTheDocument();
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
    _usedDurations.clear();
    _isPremium = false;
    premiumMocks.purchase.mockResolvedValue(true);
    premiumMocks.restore.mockResolvedValue(false);
    setMockSession({});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('all three buttons show their numbers on first launch (nothing locked)', () => {
    render(<Home />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.queryByText('Premium')).not.toBeInTheDocument();
  });

  it('a button shows "Premium" after its free use is consumed', () => {
    _usedDurations.add(10);
    render(<Home />);
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.queryByText('10')).not.toBeInTheDocument();
    // Others still show numbers
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('all three show "Premium" when all are consumed', () => {
    _usedDurations.add(5);
    _usedDurations.add(10);
    _usedDurations.add(15);
    render(<Home />);
    expect(screen.getAllByText('Premium')).toHaveLength(3);
    expect(screen.queryByText('5')).not.toBeInTheDocument();
    expect(screen.queryByText('10')).not.toBeInTheDocument();
    expect(screen.queryByText('15')).not.toBeInTheDocument();
  });

  it('premium user sees all three buttons with numbers', () => {
    _isPremium = true;
    _usedDurations.add(5);
    _usedDurations.add(10);
    _usedDurations.add(15);
    render(<Home />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.queryByText('Premium')).not.toBeInTheDocument();
  });

  it('tapping flame starts the session when button is unlocked', () => {
    setMockSession({ running: false, stopReason: null, sessionDurationSecs: 5 * 60 });
    render(<Home />);
    act(() => { fireEvent.click(screen.getByTestId('animated-flame')); });
    expect(baseSession.start).toHaveBeenCalled();
  });

  it('tapping flame does NOT start when button is locked', () => {
    _usedDurations.add(15);
    setMockSession({ running: false, stopReason: null, sessionDurationSecs: 15 * 60 });
    render(<Home />);
    act(() => { fireEvent.click(screen.getByTestId('animated-flame')); });
    expect(baseSession.start).not.toHaveBeenCalled();
  });

  it('tapping a "Premium" button directly does not start the session', () => {
    _usedDurations.add(5);
    render(<Home />);
    const lockedBtn = screen.getByText('Premium').closest('button')!;
    act(() => { fireEvent.click(lockedBtn); });
    expect(baseSession.start).not.toHaveBeenCalled();
  });

  it('keeps the paywall open and explains when Google Play cannot start a purchase', async () => {
    premiumMocks.purchase.mockResolvedValueOnce(false);
    _usedDurations.add(5);
    render(<Home />);

    act(() => { fireEvent.click(screen.getByText('Premium').closest('button')!); });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unlock now' }));
    });

    expect(screen.getByText('Unlock Premium')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Google Play could not start the purchase',
    );
  });
});
