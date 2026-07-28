import React, { useEffect, useState } from 'react';
import { useWarmSession, StopReason, Intensity } from '@/hooks/useWarmSession';
import { useFireplaceAudio } from '@/hooks/useFireplaceAudio';
import { useCalibration } from '@/hooks/useCalibration';
import { useTranslations } from '@/lib/i18n';
import { usePremium, MEDIUM_TRIAL_LIMIT } from '@/hooks/usePremium';
import PremiumSheet from '@/components/PremiumSheet';
import AnimatedFlame from '@/components/AnimatedFlame';
import { Battery, AlertTriangle, ShieldAlert, Sparkles, Lock, Thermometer, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AUTO_DISMISS_MS = 5000;

function cToF(c: number): number { return (c * 9) / 5 + 32; }

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ── Calibration screen ────────────────────────────────────────────────────────
function CalibrationScreen({ progress }: { progress: number }) {
  const t = useTranslations();
  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background px-8 gap-8">
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        animate={{ opacity: [0.05, 0.12, 0.05] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      >
        <div className="w-[70vw] h-[70vw] rounded-full bg-primary/30 blur-[80px]" />
      </motion.div>

      <div className="z-10 flex flex-col items-center gap-6 w-full max-w-xs text-center">
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          <Thermometer size={48} className="text-primary" />
        </motion.div>

        <div className="flex flex-col gap-2">
          <p className="text-lg font-medium text-foreground leading-snug">
            {t.calibrating}
          </p>
          <p className="text-sm text-muted-foreground">{t.calibratingNote}</p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${Math.round(progress * 100)}%` }}
            transition={{ duration: 0.8, ease: 'linear' }}
          />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {Math.round(progress * 100)}%
        </p>
      </div>
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
export default function Home() {
  const t = useTranslations();
  const { isPremium, mediumTrialsLeft, canUseMedium, consumeMediumTrial } = usePremium();
  const [showPremiumSheet, setShowPremiumSheet] = useState(false);
  const { result: calibration, calibrating, progress } = useCalibration();
  const { enabled: soundEnabled, toggleEnabled: toggleSound, startAudio, stopAudio, updateIntensity: updateAudioIntensity, updateHeatLevel } = useFireplaceAudio();

  const {
    running, intensity, setIntensity, start, stop,
    phase, elapsed, therapeuticRemaining,
    deviceTempC, heatLevel, stopReason,
    wakeLockActive, batteryLevel, workerCount, coolingDown,
  } = useWarmSession(calibration);

  const [toastReason, setToastReason] = useState<StopReason>(null);

  useEffect(() => { if (running) setToastReason(null); }, [running]);
  useEffect(() => {
    if (stopReason && stopReason !== 'user') {
      setToastReason(stopReason);
      const id = setTimeout(() => setToastReason(null), AUTO_DISMISS_MS);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [stopReason]);

  // ── Premium / gate logic ──────────────────────────────────────────────────
  const mediumHasTrials = !isPremium && mediumTrialsLeft > 0;
  const mediumLocked    = !isPremium && mediumTrialsLeft === 0;

  const handleFlameClick = () => {
    if (running) { stop(); stopAudio(); return; }
    if (coolingDown) return;
    if (intensity === 'high' && !isPremium) { setShowPremiumSheet(true); return; }
    if (intensity === 'medium' && !canUseMedium) { setShowPremiumSheet(true); return; }
    if (intensity === 'medium' && !isPremium) consumeMediumTrial();
    start();
    void startAudio(intensity);
  };

  // Sync audio when heatLevel changes
  useEffect(() => { if (running) updateHeatLevel(heatLevel); }, [heatLevel, running, updateHeatLevel]);

  // Stop audio on auto-stop
  useEffect(() => { if (!running && stopReason && stopReason !== 'user') stopAudio(); }, [running, stopReason, stopAudio]);

  const handleIntensityClick = (level: Intensity) => {
    if (running) return;
    if (level === 'high' && !isPremium) { setShowPremiumSheet(true); return; }
    if (level === 'medium' && !canUseMedium) { setShowPremiumSheet(true); return; }
    setIntensity(level);
  };

  // ── Calibration screen ────────────────────────────────────────────────────
  if (calibrating || !calibration) {
    return <CalibrationScreen progress={progress} />;
  }

  const tempC = Math.round(deviceTempC * 10) / 10;
  const tempF = Math.round(cToF(deviceTempC) * 10) / 10;

  const minutes = (i: Intensity) =>
    i === 'high' ? calibration.highMinutes
    : i === 'medium' ? calibration.mediumMinutes
    : calibration.lowMinutes;

  const intensities: Intensity[] = ['low', 'medium', 'high'];
  const intensityLabels: Record<Intensity, string> = {
    low: t.low, medium: t.medium, high: t.high,
  };

  const glowIntensity = running ? 0.15 + heatLevel * 0.85 : 0;

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center overflow-hidden bg-background px-5 py-10">

      {/* Background glow */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        animate={{ opacity: glowIntensity }}
        transition={{ duration: 1.2 }}
      >
        <div className="w-[85vw] h-[85vw] max-w-lg rounded-full bg-primary/25 blur-[110px]" />
      </motion.div>

      {/* Header */}
      <div className="z-10 flex flex-col items-center mb-2">
        <h1 className="text-2xl font-medium tracking-wide text-foreground">Warm</h1>
        <p className="text-muted-foreground text-xs mt-0.5">{t.tagline}</p>
      </div>

      {/* Toast */}
      <div className="z-10 h-9 w-full max-w-sm flex items-center justify-center mt-1">
        <AnimatePresence>
          {toastReason && (
            <motion.div key={toastReason}
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-1.5 rounded-full border border-destructive/20 text-xs">
              <AlertTriangle size={13} /> {t.autoStop[toastReason]}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Flame ── */}
      <div className="z-10 flex flex-col items-center flex-1 justify-center gap-5">
        <AnimatedFlame
          intensity={intensity}
          heatLevel={heatLevel}
          running={running}
          onClick={handleFlameClick}
          disabled={coolingDown && !running}
        />

        {/* Temp + phase */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-baseline gap-1.5">
            <motion.span
              key={Math.floor(tempC)}
              className="text-4xl font-light tabular-nums text-foreground"
              initial={{ opacity: 0.6 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
            >
              {tempC.toFixed(1)}
            </motion.span>
            <span className="text-lg text-muted-foreground font-light">°C</span>
            <span className="text-base text-muted-foreground/60 font-light ml-1">
              {tempF.toFixed(1)}°F
            </span>
          </div>

          <AnimatePresence mode="wait">
            {coolingDown && (
              <motion.span key="cooling"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-xs text-sky-400 font-medium flex items-center gap-1.5">
                <RefreshCw size={11} className="animate-spin" />
                {t.cooling}
              </motion.span>
            )}
            {!coolingDown && phase === 'warming' && (
              <motion.span key="warming"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                {t.phaseWarming}
              </motion.span>
            )}
            {!coolingDown && phase === 'therapeutic' && (
              <motion.span key="therapeutic"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-xs text-primary font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                {t.phaseTherapeutic} · {formatTime(therapeuticRemaining)}
              </motion.span>
            )}
            {!coolingDown && phase === 'idle' && (
              <motion.span key="idle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-xs text-muted-foreground">
                {t.tapToStart}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Intensity cards ── */}
      <div className="z-10 w-full max-w-sm flex flex-col gap-3 mt-4">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            {t.intensity}
          </span>
          {calibration.usingRealSensor && (
            <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
              <Thermometer size={10} /> {t.calibratedDevice}
            </span>
          )}
        </div>

        <div className="flex gap-2.5">
          {intensities.map((level) => {
            const active  = intensity === level && !running || intensity === level && running;
            const locked  = level === 'high' && !isPremium || level === 'medium' && mediumLocked;
            const hasTrial = level === 'medium' && mediumHasTrials;
            const mins    = minutes(level);

            return (
              <button
                key={level}
                onClick={() => handleIntensityClick(level)}
                disabled={running || locked}
                className={`flex-1 flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl border transition-all duration-300
                  disabled:cursor-not-allowed
                  ${active
                    ? 'bg-[#1e1410] border-orange-700 shadow-[0_0_18px_rgba(194,65,12,0.3)]'
                    : locked
                    ? 'border-white/5 bg-card opacity-40'
                    : 'border-white/8 bg-card hover:border-white/15 hover:bg-white/5'
                  }`}
              >
                {/* Label row */}
                <span className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-1
                  ${active ? 'text-orange-400' : 'text-muted-foreground'}`}>
                  {locked && <Lock size={9} />}
                  {hasTrial && !running && <Sparkles size={9} className="text-amber-400" />}
                  {level === 'high' && active && '🔥 '}
                  {intensityLabels[level]}
                </span>

                {/* Minutes */}
                <span className={`text-3xl font-bold leading-none tabular-nums
                  ${active ? 'text-white' : 'text-foreground/25'}`}>
                  {mins}
                </span>
                <span className={`text-[10px] font-medium ${active ? 'text-orange-400/80' : 'text-muted-foreground/40'}`}>
                  min
                </span>
              </button>
            );
          })}
        </div>

        {/* Trial hint */}
        <AnimatePresence>
          {!running && mediumHasTrials && intensity === 'medium' && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center text-xs text-amber-400 flex items-center justify-center gap-1.5">
              <Sparkles size={11} />
              {mediumTrialsLeft} / {MEDIUM_TRIAL_LIMIT} {t.trial.left}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      <div className="z-10 w-full max-w-sm flex flex-col gap-4 mt-6">
        <div className="flex justify-center gap-5 text-xs text-muted-foreground">
          {batteryLevel !== null && (
            <div className="flex items-center gap-1.5">
              <Battery size={13} className={batteryLevel <= 0.2 ? 'text-destructive' : ''} />
              <span className={batteryLevel <= 0.2 ? 'text-destructive font-medium' : ''}>
                {Math.round(batteryLevel * 100)}%
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${wakeLockActive ? 'bg-primary' : 'bg-muted'}`} />
            <span>{wakeLockActive ? t.screenAwake : t.screenSleep}</span>
          </div>
          {running && (
            <span className="font-mono">{formatTime(elapsed)}</span>
          )}
          <button
            onClick={toggleSound}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={soundEnabled ? t.soundOn : t.soundOff}
          >
            {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span>{soundEnabled ? t.soundOn : t.soundOff}</span>
          </button>
        </div>

        <div className="flex gap-3 bg-black/20 p-3.5 rounded-2xl border border-white/5 items-start">
          <ShieldAlert size={15} className="text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground/70 font-medium">{t.safetyTitle}:</strong>{' '}
            {t.safetyBody}
          </p>
        </div>
      </div>

      <PremiumSheet open={showPremiumSheet} onClose={() => setShowPremiumSheet(false)} />
    </div>
  );
}
