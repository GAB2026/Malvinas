import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';

// ─── usePremium mock ─────────────────────────────────────────────────────────

vi.mock('@/hooks/usePremium', () => ({
  MEDIUM_TRIAL_LIMIT: 2,
  usePremium: () => ({
    isPremium: false,
    mediumTrialsLeft: 2,
    canUseMedium: true,
    consumeMediumTrial: vi.fn(),
    purchase: vi.fn().mockResolvedValue(true),
    restore:  vi.fn().mockResolvedValue(false),
  }),
}));

// ─── useCalibration mock ──────────────────────────────────────────────────────
// Without this, Home renders CalibrationScreen (calibration=null) and none
// of the main-app UI is reachable.

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
// AnimatedFlame uses framer-motion JSX without a top-level React import, which
// causes "React is not defined" in the jsdom test environment.

vi.mock('@/components/AnimatedFlame', () => ({
  default: ({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) =>
    React.createElement('button', { onClick, disabled, 'data-testid': 'animated-flame' }, '🔥'),
}));

// ─── Chime mock ───────────────────────────────────────────────────────────────
// The Web Audio API is unavailable in jsdom; silence the completion chime.

vi.mock('@/lib/chime', () => ({
  playCompletionChime: vi.fn().mockResolvedValue(undefined),
}));

// ─── Framer-motion stub ───────────────────────────────────────────────────────

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target: object, tag: string) =>
        // eslint-disable-next-line react/display-name
        ({ children, animate, initial, exit, transition, ...rest }: any) =>
          React.createElement(tag, rest, children),
    },
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// ─── useWarmSession mock ──────────────────────────────────────────────────────

vi.mock('@/hooks/useWarmSession', () => {
  const LOW_BATTERY_CUTOFF = 0.15;
  const TARGET_TEMP_C = { low: 38, medium: 40, high: 43 };
  const THERAPEUTIC_DURATIONS = [15, 30] as const;

  return {
    LOW_BATTERY_CUTOFF,
    TARGET_TEMP_C,
    THERAPEUTIC_DURATIONS,
    useWarmSession: () => (globalThis as any).__warmSessionMock,
  };
});

// ─── Shared mutable session stub ─────────────────────────────────────────────

import type { StopReason, Phase } from '@/hooks/useWarmSession';
import Home from '../Home';

const baseSession = {
  running: false,
  intensity: 'medium' as const,
  setIntensity: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  phase: 'idle' as Phase,
  elapsed: 0,
  therapeuticElapsed: 0,
  therapeuticRemaining: 0,
  deviceTempC: 34,
  heatLevel: 0,
  stopReason: null as StopReason,
  wakeLockActive: false,
  batteryLevel: null as number | null,
  workerCount: 2,
  coolingDown: false,
  // debug fields
  dbg_thermalRaw: null as number | null,
  dbg_simTemp: 34,
  dbg_warmingBaseline: null as number | null,
  dbg_targetC: null as number | null,
  dbg_settleProgress: 0,
  dbg_ambientC: 34,
  dbg_usingRealSensor: false,
  dbg_baselineAlreadyHot: false,
  dbg_workerKOpsPerSec: null as number | null,
};

function setMockSession(overrides: Partial<typeof baseSession>) {
  (globalThis as any).__warmSessionMock = { ...baseSession, ...overrides };
}

/** The auto-dismiss delay defined in Home.tsx */
const AUTO_DISMISS_MS = 5000;

/** Render Home after configuring the mock session with the given stopReason. */
function renderWithStopReason(stopReason: StopReason) {
  setMockSession({ running: false, stopReason });
  return render(<Home />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Home — auto-stop toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setMockSession({});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ── Correct message for each auto-stop reason ────────────────────────────

  it('shows "Therapeutic session complete" for time-limit stop', () => {
    renderWithStopReason('time-limit');
    expect(screen.getByText('Therapeutic session complete')).toBeInTheDocument();
  });

  it('shows "Battery too low — session stopped" for low-battery stop', () => {
    renderWithStopReason('low-battery');
    expect(screen.getByText('Battery too low — session stopped')).toBeInTheDocument();
  });

  // ── No toast on manual stop ───────────────────────────────────────────────

  it('does NOT show a toast when the stop reason is "user"', () => {
    renderWithStopReason('user');
    expect(screen.queryByText('Therapeutic session complete')).not.toBeInTheDocument();
    expect(screen.queryByText('Battery too low — session stopped')).not.toBeInTheDocument();
  });

  it('shows no toast when stopReason is null (initial / idle state)', () => {
    renderWithStopReason(null);
    expect(
      screen.queryByText(/session complete|too low|background/),
    ).not.toBeInTheDocument();
  });

  // ── Auto-dismiss after 5 s ────────────────────────────────────────────────

  it('toast disappears after AUTO_DISMISS_MS (5 s)', () => {
    renderWithStopReason('time-limit');
    expect(screen.getByText('Therapeutic session complete')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(AUTO_DISMISS_MS + 100);
    });

    expect(screen.queryByText('Therapeutic session complete')).not.toBeInTheDocument();
  });

  it('toast is still visible just before the dismiss timeout', () => {
    renderWithStopReason('low-battery');
    act(() => {
      vi.advanceTimersByTime(AUTO_DISMISS_MS - 500);
    });
    expect(screen.getByText('Battery too low — session stopped')).toBeInTheDocument();
  });

  // ── Temperature display (debug overlay) ──────────────────────────────────

  it('shows device temperature in the debug overlay', () => {
    setMockSession({ deviceTempC: 36 });
    render(<Home />);
    // DebugOverlay "shown temp" row: fmt(deviceTempC)°C → "36.0°C"
    expect(screen.getByText('36.0°C')).toBeInTheDocument();
  });

  // ── Intensity card minutes ────────────────────────────────────────────────

  it('renders intensity cards with calibration-derived minute values', () => {
    setMockSession({});
    render(<Home />);
    // Calibration mock: lowMinutes=35, mediumMinutes=20, highMinutes=10
    expect(screen.getByText('35')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  // ── Phase labels ──────────────────────────────────────────────────────────

  it('shows warming phase indicator when phase is warming', () => {
    setMockSession({ running: true, phase: 'warming', deviceTempC: 36, heatLevel: 0.1 });
    render(<Home />);
    // Phase label is rendered as "Heating up… 00:00" (with elapsed time suffix);
    // use a regex so the timer portion doesn't break the match.
    expect(screen.getByText(/Heating up/)).toBeInTheDocument();
  });

  it('shows therapeutic phase indicator when phase is therapeutic', () => {
    setMockSession({
      running: true,
      phase: 'therapeutic',
      deviceTempC: 40,
      heatLevel: 0.6,
      therapeuticRemaining: 600,
    });
    render(<Home />);
    // Label is "Therapy active · MM:SS"; use regex to match regardless of timer.
    expect(screen.getByText(/Therapy active/)).toBeInTheDocument();
  });
});
