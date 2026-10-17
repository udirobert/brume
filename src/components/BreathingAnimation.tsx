import React, { useMemo } from "react";
import { cn } from "../lib/utils";
import { motion } from "framer-motion";
import {
  getPhaseConfig,
  shouldShowRhythmIndicator,
} from "../lib/breathing-phase-config";
import { HaloRipple } from "./atmosphere/HaloRipple";

/**
 * Breath signal from the vision pipeline — drives the orb's *quality*
 * (glow, stability, color) while the timer drives its *rhythm* (scale).
 *
 * When hasValidData is false or faceDetected is false, the orb falls back
 * to a mechanical timer-only mode — visually dimmer, no verification ring.
 * This is the honest "unverified" state.
 */
export interface BreathSignal {
  stillness: number;      // 0-100 (100 = perfectly still)
  confidence: number;     // 0-100 (face detection confidence)
  faceDetected: boolean;
  hasValidData: boolean;
}

interface BreathingAnimationProps {
  phase:
    | "inhale"
    | "hold"
    | "exhale"
    | "hold_after_exhale"
    | "prepare"
    | "countdown";
  text?: string;
  pattern?: {
    name: string;
    phases: {
      inhale: number;
      hold?: number;
      exhale: number;
      hold_after_exhale?: number;
    };
  };
  isActive?: boolean;
  countdownValue?: number;
  phaseProgress?: number;
  showTimer?: boolean;
  compactMode?: boolean;
  overlayMetrics?: {
    stillness?: number;
    confidence?: number;
  };
  /** Live breath signal from the vision pipeline — makes the orb reactive */
  breathSignal?: BreathSignal;
  cycleCount?: number;
  emotionalState?: "calm" | "focused" | "energized" | "peaceful";
  sessionQuality?: number;
  
  // ENHANCEMENT FIRST: Session progress information (cleaned up - no duplicate metrics)
  sessionInfo?: {
    duration?: string;
    progressPercentage?: number;
  };
}

// ============================================================================
// MIST ORB — the breath-reactive visual core
// ============================================================================
//
// Three layered radial-gradient divs with progressive blur create a
// volumetric mist cloud. The timer drives the scale (inhale grows, exhale
// shrinks). The breath signal drives:
//   - glow intensity (face detection confidence)
//   - opacity (verified = vivid, unverified = dim)
//   - halo ripples (restlessness during hold — surface, not a whole-orb shiver)
//   - color (blue when calm, amber when restless during hold)
//   - verification ring (pulses when face detected, absent when not)
//
// When no breath signal is available (no camera / classic mode), the orb
// runs in "mechanical" mode — timer-driven only, dimmer, no ring. This is
// the visual distinction between verified and unverified practice.

interface MistOrbProps {
  phase: BreathingAnimationProps["phase"];
  phaseProgress: number;
  isActive: boolean;
  compactMode: boolean;
  breathSignal?: BreathSignal;
}

const MistOrb: React.FC<MistOrbProps> = React.memo(({
  phase,
  phaseProgress,
  isActive,
  compactMode,
  breathSignal,
}) => {
  // --- Breath signal interpretation ---
  const hasData = breathSignal?.hasValidData && breathSignal?.faceDetected;
  const stillness = hasData ? breathSignal!.stillness : 50;
  const confidence = hasData ? breathSignal!.confidence : 0;
  const restlessness = 100 - stillness;

  const isHoldPhase = phase === "hold" || phase === "hold_after_exhale";
  const rippleAmp =
    hasData && isHoldPhase && isActive
      ? Math.min(Math.max((restlessness - 18) / 55, 0), 1)
      : 0;

  // Glow: confidence drives how vivid the orb is
  const glowFactor = hasData ? Math.min(confidence / 100, 1) : 0;
  // Opacity: verified = 0.7-1.0, unverified = 0.35 (visually distinct)
  const orbOpacity = hasData ? 0.65 + glowFactor * 0.35 : 0.35;

  // --- Continuous scale from phase + progress ---
  // Smooth grow/shrink that tracks the timer precisely, not hardcoded jumps
  const scale = useMemo(() => {
    if (!isActive) return 0.88;
    const p = Math.min(phaseProgress / 100, 1);
    switch (phase) {
      case "inhale":              return 0.82 + p * 0.42;   // 0.82 → 1.24
      case "hold":                return 1.24;
      case "exhale":              return 1.24 - p * 0.42;   // 1.24 → 0.82
      case "hold_after_exhale":   return 0.82;
      case "prepare":
      case "countdown":           return 1.0;
      default:                    return 1.0;
    }
  }, [phase, phaseProgress, isActive]);

  // --- Color: interpolate blue → amber based on restlessness during hold ---
  const orbColor = useMemo(() => {
    if (!hasData) return { r: 147, g: 197, b: 253 }; // blue-300, dim
    if (isHoldPhase && restlessness > 20) {
      const t = Math.min((restlessness - 20) / 60, 1); // ramp from 20-80
      // blue-300 (147,197,253) → amber-400 (251,191,36)
      return {
        r: Math.round(147 + t * (251 - 147)),
        g: Math.round(197 + t * (191 - 197)),
        b: Math.round(253 + t * (36 - 253)),
      };
    }
    return { r: 147, g: 197, b: 253 }; // blue-300
  }, [hasData, isHoldPhase, restlessness]);

  const rgba = (a: number) => `rgba(${orbColor.r}, ${orbColor.g}, ${orbColor.b}, ${a})`;

  // Sizes — smaller on mobile for performance
  const haloSize = compactMode ? 170 : 230;
  const cloudSize = compactMode ? 130 : 175;
  const coreSize  = compactMode ? 75  : 100;

  // Box shadow glow — scales with confidence
  const coreGlow = hasData
    ? `0 0 ${15 + glowFactor * 45}px ${rgba(0.25 + glowFactor * 0.15)}`
    : `0 0 8px ${rgba(0.08)}`;

  const showVerificationRing = hasData && isActive;

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative flex items-center justify-center">
        {showVerificationRing && (
          <motion.div
            className="absolute rounded-full border"
            style={{
              width: compactMode ? 150 : 200,
              height: compactMode ? 150 : 200,
              borderColor: rgba(0.25),
            }}
            animate={{
              scale: [1, 1.06, 1],
              opacity: [0.3, 0.55, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}

        <motion.div
          animate={{ scale }}
          transition={{
            duration: 0.3,
            ease: "easeOut",
          }}
          className="relative flex items-center justify-center"
        >
          <div
            className="absolute rounded-full"
            style={{
              width: haloSize,
              height: haloSize,
              background: `radial-gradient(circle, ${rgba(0.12 * orbOpacity)} 0%, transparent 70%)`,
              filter: `blur(${compactMode ? 22 : 30}px)`,
            }}
          />

          <HaloRipple
            size={compactMode ? 150 : 200}
            color={rgba(0.55)}
            amplitude={rippleAmp}
          />

          <div
            className="absolute rounded-full"
            style={{
              width: cloudSize,
              height: cloudSize,
              background: `radial-gradient(circle, ${rgba(0.28 * orbOpacity)} 0%, ${rgba(0.08 * orbOpacity)} 55%, transparent 82%)`,
              filter: `blur(${compactMode ? 12 : 16}px)`,
            }}
          />

          <div
            className="absolute rounded-full"
            style={{
              width: coreSize,
              height: coreSize,
              background: `radial-gradient(circle, ${rgba(0.45 * orbOpacity)} 0%, ${rgba(0.18 * orbOpacity)} 60%, transparent 92%)`,
              filter: `blur(${compactMode ? 6 : 8}px)`,
              boxShadow: coreGlow,
            }}
          />
        </motion.div>
      </div>
    </div>
  );
});
MistOrb.displayName = "MistOrb";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const BreathingAnimation = React.memo<BreathingAnimationProps>(
  ({
    phase,
    text,
    pattern,
    isActive = false,
    countdownValue,
    phaseProgress = 0,
    showTimer = false,
        compactMode = false,
        breathSignal,
        cycleCount = 0,
    sessionInfo,
  }) => {
    const phaseConfig = useMemo(() => getPhaseConfig(phase), [phase]);

    const instruction = useMemo(() => {
      if (phase === "countdown" && countdownValue !== undefined) {
        return countdownValue > 0 ? countdownValue.toString() : "Begin";
      }
      if (text && text !== "prepare" && text !== phase) {
        return text;
      }
      return phaseConfig.instruction;
    }, [phase, text, countdownValue, phaseConfig.instruction]);

    // Calculate remaining time for timer display
    const remainingTime = useMemo(() => {
      if (
        !showTimer ||
        !pattern ||
        phase === "countdown" ||
        phase === "prepare"
      ) {
        return null;
      }
      const phaseDuration =
        pattern.phases[phase as keyof typeof pattern.phases] || 0;
      const remaining = Math.ceil(phaseDuration * (1 - phaseProgress / 100));
      return remaining > 0 ? remaining : 0;
    }, [showTimer, pattern, phase, phaseProgress]);

    const RhythmIndicator = () => (
      <div className="w-40 h-2 bg-blue-100/40 rounded-full mx-auto">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-100 ease-linear bg-linear-to-r",
            phaseConfig.rhythmGradient
          )}
          style={{
            width: `${Math.max(5, phaseProgress)}%`,
          }}
        />
      </div>
    );

    // The orb owns the screen. Phase word only — no pep.
    const SessionOverlay = () => {
      if (!sessionInfo || !isActive) return null;

      return (
        <div className="absolute -top-2 -right-2 flex flex-col items-end gap-0.5 text-[10px] font-mono text-slate-400/70 dark:text-slate-500/70 pointer-events-none select-none">
          <span>{sessionInfo.duration || "00:00"}</span>
          {cycleCount > 0 && <span>cycle {cycleCount}</span>}
        </div>
      );
    };

    const CenterContent = () => (
      <div className="z-10 text-center space-y-3">
        <p
          className={cn(
            compactMode ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl",
            "font-light transition-all duration-500",
            phaseConfig.color
          )}
        >
          {instruction}
        </p>

        {/* Timer display for enhanced mode */}
        {showTimer && remainingTime !== null && (
          <p className="text-2xl md:text-3xl font-mono text-slate-500">
            {remainingTime}
          </p>
        )}

        {shouldShowRhythmIndicator(isActive, pattern, phase) && !showTimer && (
          <RhythmIndicator />
        )}

        {/* Only show pattern name when not active and no session info */}
        {!isActive && pattern && phase !== "countdown" && !sessionInfo && (
          <p className="text-sm text-muted-foreground opacity-80 font-medium">
            {pattern.name}
          </p>
        )}
      </div>
    );

    return (
      <div
        className={cn(
          "relative flex items-center justify-center",
          compactMode
            ? "w-48 h-48 md:w-56 md:h-56"
            : "w-64 h-64 md:w-80 md:h-80",
        )}
      >
        {/* MINIMAL OVERLAY: duration + cycle, top-right corner */}
        <SessionOverlay />

        {/* MIST ORB — breath-reactive visual core */}
        <MistOrb
          phase={phase}
          phaseProgress={phaseProgress}
          isActive={isActive}
          compactMode={compactMode}
          breathSignal={breathSignal}
        />

        <CenterContent />
      </div>
    );
  }
);

BreathingAnimation.displayName = "BreathingAnimation";

export default BreathingAnimation;
