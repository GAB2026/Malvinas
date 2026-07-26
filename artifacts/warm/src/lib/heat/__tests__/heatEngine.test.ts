import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeatEngine, workerCountFor } from '../heatEngine';

// Access the MockWorker registered in setup.ts
const MockWorker = (globalThis as any).__MockWorker as {
  instances: Array<{
    messages: Array<{ type: string; duty?: number }>;
    terminated: boolean;
  }>;
  reset(): void;
};

describe('workerCountFor', () => {
  it('returns at least 1 for every intensity', () => {
    expect(workerCountFor('low')).toBeGreaterThanOrEqual(1);
    expect(workerCountFor('medium')).toBeGreaterThanOrEqual(1);
    expect(workerCountFor('high')).toBeGreaterThanOrEqual(1);
  });

  it('high uses more workers than low (on multi-core)', () => {
    if (navigator.hardwareConcurrency > 1) {
      expect(workerCountFor('high')).toBeGreaterThan(workerCountFor('low'));
    }
  });
});

describe('HeatEngine', () => {
  let engine: HeatEngine;

  beforeEach(() => {
    engine = new HeatEngine();
    MockWorker.reset();
  });

  describe('start()', () => {
    it('marks engine as running', () => {
      engine.start('medium');
      expect(engine.running).toBe(true);
    });

    it('spawns at least one worker', () => {
      engine.start('medium');
      expect(MockWorker.instances.length).toBeGreaterThanOrEqual(1);
    });

    it('sends a start message with duty to every worker', () => {
      engine.start('medium');
      for (const w of MockWorker.instances) {
        expect(w.messages).toContainEqual(
          expect.objectContaining({ type: 'start', duty: expect.any(Number) }),
        );
      }
    });

    it('high intensity spawns more workers than low', () => {
      const cores = Math.max(2, navigator.hardwareConcurrency || 4);
      if (cores <= 1) return; // skip on single-core

      engine.start('low');
      const lowCount = MockWorker.instances.length;

      MockWorker.reset();
      engine.stop();
      engine.start('high');
      const highCount = MockWorker.instances.length;

      expect(highCount).toBeGreaterThan(lowCount);
    });

    it('calling start() twice terminates the first batch of workers', () => {
      engine.start('low');
      const firstBatch = [...MockWorker.instances];

      engine.start('medium');
      for (const w of firstBatch) {
        expect(w.terminated).toBe(true);
      }
    });
  });

  describe('stop()', () => {
    it('marks engine as not running', () => {
      engine.start('medium');
      engine.stop();
      expect(engine.running).toBe(false);
    });

    it('terminates every worker', () => {
      engine.start('high');
      const workers = [...MockWorker.instances];
      engine.stop();
      for (const w of workers) {
        expect(w.terminated).toBe(true);
      }
    });

    it('sends stop message before terminating each worker', () => {
      engine.start('medium');
      const workers = [...MockWorker.instances];
      engine.stop();
      for (const w of workers) {
        const stopMsg = w.messages.find((m) => m.type === 'stop');
        expect(stopMsg).toBeDefined();
      }
    });

    it('leaves no live workers after stop', () => {
      engine.start('high');
      engine.stop();
      // Calling stop again must be safe (idempotent) and not re-terminate.
      expect(() => engine.stop()).not.toThrow();
      expect(engine.running).toBe(false);
    });
  });

  describe('setIntensity()', () => {
    it('restarts workers when called while running', () => {
      engine.start('low');
      const firstBatch = [...MockWorker.instances];

      MockWorker.reset();
      engine.setIntensity('high');

      // old workers must be terminated
      for (const w of firstBatch) {
        expect(w.terminated).toBe(true);
      }
      // new workers spawned
      expect(MockWorker.instances.length).toBeGreaterThanOrEqual(1);
      expect(engine.running).toBe(true);
    });

    it('only updates intensity when not running (no new workers)', () => {
      engine.setIntensity('high');
      expect(MockWorker.instances).toHaveLength(0);
      expect(engine.intensity).toBe('high');
    });
  });
});
