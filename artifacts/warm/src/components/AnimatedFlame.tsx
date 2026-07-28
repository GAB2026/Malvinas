import { motion } from 'framer-motion';
import type { Intensity } from '@/lib/heat/heatEngine';

interface Props {
  intensity: Intensity;
  heatLevel: number; // 0..1
  running: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const BASE_SIZE: Record<Intensity, number> = { low: 0.55, medium: 0.75, high: 1.0 };

export default function AnimatedFlame({ intensity, heatLevel, running, onClick, disabled }: Props) {
  const idleScale  = BASE_SIZE[intensity];
  const liveScale  = idleScale * (0.75 + heatLevel * 0.25);
  const scale      = running ? liveScale : idleScale * 0.65;
  const glowOpacity = running ? 0.3 + heatLevel * 0.7 : 0.1 + idleScale * 0.15;
  const glowColor  = running
    ? `rgba(249,115,22,${glowOpacity})`
    : `rgba(180,70,10,${glowOpacity})`;

  const flickerTransition = (dur: number, delay = 0) => ({
    duration: dur,
    repeat: Infinity,
    ease: 'easeInOut' as const,
    delay,
  });

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      aria-label={running ? 'Detener sesión' : 'Iniciar sesión'}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        width: 160,
        height: 220,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        outline: 'none',
      }}
      whileTap={disabled ? {} : { scale: 0.94 }}
    >
      {/* Ground glow */}
      <motion.div
        style={{
          position: 'absolute',
          bottom: -12,
          left: '50%',
          x: '-50%',
          width: 100,
          height: 28,
          borderRadius: '50%',
          background: glowColor,
          filter: 'blur(10px)',
          pointerEvents: 'none',
        }}
        animate={{ scaleX: [0.85, 1.15, 0.9, 1.1, 0.85], opacity: [0.7, 1, 0.75, 1, 0.7] }}
        transition={flickerTransition(1.6)}
      />

      {/* Outer flame — deep orange/red */}
      <motion.div
        style={{
          position: 'absolute',
          bottom: 0,
          width: 120 * scale,
          height: 190 * scale,
          borderRadius: '50% 50% 20% 20% / 62% 62% 28% 28%',
          background: running
            ? 'radial-gradient(ellipse at 50% 82%, #ff6b00 0%, #c2410c 45%, #7c2d12 100%)'
            : 'radial-gradient(ellipse at 50% 82%, #b45309 0%, #78350f 60%, #451a03 100%)',
          transformOrigin: 'bottom center',
          opacity: disabled ? 0.4 : 1,
        }}
        animate={{
          scaleX: [1, 0.96, 1.03, 0.97, 1.01, 1],
          scaleY: [1, 1.02, 0.98, 1.03, 0.99, 1],
          rotate: [-1, 1.5, -0.8, 1.2, -1.5, -1],
        }}
        transition={flickerTransition(1.3)}
      />

      {/* Mid flame — orange/amber */}
      <motion.div
        style={{
          position: 'absolute',
          bottom: 0,
          width: 80 * scale,
          height: 140 * scale,
          borderRadius: '50% 50% 20% 20% / 62% 62% 28% 28%',
          background: running
            ? 'radial-gradient(ellipse at 50% 82%, #fbbf24 0%, #f97316 48%, #ea580c 100%)'
            : 'radial-gradient(ellipse at 50% 82%, #d97706 0%, #b45309 55%, #78350f 100%)',
          transformOrigin: 'bottom center',
          opacity: disabled ? 0.4 : 1,
        }}
        animate={{
          scaleX: [1, 0.94, 1.04, 0.96, 1.02, 1],
          scaleY: [1, 1.04, 0.97, 1.05, 0.98, 1],
          rotate: [1, -1.8, 0.6, -1.2, 1.8, 1],
        }}
        transition={flickerTransition(1.05, 0.12)}
      />

      {/* Inner hot core — white/pale yellow */}
      <motion.div
        style={{
          position: 'absolute',
          bottom: 0,
          width: 42 * scale,
          height: 82 * scale,
          borderRadius: '50% 50% 20% 20% / 62% 62% 28% 28%',
          background: running
            ? 'radial-gradient(ellipse at 50% 78%, #fffbf0 0%, #fef9c3 28%, #fde68a 65%, #fbbf24 100%)'
            : 'radial-gradient(ellipse at 50% 78%, #fef3c7 0%, #fde68a 40%, #f59e0b 100%)',
          transformOrigin: 'bottom center',
          opacity: disabled ? 0.3 : 1,
        }}
        animate={{
          scaleX: [1, 0.93, 1.05, 0.94, 1.03, 1],
          scaleY: [1, 1.05, 0.96, 1.06, 0.97, 1],
          rotate: [-0.5, 1.2, -1.2, 0.8, -0.8, -0.5],
        }}
        transition={flickerTransition(0.85, 0.22)}
      />

      {/* Tiny tip flicker */}
      <motion.div
        style={{
          position: 'absolute',
          bottom: 0,
          width: 16 * scale,
          height: 40 * scale,
          borderRadius: '50% 50% 20% 20% / 70% 70% 20% 20%',
          background: 'radial-gradient(ellipse at 50% 70%, #ffffff 0%, #fef9c3 60%, transparent 100%)',
          transformOrigin: 'bottom center',
          opacity: running ? 0.85 : 0.3,
        }}
        animate={{
          scaleX: [1, 0.7, 1.3, 0.8, 1.1, 1],
          scaleY: [1, 1.15, 0.9, 1.2, 0.85, 1],
          rotate: [0, 3, -3, 2, -2, 0],
        }}
        transition={flickerTransition(0.65, 0.3)}
      />
    </motion.button>
  );
}
