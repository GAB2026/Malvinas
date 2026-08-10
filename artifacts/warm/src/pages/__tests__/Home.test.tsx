import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── usePremium mock ──────────────────────────────────────────────────────────
// Combined model:
//   - 5 min: free until consumeDuration(5) is called, then locked
//   - 10, 15 min: always locked for non-premium users
//   isLocked(mins) = !_isPremium && (mins > 5 || _usedDurations.has(mins))

const _usedDurations = new Set<number>();
let _isPremium = false;

vi.mock('@/hooks/usePremium', () => ({
  PREMIUM_PRODUCT_ID: 'warm_premium_lifetime',
  FREE_MINS: 5,
  usePremium: () => ({
    isPremium: _isPremium,
    usedDurations: _usedDurations,
    isLocked: (mins: number) => !_isPremium && (mins > 5 || _usedDurations.has(mins)),
    consumeDuration: (mins: number) => {
      if (_isPremium || _usedDurations.has(mins) || mins > 5) return;
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
    setMockSession({});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('5-min button renders its number (unlocked on first launch)', () => {
    render(<Home />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('10-min and 15-min buttons show "Premium" lock from first launch', () => {
    render(<Home />);
    const premiumLabels = screen.getAllByText('Premium');
    expect(premiumLabels).toHaveLength(2);
    expect(screen.queryByText('10')).not.toBeInTheDocument();
    expect(screen.queryByText('15')).not.toBeInTheDocument();
  });

  it('5-min button shows "Premium" after its free use is consumed', () => {
    _usedDurations.add(5);
    render(<Home />);
    // All three locked → three "Premium" labels
    const premiumLabels = screen.getAllByText('Premium');
    expect(premiumLabels).toHaveLength(3);
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });

  it('premium user sees all three buttons with numbers', () => {
    _isPremium = true;
    render(<Home />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.queryByText('Premium')).not.toBeInTheDocument();
  });

  it('tapping flame with 5-min selected starts the session (first free use)', () => {
    setMockSession({ running: false, stopReason: null, sessionDurationSecs: 5 * 60 });
    render(<Home />);
    const flame = screen.getByTestId('animated-flame');
    act(() => { fireEvent.click(flame); });
    expect(baseSession.start).toHaveBeenCalled();
  });

  it('tapping flame with 5-min already used does NOT start (shows paywall)', () => {
    _usedDurations.add(5);
    setMockSession({ running: false, stopReason: null, sessionDurationSecs: 5 * 60 });
    render(<Home />);
    const flame = screen.getByTestId('animated-flame');
    act(() => { fireEvent.click(flame); });
    expect(baseSession.start).not.toHaveBeenCalled();
  });

  it('tapping flame with 15-min selected (always locked) does NOT start', () => {
    setMockSession({ running: false, stopReason: null, sessionDurationSecs: 15 * 60 });
    render(<Home />);
    const flame = screen.getByTestId('animated-flame');
    act(() => { fireEvent.click(flame); });
    expect(baseSession.start).not.toHaveBeenCalled();
  });

  it('tapping a "Premium" button directly does not start the session', () => {
    render(<Home />);
    const premiumLabel = screen.getAllByText('Premium')[0];
    const lockedBtn = premiumLabel.closest('button')!;
    act(() => { fireEvent.click(lockedBtn); });
    expect(baseSession.start).not.toHaveBeenCalled();
  });
});
