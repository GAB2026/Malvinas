/**
 * Audio cues — pure Web Audio API, no asset files.
 *
 * playTherapeuticStartBeep  — single clean beep when therapy begins.
 * playCompletionChime       — microwave-style 3 beeps: short · short · long×3.
 */

async function makeCtx(): Promise<AudioContext | null> {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function beep(
  ctx: AudioContext,
  freq: number,
  startT: number,
  duration: number,
  volume = 0.35,
): void {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startT);
  gain.gain.linearRampToValueAtTime(volume, startT + 0.015);
  gain.gain.setValueAtTime(volume, startT + duration - 0.02);
  gain.gain.linearRampToValueAtTime(0, startT + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startT);
  osc.stop(startT + duration);
}

/** Single tone played when the therapeutic phase begins. */
export async function playTherapeuticStartBeep(): Promise<void> {
  const ctx = await makeCtx();
  if (!ctx) return;
  beep(ctx, 660, ctx.currentTime + 0.05, 0.22, 0.30);
  setTimeout(() => ctx.close(), 1200);
}

/**
 * Microwave-style completion signal: two short beeps then one long beep
 * (3× the duration of the short ones).
 */
export async function playCompletionChime(): Promise<void> {
  const ctx = await makeCtx();
  if (!ctx) return;

  const freq     = 880;   // A5 — clear, distinct
  const shortDur = 0.13;  // seconds
  const longDur  = shortDur * 3; // 0.39 s
  const gap      = 0.11;

  let t = ctx.currentTime + 0.05;
  for (const dur of [shortDur, shortDur, longDur]) {
    beep(ctx, freq, t, dur, 0.40);
    t += dur + gap;
  }

  setTimeout(() => ctx.close(), 3000);
}
