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

import type { StopReason } from '@/hooks/useWarmSession';
import Home from '../Home';

const baseSession = {
  running: false,
  intensity: 'medium' as const,
  setIntensity: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  phase: 'idle' as const,
  elapsed: 0,
  therapeuticElapsed: 0,
  therapeuticRemaining: 0,
  deviceTempC: 34,
  heatLevel: 0,
  stopReason: null as StopReason,
  wakeLockActive: false,
  batteryLevel: null as number | null,
  workerCount: 2,
  sessionDurationMin: 15 as const,
  setSessionDuration: vi.fn(),
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

  it('shows "Stopped: app moved to background" for tab-hidden stop', () => {
    renderWithStopReason('tab-hidden');
    expect(screen.getByText('Stopped: app moved to background')).toBeInTheDocument();
  });

  // ── No toast on manual stop ───────────────────────────────────────────────

  it('does NOT show a toast when the stop reason is "user"', () => {
    renderWithStopReason('user');
    expect(screen.queryByText('Therapeutic session complete')).not.toBeInTheDocument();
    expect(screen.queryByText('Battery too low — session stopped')).not.toBeInTheDocument();
    expect(screen.queryByText('Stopped: app moved to background')).not.toBeInTheDocument();
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
    renderWithStopReason('tab-hidden');
    act(() => {
      vi.advanceTimersByTime(AUTO_DISMISS_MS - 500);
    });
    expect(screen.getByText('Stopped: app moved to background')).toBeInTheDocument();
  });

  // ── Temperature display ───────────────────────────────────────────────────

  it('shows device temperature in °C and °F', () => {
    setMockSession({ deviceTempC: 34 });
    render(<Home />);
    expect(screen.getByText('34.0')).toBeInTheDocument();
    // 34°C = 93.2°F
    expect(screen.getByText('93.2')).toBeInTheDocument();
  });

  // ── Session duration selector ─────────────────────────────────────────────

  it('renders 15 min and 30 min session duration buttons', () => {
    setMockSession({});
    render(<Home />);
    expect(screen.getByText('15 min')).toBeInTheDocument();
    expect(screen.getByText('30 min')).toBeInTheDocument();
  });

  // ── Phase labels ──────────────────────────────────────────────────────────

  it('shows warming phase indicator when phase is warming', () => {
    setMockSession({ running: true, phase: 'warming', deviceTempC: 36, heatLevel: 0.1 });
    render(<Home />);
    // "Heating up…" appears in both the phase badge and the button label — at least one must be present
    expect(screen.getAllByText('Heating up…').length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getByText('Therapy active')).toBeInTheDocument();
  });
});
