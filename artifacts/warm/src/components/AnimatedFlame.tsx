import type { Intensity } from '@/lib/heat/heatEngine';
// AnimatedFlame.css intentionally NOT imported — no CSS keyframe animations
// during screen-off GPU corruption test.

interface Props {
  intensity: Intensity;
  heatLevel: number; // 0..1
  running: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const BASE_SIZE: Record<Intensity, number> = { low: 0.55, medium: 0.75, high: 1.0 };

/**
 * STATIC flame — no CSS animations, no Framer Motion, no GPU compositor work.
 * Replaces AnimatedFlame temporarily to isolate whether continuous CSS keyframe
 * animations are the cause of GPU texture corruption on screen-off/on cycles.
 */
export default function AnimatedFlame({ intensity, heatLevel, running, onClick, disabled }: Props) {
  const idleScale   = BASE_SIZE[intensity];
  const liveScale   = idleScale * (0.75 + heatLevel * 0.25);
  const scale       = running ? liveScale : idleScale * 0.65;
  const glowOpacity = running ? 0.3 + heatLevel * 0.7 : 0.1 + idleScale * 0.15;
  const glowColor   = running
    ? `rgba(249,115,22,${glowOpacity})`
    : `rgba(180,70,10,${glowOpacity})`;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={running ? 'Detener sesión' : 'Iniciar sesión'}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        width: 110,
        height: 150,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        outline: 'none',
      }}
    >
      {/* Ground glow — static, no animation */}
      <div
        style={{
          position: 'absolute',
          bottom: -12,
          left: '50%',
          marginLeft: -50,
          width: 100,
          height: 28,
          borderRadius: '50%',
          background: glowColor,
          filter: 'blur(10px)',
          pointerEvents: 'none',
        }}
      />

      {/* Outer flame — static */}
      <div
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
      />

      {/* Mid flame — static */}
      <div
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
      />

      {/* Inner hot core — static */}
      <div
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
      />

      {/* Tiny tip — static */}
      <div
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
      />
    </button>
  );
}
