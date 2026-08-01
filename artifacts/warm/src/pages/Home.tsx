import React, { useEffect, useRef, useState } from 'react';
import { useWarmSession, StopReason, Intensity } from '@/hooks/useWarmSession';
import { useCalibration } from '@/hooks/useCalibration';
import { usePremium } from '@/hooks/usePremium';
import { useTranslations } from '@/lib/i18n';
import { playCompletionChime } from '@/lib/chime';
import AnimatedFlame from '@/components/AnimatedFlame';
import { Battery, AlertTriangle, ShieldAlert, Lock, Thermometer, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AUTO_DISMISS_MS = 5000;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ── Calibration screen ────────────────────────────────────────────────────────
function CalibrationScreen({ progress }: { progress: number }) {
  const t = useTranslations();
  return (
    <div className="relative h-[100dvh] w-full flex flex-col items-center justify-center bg-background px-8 gap-8">
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        animate={{ opacity: [0.05, 0.12, 0.05] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      >
        <div className="w-[70vw] h-[70vw] rounded-full bg-primary/30 blur-[80px]" />
      </motion.div>
      <div className="z-10 flex flex-col items-center gap-6 w-full max-w-xs text-center">
        <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>
          <Thermometer size={48} className="text-primary" />
        </motion.div>
        <div className="flex flex-col gap-2">
          <p className="text-lg font-medium text-foreground leading-snug">{t.calibrating}</p>
          <p className="text-xs text-primary/70 font-medium">{t.calibratingOnce}</p>
          <p className="text-sm text-muted-foreground">{t.calibratingNote}</p>
        </div>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${Math.round(progress * 100)}%` }}
            transition={{ duration: 0.8, ease: 'linear' }}
          />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">{Math.round(progress * 100)}%</p>
      </div>
    </div>
  );
}

// ── Premium paywall sheet ─────────────────────────────────────────────────────
function PremiumSheet({
  onPurchase, onRestore, onDismiss,
}: { onPurchase: () => void; onRestore: () => void; onDismiss: () => void }) {
  const t = useTranslations();
  const p = t.premium;
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-end"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onDismiss} />
      <motion.div
        className="relative z-10 w-full max-w-sm bg-[#120e08] border border-white/10 rounded-t-3xl px-6 pt-6 pb-10 flex flex-col gap-5"
        initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
        transition={{ type: 'spring', damping: 26, stiffness: 260 }}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto -mt-1 mb-1" />
        <div className="flex flex-col gap-1 text-center">
          <span className="text-2xl">🔥</span>
          <h2 className="text-lg font-semibold text-foreground">{p.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{p.subtitle}</p>
        </div>
        <ul className="flex flex-col gap-2 text-sm text-foreground/80">
          {[p.benefit1, p.benefit2, p.benefit3].map((b) => (
            <li key={b} className="flex items-center gap-2">
              <span className="text-primary text-base">✓</span> {b}
            </li>
          ))}
        </ul>
        <button
          onClick={onPurchase}
          className="w-full py-3 rounded-2xl bg-primary text-white font-semibold text-sm tracking-wide shadow-lg active:scale-95 transition-transform"
        >
          {p.buyBtn}
        </button>
        <button
          onClick={onRestore}
          className="w-full text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          {p.restoreBtn}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
export default function Home() {
  const t = useTranslations();
  const { result: calibration, calibrating, progress } = useCalibration();
  const { isPremium, mediumTrialsLeft, canUseMedium, consumeMediumTrial, purchase, restore } = usePremium();

  const {
    running, intensity, setIntensity, start, stop,
    phase, elapsed, therapeuticRemaining,
    heatLevel, stopReason, wakeLockActive, batteryLevel, coolingDown,
    deviceTempC,
    workerCount,
  } = useWarmSession(calibration);

  const [toastReason, setToastReason] = useState<StopReason>(null);
  const prevStopReason = useRef<StopReason>(null);
  const [showPremium, setShowPremium] = useState(false);

  useEffect(() => { if (running) setToastReason(null); }, [running]);
  useEffect(() => {
    if (stopReason && stopReason !== 'user' && stopReason !== prevStopReason.current) {
      prevStopReason.current = stopReason;
      setToastReason(stopReason);
      if (stopReason === 'time-limit') void playCompletionChime();
      const id = setTimeout(() => setToastReason(null), AUTO_DISMISS_MS);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [stopReason]);

  // Immediate visual feedback — fires before React state update.
  const [flamePulse, setFlamePulse] = useState(false);
  const triggerPulse = () => {
    setFlamePulse(true);
    setTimeout(() => setFlamePulse(false), 600);
  };

  // Prevent accidental double-tap: lock the flame for 2.5 s after starting.
  const startLockRef = useRef(false);
  const handleFlameClick = () => {
    if (running) {
      if (startLockRef.current) return;
      stop();
      return;
    }
    if (coolingDown) return;
    // Block start if selected intensity is locked
    if (intensity === 'high' && !isPremium) { setShowPremium(true); return; }
    triggerPulse();
    start();
    startLockRef.current = true;
    setTimeout(() => { startLockRef.current = false; }, 2500);
  };

  const handleIntensityClick = (level: Intensity) => {
    if (running) return;
    if (level === 'high' && !isPremium) { setShowPremium(true); return; }
    setIntensity(level);
  };

  const handlePurchase = async () => {
    await purchase();
    setShowPremium(false);
  };
  const handleRestore = async () => {
    await restore();
    setShowPremium(false);
  };

  if (calibrating || !calibration) return <CalibrationScreen progress={progress} />;

  const minutes = (i: Intensity) =>
    i === 'high' ? calibration.highMinutes : i === 'medium' ? calibration.mediumMinutes : calibration.lowMinutes;

  // Only two intensities: medium (shown as "Baja") and high ("Alta").
  // Low was removed — too little heat. Medium settings now fill the "Baja" slot.
  const intensities: Intensity[] = ['medium', 'high'];
  const intensityLabels: Record<Intensity, string> = {
    low: t.low, medium: t.low, high: t.high,
  };
  const glowIntensity = running ? 0.15 + heatLevel * 0.85 : 0;

  // Per-intensity lock state
  const isLocked = (level: Intensity) =>
    level === 'high' && !isPremium;

  // Badge shown inside the card
  const badge = (level: Intensity): string | null => {
    if (level === 'high' && !isPremium) return t.premium.lockedHint;
    if (level === 'medium' && !isPremium && canUseMedium && mediumTrialsLeft < Infinity)
      return `${mediumTrialsLeft} ${t.trial.left}`;
    return null;
  };

  return (
    <div className="relative h-[100dvh] w-full flex flex-col items-center overflow-hidden bg-background px-5">

      {/* Background glow */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        animate={{ opacity: glowIntensity }} transition={{ duration: 1.2 }}
      >
        <div className="w-[85vw] h-[85vw] max-w-lg rounded-full bg-primary/25 blur-[110px]" />
      </motion.div>

      {/* ── TOP: header + toast + flame ── */}
      <div className="z-10 flex flex-col items-center w-full">
        <div className="flex flex-col items-center pt-4">
          <h1 className="text-2xl font-medium tracking-wide text-foreground">Thermal Pad</h1>
          <p className="text-muted-foreground text-xs mt-0.5">{t.tagline}</p>
        </div>

        <div className="h-8 w-full max-w-sm flex items-center justify-center">
          <AnimatePresence>
            {toastReason && (
              <motion.div key={toastReason}
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-1 rounded-full border border-destructive/20 text-xs">
                <AlertTriangle size={12} /> {t.autoStop[toastReason as keyof typeof t.autoStop]}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col items-center gap-2 pt-1 pb-2">
          <div className="relative">
            <AnimatePresence>
              {flamePulse && (
                <motion.div
                  key="pulse"
                  className="absolute inset-0 rounded-full border-2 border-primary pointer-events-none"
                  initial={{ scale: 0.8, opacity: 0.9 }}
                  animate={{ scale: 2.2, opacity: 0 }}
                  exit={{}}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                  style={{ margin: '-30%' }}
                />
              )}
            </AnimatePresence>
            <AnimatedFlame
              intensity={intensity}
              heatLevel={heatLevel}
              running={running}
              onClick={handleFlameClick}
              disabled={coolingDown && !running}
            />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="h-5 flex items-center">
              <AnimatePresence>
                {coolingDown && (
                  <motion.span key="cooling"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs text-sky-400 font-medium flex items-center gap-1.5">
                    <RefreshCw size={11} className="animate-spin" />{t.cooling}
                  </motion.span>
                )}
                {!coolingDown && phase === 'warming' && (
                  <motion.span key="warming"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                    {t.phaseWarming} {formatTime(elapsed)}
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
                {!coolingDown && !running && (
                  <motion.span key="idle"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs text-muted-foreground">{t.tapToStart}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {running && !coolingDown && (
                <motion.span
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-[10px] text-muted-foreground/60">{t.tapToStop}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>{/* end TOP */}

      {/* ── BOTTOM: intensity cards + footer ── */}
      <div className="z-10 w-full max-w-sm flex flex-col gap-2 mt-10 pb-6">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest px-1">
          {t.intensity}
        </span>
        <div className="flex gap-2">
          {intensities.map((level) => {
            const active  = intensity === level;
            const locked  = isLocked(level);
            const cardBadge = badge(level);
            return (
              <button
                key={level}
                onClick={() => handleIntensityClick(level)}
                disabled={running}
                className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-2xl border transition-all duration-300 disabled:cursor-not-allowed
                  ${locked
                    ? 'border-white/8 bg-card opacity-60'
                    : active
                      ? 'bg-[#1e1410] border-orange-700 shadow-[0_0_18px_rgba(194,65,12,0.3)]'
                      : 'border-white/8 bg-card hover:border-white/15 hover:bg-white/5'}`}
              >
                {locked
                  ? <Lock size={13} className="text-muted-foreground/50 mb-0.5" />
                  : <span className={`text-[11px] font-bold uppercase tracking-widest ${active ? 'text-orange-400' : 'text-muted-foreground'}`}>
                      {level === 'high' && active ? '🔥 ' : ''}{intensityLabels[level]}
                    </span>
                }
                <span className={`text-3xl font-bold leading-none tabular-nums ${active && !locked ? 'text-white' : 'text-foreground/25'}`}>
                  {minutes(level)}
                </span>
                <span className={`text-[10px] font-medium ${active && !locked ? 'text-orange-400/80' : 'text-muted-foreground/40'}`}>
                  min
                </span>
                {cardBadge && (
                  <span className="text-[9px] font-semibold text-primary/80 mt-0.5 leading-none">
                    {cardBadge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex justify-center gap-5 text-xs text-muted-foreground mt-1">
          {batteryLevel !== null && (
            <div className="flex items-center gap-1.5">
              <Battery size={13} className={batteryLevel <= 0.2 ? 'text-destructive' : ''} />
              <span className={batteryLevel <= 0.2 ? 'text-destructive font-medium' : ''}>
                {Math.round(batteryLevel * 100)}%
              </span>
            </div>
          )}
          {wakeLockActive && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>{t.screenAwake}</span>
            </div>
          )}
          {running && <span className="font-mono">{formatTime(elapsed)}</span>}
        </div>

        <div className="flex gap-3 bg-black/20 p-3 rounded-2xl border border-white/5 items-start">
          <ShieldAlert size={14} className="text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground/70 font-medium">{t.safetyTitle}:</strong>{' '}
            {t.safetyBody}
          </p>
        </div>
      </div>{/* end BOTTOM */}

      {/* ── Premium sheet ── */}
      <AnimatePresence>
        {showPremium && (
          <PremiumSheet
            onPurchase={handlePurchase}
            onRestore={handleRestore}
            onDismiss={() => setShowPremium(false)}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
