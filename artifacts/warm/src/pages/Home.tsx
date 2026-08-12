import React, { useEffect, useRef, useState } from 'react';
import { useWarmSession, StopReason, LOW_BATTERY_CUTOFF } from '@/hooks/useWarmSession';
import { useCalibration } from '@/hooks/useCalibration';
import { usePremium } from '@/hooks/usePremium';
import { useTranslations } from '@/lib/i18n';
import { playCompletionChime } from '@/lib/chime';
import AnimatedFlame from '@/components/AnimatedFlame';
import { Battery, AlertTriangle, ShieldAlert, Thermometer, Lock, Lightbulb } from 'lucide-react';
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
          {[p.benefit1, p.benefit2].map((b) => (
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

// ── Low-battery warning sheet ─────────────────────────────────────────────────
function LowBatteryWarningSheet({ onDismiss }: { onDismiss: () => void }) {
  const t = useTranslations();
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-end"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/70" onClick={onDismiss} />
      <motion.div
        className="relative z-10 w-full max-w-sm bg-[#120e08] border border-white/10 rounded-t-3xl px-6 pt-5 pb-10 flex flex-col gap-5"
        initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
        transition={{ type: 'spring', damping: 26, stiffness: 260 }}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto -mt-1 mb-1" />
        <div className="flex items-start gap-3">
          <ShieldAlert size={22} className="text-destructive shrink-0 mt-0.5" />
          <div className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">{t.safetyTitle}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t.safetyBody}</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-foreground/70 text-sm font-medium active:scale-95 transition-transform"
        >
          {t.understood}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
export default function Home() {
  const t = useTranslations();
  const { result: calibration, calibrating, progress } = useCalibration();
  const { isPremium, isLocked, consumeDuration, purchase, restore } = usePremium();

  const {
    running, intensity, start, stop,
    phase, elapsed, therapeuticRemaining, warmingRemaining,
    heatLevel, stopReason, wakeLockActive, batteryLevel,
    deviceTempC,
    sessionDurationSecs, setSessionDuration,
  } = useWarmSession(calibration);

  const DURATION_OPTIONS = [5, 10, 15]; // minutes
  const selectedMins = sessionDurationSecs / 60;

  const [toastReason, setToastReason] = useState<StopReason>(null);
  const prevStopReason = useRef<StopReason>(null);
  const [showPremium, setShowPremium] = useState(false);
  const [showBatteryWarning, setShowBatteryWarning] = useState(false);

  // Check battery on first read — warn immediately if ≤20% at startup
  const startupBatteryChecked = useRef(false);
  useEffect(() => {
    if (batteryLevel === null || startupBatteryChecked.current) return;
    startupBatteryChecked.current = true;
    if (batteryLevel <= LOW_BATTERY_CUTOFF) setShowBatteryWarning(true);
  }, [batteryLevel]);

  useEffect(() => { if (running) setToastReason(null); }, [running]);
  useEffect(() => {
    if (stopReason && stopReason !== 'user' && stopReason !== prevStopReason.current) {
      prevStopReason.current = stopReason;
      if (stopReason === 'low-battery') {
        // Low-battery gets a prominent modal card instead of the dismissing toast
        setShowBatteryWarning(true);
      } else {
        setToastReason(stopReason);
        if (stopReason === 'time-limit') void playCompletionChime();
        const id = setTimeout(() => setToastReason(null), AUTO_DISMISS_MS);
        return () => clearTimeout(id);
      }
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
  // Two-tap-to-stop: first tap arms, second tap within 2 s confirms.
  const [pendingStop, setPendingStop] = useState(false);
  const pendingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFlameClick = () => {
    if (running) {
      if (startLockRef.current) return;
      if (!pendingStop) {
        // First tap — arm the stop
        setPendingStop(true);
        pendingStopTimer.current = setTimeout(() => {
          setPendingStop(false);
        }, 2000);
        return;
      }
      // Second tap — confirm stop
      if (pendingStopTimer.current) clearTimeout(pendingStopTimer.current);
      setPendingStop(false);
      stop();
      return;
    }
    // Duration requires premium — open paywall
    if (isLocked(selectedMins)) { setShowPremium(true); return; }
    // Consume the one free use for 5-min (no-op for already-consumed or premium)
    consumeDuration(selectedMins);
    triggerPulse();
    start();
    startLockRef.current = true;
    setTimeout(() => { startLockRef.current = false; }, 2500);
  };

  const handleDurationClick = (mins: number) => {
    if (running) return;
    // Tapping a locked button opens the paywall
    if (isLocked(mins)) { setShowPremium(true); return; }
    setSessionDuration(mins * 60);
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

  const glowIntensity = running ? 0.15 + heatLevel * 0.85 : 0;

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
              disabled={false}
            />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="h-5 flex items-center">
              <AnimatePresence>
                {phase === 'warming' && (
                  <motion.span key="warming"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                    {t.phaseWarming}
                    {warmingRemaining > 0 && (
                      <span className="font-mono tabular-nums ml-1">{formatTime(warmingRemaining)}</span>
                    )}
                  </motion.span>
                )}
                {phase === 'therapeutic' && (
                  <motion.span key="therapeutic"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs text-primary font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                    {t.phaseTherapeutic} · {formatTime(therapeuticRemaining)}
                  </motion.span>
                )}
                {!running && (
                  <motion.span key="idle"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs text-muted-foreground">{t.tapToStart}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>{/* end TOP */}

      {/* ── MIDDLE: double-tap hint — centered between flame and buttons ── */}
      <div className="z-10 flex-1 flex items-center justify-center w-full">
        <AnimatePresence mode="wait">
          {running && pendingStop && (
            <motion.span key="confirm-stop"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="text-sm font-semibold text-destructive animate-pulse tracking-wide">
              ¿Terminar? Tocá de nuevo
            </motion.span>
          )}
          {running && !pendingStop && (
            <motion.span key="hint-stop"
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-sm text-muted-foreground/50 tracking-wide">{t.tapToStop}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── BOTTOM: duration selector + footer ── */}
      <div className="z-10 w-full max-w-sm flex flex-col gap-2 pb-6">
        <div className="flex gap-2">
          {DURATION_OPTIONS.map((mins) => {
            const locked = isLocked(mins);
            const active = selectedMins === mins && !locked;
            return (
              <button
                key={mins}
                onClick={() => handleDurationClick(mins)}
                disabled={running}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-2xl border transition-all duration-300 disabled:cursor-not-allowed
                  ${locked
                    ? 'border-yellow-500/60 bg-yellow-950/40'
                    : active
                      ? 'bg-[#1e1410] border-orange-700 shadow-[0_0_18px_rgba(194,65,12,0.3)]'
                      : 'border-white/8 bg-card hover:border-white/15 hover:bg-white/5'}`}
              >
                {locked ? (
                  <>
                    <Lock size={20} className="text-yellow-400" />
                    <span className="text-[10px] font-semibold text-yellow-400/80 uppercase tracking-wide">
                      Premium
                    </span>
                  </>
                ) : (
                  <>
                    <span className={`text-3xl font-bold leading-none tabular-nums ${active ? 'text-white' : 'text-foreground/25'}`}>
                      {mins}
                    </span>
                    <span className={`text-[10px] font-medium ${active ? 'text-orange-400/80' : 'text-muted-foreground/40'}`}>
                      min
                    </span>
                  </>
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

        <div className="flex items-start gap-2 px-1">
          <Lightbulb size={12} className="text-muted-foreground/40 shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
            {t.suggestion}
          </p>
        </div>
      </div>{/* end BOTTOM */}

      {/* ── Low-battery warning sheet ── */}
      <AnimatePresence>
        {showBatteryWarning && (
          <LowBatteryWarningSheet onDismiss={() => setShowBatteryWarning(false)} />
        )}
      </AnimatePresence>

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
