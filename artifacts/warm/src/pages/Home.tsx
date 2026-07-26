import React, { useEffect, useState } from 'react';
import {
  useWarmSession,
  StopReason,
  Intensity,
  TARGET_TEMP_C,
  THERAPEUTIC_DURATIONS,
  TherapeuticDuration,
} from '@/hooks/useWarmSession';
import { useTranslations } from '@/lib/i18n';
import { usePremium, FREE_SESSION_LIMIT } from '@/hooks/usePremium';
import PremiumSheet from '@/components/PremiumSheet';
import {
  Flame, Battery, Cpu, AlertTriangle, ShieldAlert, Thermometer, Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AUTO_DISMISS_MS = 5000;

function cToF(c: number): number { return (c * 9) / 5 + 32; }

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function Home() {
  const t = useTranslations();
  const { isPremium, freeSessionsLeft, canStart, consumeSession } = usePremium();
  const [showPremiumSheet, setShowPremiumSheet] = useState(false);

  const {
    running, intensity, setIntensity, start, stop,
    phase, elapsed, therapeuticRemaining,
    deviceTempC, heatLevel, stopReason,
    wakeLockActive, batteryLevel, workerCount,
    sessionDurationMin, setSessionDuration,
  } = useWarmSession();

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

  const glowIntensity = running ? 0.2 + heatLevel * 0.8 : 0;
  const tempC = Math.round(deviceTempC * 10) / 10;
  const tempF = Math.round(cToF(deviceTempC) * 10) / 10;
  const targetC = TARGET_TEMP_C[intensity];

  const warmProgress = phase === 'therapeutic' ? 1
    : phase === 'warming' ? Math.min((deviceTempC - 34) / (targetC - 34), 0.99)
    : 0;

  const intensityLabels: Record<Intensity, string> = {
    low: t.low, medium: t.medium, high: t.high,
  };

  // Wrap start: gate on canStart, debit a session
  const handleStart = () => {
    if (!canStart) { setShowPremiumSheet(true); return; }
    consumeSession();
    start();
  };

  const handleIntensityClick = (level: Intensity) => {
    if (level !== 'low' && !isPremium) {
      setShowPremiumSheet(true);
      return;
    }
    setIntensity(level);
  };

  const handleDurationClick = (d: TherapeuticDuration) => {
    if (d === 30 && !isPremium) {
      setShowPremiumSheet(true);
      return;
    }
    setSessionDuration(d);
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center overflow-hidden bg-background px-6 py-12">

      {/* Background glow */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: glowIntensity }}
        transition={{ duration: 1 }}
      >
        <div className="w-[80vw] h-[80vw] max-w-md max-h-md rounded-full bg-primary/30 blur-[100px]" />
      </motion.div>

      {/* Header */}
      <div className="absolute top-8 left-0 right-0 flex flex-col items-center z-10">
        <div className="flex items-center gap-2 text-primary">
          <Flame size={24} className={running ? 'animate-pulse' : ''} />
          <h1 className="text-2xl font-medium tracking-wide">Warm</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1">{t.tagline}</p>
      </div>

      <div className="z-10 flex flex-col items-center w-full max-w-sm mt-12 mb-auto gap-8">

        {/* Auto-stop toast */}
        <div className="h-10 w-full flex items-center justify-center">
          <AnimatePresence>
            {toastReason && (
              <motion.div
                key={toastReason}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-2 bg-destructive/10 text-destructive-foreground px-4 py-2 rounded-full border border-destructive/20 text-sm"
              >
                <AlertTriangle size={14} className="text-destructive" />
                <span className="text-destructive">{t.autoStop[toastReason]}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Temperature Display ── */}
        <div className="w-full bg-card/60 border border-card-border rounded-3xl px-6 py-5 flex flex-col gap-3 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-widest">
            <Thermometer size={13} />
            <span>{t.tempLabel}</span>
          </div>

          <div className="flex items-end gap-4">
            <div className="flex items-baseline gap-1">
              <motion.span
                key={Math.floor(tempC)}
                className="text-5xl font-light tabular-nums text-foreground"
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                {tempC.toFixed(1)}
              </motion.span>
              <span className="text-2xl text-muted-foreground font-light">°C</span>
            </div>
            <div className="flex items-baseline gap-1 mb-0.5 text-muted-foreground">
              <span className="text-xl font-light tabular-nums">{tempF.toFixed(1)}</span>
              <span className="text-base font-light">°F</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <AnimatePresence mode="wait">
                {phase === 'idle' && (
                  <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs text-muted-foreground">—</motion.span>
                )}
                {phase === 'warming' && (
                  <motion.span key="warming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs text-amber-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                    {t.phaseWarming}
                  </motion.span>
                )}
                {phase === 'therapeutic' && (
                  <motion.span key="therapeutic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs text-primary font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                    {t.phaseTherapeutic}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${phase === 'therapeutic' ? 'bg-primary' : 'bg-amber-500'}`}
                animate={{ width: `${warmProgress * 100}%` }}
                transition={{ duration: 1, ease: 'linear' }}
              />
            </div>
          </div>
        </div>

        {/* ── Main Button ── */}
        <div className="flex flex-col items-center">
          <motion.button
            onClick={running ? stop : handleStart}
            className={`relative flex items-center justify-center w-44 h-44 rounded-full shadow-2xl outline-none transition-transform active:scale-95 ${
              running
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground border border-card-border'
            }`}
            animate={{
              boxShadow: running
                ? `0 0 ${40 + heatLevel * 60}px ${10 + heatLevel * 20}px rgba(244,91,38,${0.4 + heatLevel * 0.4})`
                : '0 4px 20px 0px rgba(0,0,0,0.5)',
            }}
            transition={{ duration: 1 }}
          >
            {running && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-white/20"
                animate={{ scale: [1, 1.05, 1], opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 2 - heatLevel, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-medium tracking-wider uppercase">
                {running ? t.stop : t.start}
              </span>
              {running && phase === 'therapeutic' && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="font-mono text-lg text-white/90">
                  {formatTime(therapeuticRemaining)}
                </motion.span>
              )}
              {running && phase === 'warming' && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-xs text-white/70 text-center max-w-[100px] leading-tight">
                  {t.phaseWarming}
                </motion.span>
              )}
            </div>
          </motion.button>

          <AnimatePresence>
            {phase === 'therapeutic' && (
              <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-3 text-xs text-muted-foreground">{t.therapyTimer}</motion.p>
            )}
            {phase === 'warming' && (
              <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-3 text-xs text-muted-foreground">
                {t.waitingForTemp} · {targetC}°C
              </motion.p>
            )}
            {!running && !isPremium && (
              <motion.p
                key={freeSessionsLeft}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`mt-3 text-xs text-center ${
                  freeSessionsLeft === 0
                    ? 'text-destructive font-medium'
                    : freeSessionsLeft === 1
                    ? 'text-amber-400'
                    : 'text-muted-foreground'
                }`}
              >
                {freeSessionsLeft === 0
                  ? t.sessions.none
                  : `${freeSessionsLeft} / ${FREE_SESSION_LIMIT} ${t.sessions.left}`}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* ── Intensity ── */}
        <div className="w-full flex flex-col gap-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              {t.intensity}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Cpu size={11} /> {workerCount} {workerCount === 1 ? t.core : t.cores}
            </span>
          </div>
          <div className="flex p-1 bg-card rounded-2xl border border-card-border">
            {(['low', 'medium', 'high'] as Intensity[]).map((level) => {
              const locked = level !== 'low' && !isPremium;
              const selected = intensity === level;
              return (
                <button
                  key={level}
                  onClick={() => handleIntensityClick(level)}
                  className={`flex-1 py-3 text-sm font-medium rounded-xl transition-all duration-300 relative ${
                    selected && !locked
                      ? 'bg-secondary text-foreground shadow-md'
                      : locked
                      ? 'text-muted-foreground/50'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  {locked ? (
                    <span className="flex items-center justify-center gap-1">
                      <Lock size={11} className="shrink-0" />
                      <span>{intensityLabels[level]}</span>
                    </span>
                  ) : (
                    intensityLabels[level]
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Session Duration ── */}
        <div className="w-full flex flex-col gap-3">
          <div className="px-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              {t.session}
            </span>
          </div>
          <div className="flex p-1 bg-card rounded-2xl border border-card-border">
            {THERAPEUTIC_DURATIONS.map((d) => {
              const locked = d === 30 && !isPremium;
              const selected = sessionDurationMin === d;
              return (
                <button
                  key={d}
                  onClick={() => handleDurationClick(d as TherapeuticDuration)}
                  disabled={running && !locked}
                  className={`flex-1 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${
                    selected && !locked
                      ? 'bg-secondary text-foreground shadow-md'
                      : locked
                      ? 'text-muted-foreground/50'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {locked ? (
                    <span className="flex items-center justify-center gap-1">
                      <Lock size={11} className="shrink-0" />
                      <span>{d} {t.min}</span>
                    </span>
                  ) : (
                    `${d} ${t.min}`
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="mt-auto w-full max-w-sm flex flex-col gap-5 z-10 pb-6">
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
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="font-mono">{formatTime(elapsed)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 bg-black/20 p-4 rounded-2xl border border-white/5 backdrop-blur-sm items-start">
          <ShieldAlert size={17} className="text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground/80 font-medium">{t.safetyTitle}:</strong>{' '}
            {t.safetyBody}
          </p>
        </div>
      </div>

      {/* Premium sheet */}
      <PremiumSheet open={showPremiumSheet} onClose={() => setShowPremiumSheet(false)} />
    </div>
  );
}
