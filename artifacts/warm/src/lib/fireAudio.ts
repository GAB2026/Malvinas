/**
 * Fireplace audio synthesizer — pure Web Audio API, no asset files.
 *
 * Architecture:
 *   • Base layer  — pink noise → low-pass (80–300 Hz) → base roar
 *   • Mid layer   — white noise → band-pass (300–900 Hz) → crackling bed
 *   • Pop layer   — random impulses via scheduled white-noise bursts
 *   • All layers feed through a master gain node that fades in/out smoothly.
 */

type Intensity = 'low' | 'medium' | 'high';

// Per-intensity tuning
const SETTINGS: Record<Intensity, { baseGain: number; midGain: number; popRate: number; popGain: number }> = {
  low:    { baseGain: 0.08, midGain: 0.04, popRate: 0.6,  popGain: 0.25 },
  medium: { baseGain: 0.14, midGain: 0.08, popRate: 1.2,  popGain: 0.40 },
  high:   { baseGain: 0.22, midGain: 0.14, popRate: 2.2,  popGain: 0.60 },
};

/** Duration of each noise buffer (seconds). */
const NOISE_BUF_SECS = 4;
const SAMPLE_RATE    = 44100;

function makePinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const buf  = ctx.createBuffer(1, SAMPLE_RATE * NOISE_BUF_SECS, SAMPLE_RATE);
  const data = buf.getChannelData(0);
  // Paul Kellett's pink noise approximation
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    b6 = white * 0.115926;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
  }
  return buf;
}

function makeWhiteNoiseBuffer(ctx: AudioContext, durationMs: number): AudioBuffer {
  const frames = Math.floor((durationMs / 1000) * SAMPLE_RATE);
  const buf    = ctx.createBuffer(1, frames, SAMPLE_RATE);
  const data   = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export class FireAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  // Continuous layers
  private baseSrc:  AudioBufferSourceNode | null = null;
  private midSrc:   AudioBufferSourceNode | null = null;
  private baseGain: GainNode | null = null;
  private midGain:  GainNode | null = null;

  // Pop scheduling
  private popTimer: ReturnType<typeof setTimeout> | null = null;
  private popBuf:   AudioBuffer | null = null;
  private running = false;
  private _intensity: Intensity = 'medium';
  private _heatLevel = 0;

  /** Initialise (or resume) AudioContext. Must be called from a user gesture. */
  async init(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  start(intensity: Intensity): void {
    this._intensity = intensity;
    if (this.running || !this.ctx) return;
    this.running = true;
    this._buildGraph();
    this._schedulePops();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this._clearPops();

    const now = this.ctx?.currentTime ?? 0;
    this.master?.gain.setTargetAtTime(0, now, 0.4);
    setTimeout(() => this._tearDown(), 800);
  }

  setIntensity(intensity: Intensity): void {
    this._intensity = intensity;
    this._applyIntensity();
  }

  /** Call every tick (0–1) to smoothly scale volume with heatLevel. */
  setHeatLevel(level: number): void {
    this._heatLevel = level;
    this._applyIntensity();
  }

  private _buildGraph(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.setValueAtTime(0, ctx.currentTime);
    this.master.connect(ctx.destination);

    // ── Base layer (low roar) ──────────────────────────────────────────────
    const pinkBuf  = makePinkNoiseBuffer(ctx);
    this.baseSrc   = ctx.createBufferSource();
    this.baseSrc.buffer = pinkBuf;
    this.baseSrc.loop   = true;

    const lpf = ctx.createBiquadFilter();
    lpf.type            = 'lowpass';
    lpf.frequency.value = 220;
    lpf.Q.value         = 0.7;

    this.baseGain = ctx.createGain();
    this.baseSrc.connect(lpf).connect(this.baseGain).connect(this.master);
    this.baseSrc.start();

    // ── Mid layer (crackle bed) ───────────────────────────────────────────
    const whiteBuf = makeWhiteNoiseBuffer(ctx, NOISE_BUF_SECS * 1000);
    this.midSrc    = ctx.createBufferSource();
    this.midSrc.buffer = whiteBuf;
    this.midSrc.loop   = true;

    const bpf = ctx.createBiquadFilter();
    bpf.type            = 'bandpass';
    bpf.frequency.value = 600;
    bpf.Q.value         = 1.2;

    this.midGain = ctx.createGain();
    this.midSrc.connect(bpf).connect(this.midGain).connect(this.master);
    this.midSrc.start();

    // Pop buffer (short, reused)
    this.popBuf = makeWhiteNoiseBuffer(ctx, 35);

    this._applyIntensity(true /* immediate */);
  }

  private _applyIntensity(immediate = false): void {
    if (!this.ctx || !this.master || !this.baseGain || !this.midGain) return;
    const s    = SETTINGS[this._intensity];
    const heat = Math.max(0.15, this._heatLevel); // min audibility once started
    const now  = this.ctx.currentTime;
    const t    = immediate ? now : now + 0.5;

    if (immediate) {
      this.master.gain.setValueAtTime(1, now);
      this.baseGain.gain.setValueAtTime(s.baseGain * heat, now);
      this.midGain.gain.setValueAtTime(s.midGain * heat, now);
    } else {
      this.master.gain.setTargetAtTime(1, now, 0.5);
      this.baseGain.gain.setTargetAtTime(s.baseGain * heat, t, 0.5);
      this.midGain.gain.setTargetAtTime(s.midGain * heat, t, 0.5);
    }
  }

  private _schedulePops(): void {
    if (!this.running || !this.ctx || !this.popBuf) return;
    const s       = SETTINGS[this._intensity];
    const heat    = Math.max(0.2, this._heatLevel);
    const minGap  = 1000 / s.popRate;                  // ms between pops at full rate
    const jitter  = minGap * (0.3 + Math.random() * 1.4); // ×0.3–1.7
    const delay   = Math.max(120, minGap + jitter);

    this.popTimer = setTimeout(() => {
      if (!this.running || !this.ctx || !this.popBuf) return;
      // One pop: short white noise burst through high-pass
      const src  = this.ctx.createBufferSource();
      src.buffer = this.popBuf;

      const hpf = this.ctx.createBiquadFilter();
      hpf.type            = 'highpass';
      hpf.frequency.value = 1200 + Math.random() * 2000;

      const pg = this.ctx.createGain();
      pg.gain.setValueAtTime(s.popGain * heat * (0.6 + Math.random() * 0.8), this.ctx.currentTime);

      src.connect(hpf).connect(pg).connect(this.master!);
      src.start();
      src.onended = () => { pg.disconnect(); };

      this._schedulePops();
    }, delay);
  }

  private _clearPops(): void {
    if (this.popTimer) { clearTimeout(this.popTimer); this.popTimer = null; }
  }

  private _tearDown(): void {
    try { this.baseSrc?.stop(); } catch { /* already stopped */ }
    try { this.midSrc?.stop();  } catch { /* already stopped */ }
    this.baseSrc = null;
    this.midSrc  = null;
    this.baseGain = null;
    this.midGain  = null;
    this.popBuf   = null;
  }

  destroy(): void {
    this.stop();
    setTimeout(() => { this.ctx?.close(); this.ctx = null; }, 1000);
  }
}
