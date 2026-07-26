import React, { useEffect, useState } from 'react';
import { useWarmSession, StopReason, Intensity } from '@/hooks/useWarmSession';
import { Flame, Battery, Cpu, AlertTriangle, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STOP_MESSAGES: Record<string, string> = {
  'time-limit': 'Session ended: 15-minute safety limit reached.',
  'low-battery': 'Session ended: Battery dropped below 15%.',
  'tab-hidden': 'Session paused: Kept in background.',
};

export default function Home() {
  const {
    running,
    intensity,
    setIntensity,
    start,
    stop,
    elapsed,
    remaining,
    heatLevel,
    stopReason,
    wakeLockActive,
    batteryLevel,
    workerCount,
  } = useWarmSession();

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Convert heatLevel (0 to 1) into a glow intensity for the UI
  // When running, it should have a baseline glow even at 0 heat.
  const glowIntensity = running ? 0.2 + (heatLevel * 0.8) : 0;

  // We want to smoothly animate the background glow using framer-motion
  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center overflow-hidden bg-background px-6 py-12">
      {/* Dynamic Background Glow */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: glowIntensity }}
        transition={{ duration: 1 }}
      >
        <div className="w-[80vw] h-[80vw] max-w-md max-h-md rounded-full bg-primary/30 blur-[100px]" />
      </motion.div>
      
      {/* Header */}
      <div className="absolute top-8 left-0 right-0 flex flex-col items-center justify-center z-10">
        <div className="flex items-center gap-2 text-primary">
          <Flame size={24} className={running ? "animate-pulse" : ""} />
          <h1 className="text-2xl font-medium tracking-wide">Warm</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1">pocket fireplace</p>
      </div>

      <div className="z-10 flex flex-col items-center w-full max-w-sm mt-12 mb-auto gap-12">
        {/* Stop Reason Toast */}
        <div className="h-12 w-full flex items-center justify-center">
          <AnimatePresence>
            {stopReason && !running && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 bg-destructive/10 text-destructive-foreground px-4 py-2 rounded-full border border-destructive/20 text-sm"
              >
                <AlertTriangle size={16} className="text-destructive" />
                <span className="text-destructive">{STOP_MESSAGES[stopReason] || 'Session stopped.'}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Main Control */}
        <div className="relative flex flex-col items-center">
          <motion.button
            onClick={running ? stop : start}
            className={`relative flex items-center justify-center w-48 h-48 rounded-full shadow-2xl outline-none transition-transform active:scale-95 ${
              running ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground border border-card-border'
            }`}
            animate={{
              boxShadow: running 
                ? `0 0 ${40 + heatLevel * 60}px ${10 + heatLevel * 20}px rgba(244, 91, 38, ${0.4 + heatLevel * 0.4})`
                : '0 4px 20px 0px rgba(0, 0, 0, 0.5)',
            }}
            transition={{ duration: 1 }}
          >
            {/* Inner pulsing ring when running */}
            {running && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-white/20"
                animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2 - heatLevel, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl font-medium tracking-wider uppercase">
                {running ? 'Stop' : 'Start'}
              </span>
              {running && (
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-white/80 font-mono text-lg"
                >
                  {formatTime(remaining)}
                </motion.span>
              )}
            </div>
          </motion.button>
        </div>

        {/* Intensity Selector */}
        <div className="w-full flex flex-col gap-3">
          <div className="flex justify-between items-center px-2">
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Intensity</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Cpu size={12} /> {workerCount} {workerCount === 1 ? 'core' : 'cores'}
            </span>
          </div>
          <div className="flex p-1 bg-card rounded-2xl border border-card-border">
            {(['low', 'medium', 'high'] as Intensity[]).map((level) => (
              <button
                key={level}
                onClick={() => setIntensity(level)}
                className={`flex-1 py-3 text-sm font-medium rounded-xl transition-all duration-300 capitalize ${
                  intensity === level
                    ? 'bg-secondary text-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Info & Safety Notice */}
      <div className="mt-auto w-full max-w-sm flex flex-col gap-6 z-10 pb-6">
        {/* Status Indicators */}
        <div className="flex justify-center gap-6 text-xs text-muted-foreground">
          {batteryLevel !== null && (
            <div className="flex items-center gap-1.5">
              <Battery size={14} className={batteryLevel <= 0.2 ? 'text-destructive' : ''} />
              <span className={batteryLevel <= 0.2 ? 'text-destructive font-medium' : ''}>
                {Math.round(batteryLevel * 100)}%
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${wakeLockActive ? 'bg-primary' : 'bg-muted'}`} />
            <span>{wakeLockActive ? 'Screen awake' : 'Screen can sleep'}</span>
          </div>
        </div>

        {/* Safety Notice */}
        <div className="flex gap-3 bg-black/20 p-4 rounded-2xl border border-white/5 backdrop-blur-sm items-start">
          <ShieldAlert size={18} className="text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground/80 font-medium">Safety Notice:</strong> This app physically heats your device by running heavy computations. It drains battery rapidly and may cause thermal throttling. Sessions automatically end after 15 minutes or at 15% battery.
          </p>
        </div>
      </div>
    </div>
  );
}
