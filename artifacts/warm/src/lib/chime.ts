/**
 * Plays a short three-note ascending chime to signal session completion.
 * Pure Web Audio API — no asset files.
 */
export async function playCompletionChime(): Promise<void> {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();

    const notes = [523.25, 659.25, 783.99]; // C5 – E5 – G5
    let t = ctx.currentTime + 0.05;

    for (const freq of notes) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
      t += 0.2;
    }

    setTimeout(() => ctx.close(), 2500);
  } catch {
    // Silently ignore if AudioContext unavailable
  }
}
