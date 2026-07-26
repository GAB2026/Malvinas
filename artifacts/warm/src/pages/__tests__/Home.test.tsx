import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';

// ─── Framer-motion stub ───────────────────────────────────────────────────────
// Replace animated primitives with plain HTML elements so tests don't need a
// real browser rendering pipeline. AnimatePresence just renders its children.

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
// vi.mock factories are hoisted, so we cannot reference module-level variables
// inside them. Use plain literals for constant values.

vi.mock('@/hooks/useWarmSession', () => {
  const SESSION_LIMIT_SECONDS = 900; // 15 * 60
  const LOW_BATTERY_CUTOFF = 0.15;

  // The factory returns a module-like object. We store the session shape on
  // the factory's returned object so individual tests can override it by
  // replacing __mockSession on the module itself (accessed via vi.mocked /
  // importActual pattern). Instead, we use a shared mutable ref exposed below.
  return {
    SESSION_LIMIT_SECONDS,
    LOW_BATTERY_CUTOFF,
    // useWarmSession reads from the shared mutable ref defined below.
    // We can't reference it here (hoisted), so we defer via a global shim.
    useWarmSession: () => (globalThis as any).__warmSessionMock,
  };
});

// ─── Shared mutable session stub ─────────────────────────────────────────────

import type { StopReason } from '@/hooks/useWarmSession';
import Home from '../Home';

const SESSION_LIMIT_SECONDS = 900;

const baseSession = {
  running: false,
  intensity: 'medium' as const,
  setIntensity: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  elapsed: 0,
  remaining: SESSION_LIMIT_SECONDS,
  heatLevel: 0,
  stopReason: null as StopReason,
  wakeLockActive: false,
  batteryLevel: null as number | null,
  workerCount: 2,
};

function setMockSession(overrides: Partial<typeof baseSession>) {
  (globalThis as any).__warmSessionMock = { ...baseSession, ...overrides };
}

/** The auto-dismiss delay defined in Home.tsx */
const AUTO_DISMISS_MS = 4000;

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

  it('shows "15-minute limit reached" for time-limit stop', () => {
    renderWithStopReason('time-limit');
    expect(screen.getByText('15-minute limit reached')).toBeInTheDocument();
  });

  it('shows "Battery too low to continue" for low-battery stop', () => {
    renderWithStopReason('low-battery');
    expect(screen.getByText('Battery too low to continue')).toBeInTheDocument();
  });

  it('shows "Stopped because you switched tabs" for tab-hidden stop', () => {
    renderWithStopReason('tab-hidden');
    expect(
      screen.getByText('Stopped because you switched tabs'),
    ).toBeInTheDocument();
  });

  // ── No toast on manual stop ───────────────────────────────────────────────

  it('does NOT show a toast when the stop reason is "user"', () => {
    renderWithStopReason('user');
    expect(screen.queryByText('15-minute limit reached')).not.toBeInTheDocument();
    expect(screen.queryByText('Battery too low to continue')).not.toBeInTheDocument();
    expect(screen.queryByText('Stopped because you switched tabs')).not.toBeInTheDocument();
  });

  it('shows no toast when stopReason is null (initial / idle state)', () => {
    renderWithStopReason(null);
    expect(
      screen.queryByText(/limit reached|too low|switched tabs/),
    ).not.toBeInTheDocument();
  });

  // ── Auto-dismiss after 4 s ────────────────────────────────────────────────

  it('toast disappears after AUTO_DISMISS_MS (4 s)', () => {
    renderWithStopReason('time-limit');
    // Message should be visible immediately.
    expect(screen.getByText('15-minute limit reached')).toBeInTheDocument();

    // Fast-forward past the auto-dismiss timeout; wrap in act so React
    // processes the setState call triggered by the setTimeout callback.
    act(() => {
      vi.advanceTimersByTime(AUTO_DISMISS_MS + 100);
    });

    // Message should now be gone.
    expect(screen.queryByText('15-minute limit reached')).not.toBeInTheDocument();
  });

  it('toast is still visible just before the dismiss timeout', () => {
    renderWithStopReason('tab-hidden');
    act(() => {
      vi.advanceTimersByTime(AUTO_DISMISS_MS - 500);
    });
    expect(
      screen.getByText('Stopped because you switched tabs'),
    ).toBeInTheDocument();
  });
});
