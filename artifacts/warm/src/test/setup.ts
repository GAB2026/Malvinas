import '@testing-library/jest-dom';

// jsdom logs a noisy "Not implemented" error for canvas.getContext; silence it.
// GpuLoad already handles null gracefully — this just keeps test output clean.
HTMLCanvasElement.prototype.getContext = function () {
  return null;
} as typeof HTMLCanvasElement.prototype.getContext;

// Mock Worker globally — jsdom doesn't provide it.
class MockWorker {
  static instances: MockWorker[] = [];
  messages: Array<{ type: string; duty?: number }> = [];
  terminated = false;

  constructor(public url: URL | string, public options?: WorkerOptions) {
    MockWorker.instances.push(this);
  }

  postMessage(msg: { type: string; duty?: number }) {
    this.messages.push(msg);
  }

  terminate() {
    this.terminated = true;
  }

  // Clear instance registry between tests.
  static reset() {
    MockWorker.instances = [];
  }
}

// @ts-expect-error – Worker not typed on globalThis in tests
globalThis.Worker = MockWorker;
// Export so tests can import it directly.
(globalThis as any).__MockWorker = MockWorker;

// Mock requestAnimationFrame / cancelAnimationFrame for GpuLoad.
let rafId = 0;
const pendingRafs = new Map<number, FrameRequestCallback>();

globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
  const id = ++rafId;
  pendingRafs.set(id, cb);
  return id;
};
globalThis.cancelAnimationFrame = (id: number) => {
  pendingRafs.delete(id);
};

// Expose a helper to flush one rAF tick in tests.
(globalThis as any).__flushRaf = () => {
  const entries = [...pendingRafs.entries()];
  pendingRafs.clear();
  for (const [, cb] of entries) cb(performance.now());
};

// Silence noisy console output during tests.
beforeEach(() => {
  MockWorker.reset();
});
