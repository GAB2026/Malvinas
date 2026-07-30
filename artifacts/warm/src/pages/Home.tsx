import React, { useEffect, useRef, useState } from 'react';
import { useWarmSession, StopReason, Intensity } from '@/hooks/useWarmSession';
import { useCalibration } from '@/hooks/useCalibration';
import { useTranslations } from '@/lib/i18n';
import { playCompletionChime } from '@/lib/chime';
import AnimatedFlame from '@/components/AnimatedFlame';
import { Battery, AlertTriangle, ShieldAlert, Thermometer, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AUTO_DISMISS_MS = 5000;

// ── Debug overlay (temporary) ─────────────────────────────────────────────────
function DebugOverlay({
  thermalRaw, simTemp, deviceTempC, warmingBaseline, targetC,
  settleProgress, ambientC, usingRealSensor, phase, elapsed,
  workerCount, running,
}: {
  thermalRaw: number | null; simTemp: number; deviceTempC: number;
  warmingBaseline: number | null; targetC: number | null;
  settleProgress: number; ambientC: number; usingRealSensor: boolean;
  phase: string; elapsed: number; workerCount: number; running: boolean;
}) {
  const fmt = (v: number | null, decimals = 1) =>
    v === null ? 'null' : v.toFixed(decimals);

  const rows: [string, string, string][] = [
    // [label, value, explanation]
    ['sensor hw',    usingRealSensor ? 'SÍ' : 'NO',        'Si es NO, NO hay sensor térmico real en uso'],
    ['sensor raw',   thermalRaw === null ? '— (null)' : `${fmt(thermalRaw)}°C`, 'Lectura directa del sensor. null = web o no disponible'],
    ['sim temp',     `${fmt(simTemp)}°C`,                  'Temperatura simulada por modelo matemático (siempre corre)'],
    ['shown temp',   `${fmt(deviceTempC)}°C`,              'Lo que la app muestra: raw si disponible, sim si no'],
    ['ambient cal',  `${fmt(ambientC)}°C`,                 'Temperatura ambiente medida en calibración'],
    ['w.baseline',   warmingBaseline === null ? '— (sin datos)' : `${fmt(warmingBaseline)}°C`, 'MAX de lecturas reales durante settle. Base para el delta'],
    ['w.target',     targetC === null ? '— (sin baseline)' : `${fmt(targetC)}°C`,             'baseline + WARMUP_DELTA → umbral para pasar a terapéutico'],
    ['settle',       running ? `${Math.round(settleProgress * 100)}% (${Math.round(settleProgress * 45)}s/45s)` : '—', 'Progreso ventana 45s donde se construye el baseline'],
    ['phase',        phase,                                'Fase actual de la sesión'],
    ['elapsed',      running ? `${elapsed}s` : '—',        'Segundos desde inicio de sesión'],
    ['workers',      String(workerCount),                  'Cantidad de CPU workers activos'],
  ];

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.88)', borderTop: '1px solid #ff6600',
      padding: '6px 8px', fontFamily: 'monospace', fontSize: 10,
      color: '#e0e0e0', maxHeight: '38vh', overflowY: 'auto',
    }}>
      <div style={{ color: '#ff6600', fontWeight: 'bold', marginBottom: 4 }}>
        🛠 DEBUG OVERLAY (temporal)
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          {rows.map(([label, value, note]) => (
            <tr key={label} style={{ borderBottom: '1px solid #222' }}>
              <td style={{ color: '#aaa', paddingRight: 6, paddingBottom: 2, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{label}</td>
              <td style={{ color: '#fff', fontWeight: 'bold', paddingRight: 8, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{value}</td>
              <td style={{ color: '#666', fontSize: 9, verticalAlign: 'top' }}>{note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

// ── Main app ──────────────────────────────────────────────────────────────────
export default function Home() {
  const t = useTranslations();
  const { result: calibration, calibrating, progress } = useCalibration();

  const {
    running, intensity, setIntensity, start, stop,
    phase, elapsed, therapeuticRemaining,
    heatLevel, stopReason, wakeLockActive, batteryLevel, coolingDown,
    dbg_thermalRaw, dbg_simTemp, dbg_warmingBaseline, dbg_targetC,
    dbg_settleProgress, dbg_ambientC, dbg_usingRealSensor, workerCount,
    deviceTempC,
  } = useWarmSession(calibration);

  const [toastReason, setToastReason] = useState<StopReason>(null);
  const prevStopReason = useRef<StopReason>(null);

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
      if (startLockRef.current) return; // too soon after start — ignore
      stop();
      return;
    }
    if (coolingDown) return;
    triggerPulse();
    start();
    startLockRef.current = true;
    setTimeout(() => { startLockRef.current = false; }, 2500);
  };

  const handleIntensityClick = (level: Intensity) => {
    if (running) return;
    setIntensity(level);
  };

  if (calibrating || !calibration) return <CalibrationScreen progress={progress} />;

  const minutes = (i: Intensity) =>
    i === 'high' ? calibration.highMinutes : i === 'medium' ? calibration.mediumMinutes : calibration.lowMinutes;

  const intensities: Intensity[] = ['low', 'medium', 'high'];
  const intensityLabels: Record<Intensity, string> = { low: t.low, medium: t.medium, high: t.high };
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
                <AlertTriangle size={12} /> {t.autoStop[toastReason]}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col items-center gap-2 pt-1 pb-2">
          {/* Pulse ring — renders instantly on pointerdown, no React state needed */}
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
            const active = intensity === level;
            return (
              <button
                key={level}
                onClick={() => handleIntensityClick(level)}
                disabled={running}
                className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-2xl border transition-all duration-300 disabled:cursor-not-allowed
                  ${active
                    ? 'bg-[#1e1410] border-orange-700 shadow-[0_0_18px_rgba(194,65,12,0.3)]'
                    : 'border-white/8 bg-card hover:border-white/15 hover:bg-white/5'}`}
              >
                <span className={`text-[11px] font-bold uppercase tracking-widest ${active ? 'text-orange-400' : 'text-muted-foreground'}`}>
                  {level === 'high' && active ? '🔥 ' : ''}{intensityLabels[level]}
                </span>
                <span className={`text-3xl font-bold leading-none tabular-nums ${active ? 'text-white' : 'text-foreground/25'}`}>
                  {minutes(level)}
                </span>
                <span className={`text-[10px] font-medium ${active ? 'text-orange-400/80' : 'text-muted-foreground/40'}`}>
                  min
                </span>
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

      <DebugOverlay
        thermalRaw={dbg_thermalRaw}
        simTemp={dbg_simTemp}
        deviceTempC={deviceTempC}
        warmingBaseline={dbg_warmingBaseline}
        targetC={dbg_targetC}
        settleProgress={dbg_settleProgress}
        ambientC={dbg_ambientC}
        usingRealSensor={dbg_usingRealSensor}
        phase={phase}
        elapsed={elapsed}
        workerCount={workerCount}
        running={running}
      />

    </div>
  );
}
