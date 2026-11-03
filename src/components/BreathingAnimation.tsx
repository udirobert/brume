import React, { useMemo } from "react";
import { cn } from "../lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { breathScale, breathGlow, type BreathPhase } from "../lib/breathCurve";
import { EASE } from "../lib/motion";

/**
 * The mist orb IS the session — always vivid, timer-driven only.
 * A mascot rendered as `children` sits at its centre and breathes
 * the same eased curve (the caller drives that from breathCurve too).
 */

interface BreathingAnimationProps {
  phase: BreathPhase;
  text?: string;
  pattern?: {
    name: string;
    phases: {
      inhale: number;
      hold?: number;
      exhale: number;
      hold_after_exhale?: number;
      pause?: number;
    };
  };
  isActive?: boolean;
  /** Session paused — the word still shows, orb stays inactive. */
  isPaused?: boolean;
  countdownValue?: number;
  phaseProgress?: number;
  compactMode?: boolean;
  children?: React.ReactNode;
}

const PHASE_WORDS: Record<string, string> = {
  inhale: "Breathe in",
  hold: "Hold",
  exhale: "Breathe out",
  hold_after_exhale: "Rest",
  prepare: "Get Ready",
};

// ============================================================================
// MIST ORB — layered blurred halos in the Brume lavender + a soft
// pear ring. Fixed ~0.9 opacity: there is no "unverified" dim state.
// ============================================================================

const MistOrb: React.FC<{
  phase: BreathPhase;
  phaseProgress: number;
  isActive: boolean;
  compactMode: boolean;
}> = React.memo(({ phase, phaseProgress, isActive, compactMode }) => {
  const reduceMotion = useReducedMotion();
  const p01 = Math.min(phaseProgress / 100, 1);
  const scale = useMemo(
    () => (reduceMotion ? 1 : breathScale(phase, p01, isActive)),
    [phase, p01, isActive, reduceMotion],
  );
  const glow = reduceMotion ? breathGlow(phase, p01, isActive) : 0.9;

  // Sized against the viewport so the peak of the inhale (x1.24) never clips.
  const haloSize = compactMode ? "min(340px, 80vw)" : "min(460px, 100vw)";
  const cloudSize = compactMode ? "min(240px, 56vw)" : "min(320px, 70vw)";
  const coreSize = compactMode ? "min(140px, 34vw)" : "min(190px, 42vw)";
  const ringSize = compactMode ? "min(260px, 60vw)" : "min(340px, 66vw)";
  // --brume-orb-mist is set by feelTheme when a check-in word tints the room.
  const mist = "var(--brume-orb-mist, rgb(124 140 201))";

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        animate={{ scale }}
        // 0.2s linear: the curve itself is already eased per tick —
        // this just smooths between timer updates.
        transition={{ duration: 0.2, ease: "linear" }}
        className="relative flex items-center justify-center"
        style={{ opacity: glow }}
      >
        <div
          className="absolute rounded-full"
          style={{
            width: haloSize,
            height: haloSize,
            background: `radial-gradient(circle, color-mix(in srgb, ${mist} 55%, transparent) 0%, transparent 70%)`,
            filter: "blur(40px)",
          }}
        />
        <div
          className="absolute rounded-full border-2"
          style={{
            width: ringSize,
            height: ringSize,
            borderColor: "var(--brume-pear-soft)",
            opacity: 0.85,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: cloudSize,
            height: cloudSize,
            background: `radial-gradient(circle, color-mix(in srgb, ${mist} 75%, transparent) 0%, color-mix(in srgb, ${mist} 30%, transparent) 55%, transparent 82%)`,
            filter: "blur(22px)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: coreSize,
            height: coreSize,
            background: `radial-gradient(circle, color-mix(in srgb, ${mist} 45%, transparent) 0%, color-mix(in srgb, ${mist} 22%, transparent) 60%, transparent 92%)`,
            filter: "blur(10px)",
          }}
        />
      </motion.div>
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
    isPaused = false,
    countdownValue,
    phaseProgress = 0,
    compactMode = false,
    children,
  }) => {
    const instruction = useMemo(() => {
      if (phase === "countdown" && countdownValue !== undefined) {
        return countdownValue > 0 ? countdownValue.toString() : "Begin";
      }
      if (isPaused) return "Take your time";
      if (text && text !== "prepare" && text !== phase) return text;
      return PHASE_WORDS[phase] ?? "";
    }, [phase, text, countdownValue, isPaused]);

    const showWord = isActive || isPaused || phase === "countdown";

    return (
      <div className="relative flex flex-col items-center justify-center">
        <div
          className={cn(
            "relative flex items-center justify-center",
            compactMode
              ? "w-[260px] h-[260px] md:w-[300px] md:h-[300px]"
              : "w-[340px] h-[340px] md:w-[400px] md:h-[400px]",
          )}
        >
          <MistOrb
            phase={phase}
            phaseProgress={phaseProgress}
            isActive={isActive}
            compactMode={compactMode}
          />
          {/* The mascot sits at the centre of the breath */}
          {children}
        </div>

        {/* Phase word — below the orb, fading between words */}
        <div className="relative z-10 mt-6 h-9 text-center" aria-live="polite">
          {showWord ? (
            <motion.p
              key={instruction}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="text-2xl font-light text-foreground/85"
            >
              {instruction}
            </motion.p>
          ) : pattern ? (
            <p className="text-sm text-muted-foreground font-medium">
              {pattern.name}
            </p>
          ) : null}
        </div>
      </div>
    );
  },
);

BreathingAnimation.displayName = "BreathingAnimation";

export default BreathingAnimation;
