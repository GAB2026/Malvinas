import { useCallback, useEffect, useRef, useState } from 'react';
import { FireAudio } from '@/lib/fireAudio';
import type { Intensity } from '@/hooks/useWarmSession';

export function useFireplaceAudio() {
  const audioRef  = useRef<FireAudio | null>(null);
  const [enabled, setEnabled] = useState(true);
  const enabledRef = useRef(true);

  // Lazy-init
  if (!audioRef.current) audioRef.current = new FireAudio();

  const toggleEnabled = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      enabledRef.current = next;
      if (!next) audioRef.current?.stop();
      return next;
    });
  }, []);

  /**
   * Must be called directly from a user-gesture handler (tap on flame).
   * Initialises AudioContext (browser requires gesture), then starts playback.
   */
  const startAudio = useCallback(async (intensity: Intensity) => {
    if (!enabledRef.current) return;
    const audio = audioRef.current!;
    await audio.init();
    audio.start(intensity);
  }, []);

  const stopAudio = useCallback(() => {
    audioRef.current?.stop();
  }, []);

  const updateIntensity = useCallback((intensity: Intensity) => {
    audioRef.current?.setIntensity(intensity);
  }, []);

  const updateHeatLevel = useCallback((level: number) => {
    audioRef.current?.setHeatLevel(level);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const audio = audioRef.current!;
    return () => audio.destroy();
  }, []);

  return { enabled, toggleEnabled, startAudio, stopAudio, updateIntensity, updateHeatLevel };
}
