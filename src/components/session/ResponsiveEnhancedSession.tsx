/**
 * Responsive Enhanced Session - orb-only for all devices
 *
 * No camera, no vision. The breathing animation is the session;
 * SessionControls end it and report honest timing metrics.
 */

import React from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE } from '../../lib/motion';
import { useIsMobile } from '../../hooks/use-mobile';
import { useSession } from '../../hooks/useSession';
import { useSessionPhase, useSessionStore } from '../../stores/sessionStore';
import { useMascotPresence } from '../../hooks/useMascotPresence';

import BreathingAnimation from '../BreathingAnimation';
import { BrumeMascot, type BrumeMascotState, type MascotReaction } from '../BrumeMascot';
import { SessionControls } from './SessionControls';
import { EnhancedSessionLayout } from './EnhancedSessionLayout';
import { SessionPreview } from './SessionPreview';
import { breathAmount, type BreathPhase } from '../../lib/breathCurve';
import { preloadCues, setVoiceEnabled, speakCue, stopCues } from '../../lib/voiceCues';
import { applyFeel, clearFeel, feelAt } from '../../lib/feelTheme';

interface ResponsiveEnhancedSessionProps {
  config: {
    pattern: {
      id?: string;
      name: string;
      phases: {
        inhale: number;
        hold?: number;
        exhale: number;
        pause?: number;
      };
      benefits?: string[];
      description?: string;
    };
    mode: 'classic' | 'enhanced';
  };
  onSessionComplete: (metrics: any) => void;
  onSessionExit: () => void;
}

export const ResponsiveEnhancedSession: React.FC<ResponsiveEnhancedSessionProps> = ({
  config,
  onSessionComplete,
  onSessionExit,
}) => {
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const { presence: mascotPresence } = useMascotPresence();
  const location = useLocation();
  const checkInIndex = typeof (location.state as { checkInIndex?: number } | null)
    ?.checkInIndex === "number"
    ? (location.state as { checkInIndex: number }).checkInIndex
    : null;

  // The room takes the feeling's tint for as long as the flow runs;
  // leaving the flow releases it back to the daypart default.
  React.useEffect(() => {
    applyFeel(checkInIndex);
    return () => clearFeel();
  }, [checkInIndex]);
  const skipEntranceMotion =
    reduceMotion || (typeof document !== "undefined" && document.hidden);

  // Session phase state - SINGLE SOURCE OF TRUTH
  const sessionPhase = useSessionPhase();

  const session = useSession({
    autoStart: false,
    manageTiming: true,
  });
  const sessionError = useSessionStore((state) => state.error);

  // Normalize the nested-mode pattern into the flat BreathingPattern the
  // store requires — inhale/exhale plus hold and hold_after_exhale.
  const flatPattern = React.useMemo(() => ({
    id: config.pattern.id ?? 'custom',
    name: config.pattern.name,
    description: config.pattern.description ?? '',
    benefits: config.pattern.benefits ?? [],
    inhale: config.pattern.phases.inhale,
    hold: config.pattern.phases.hold ?? 0,
    exhale: config.pattern.phases.exhale,
    hold_after_exhale: config.pattern.phases.pause ?? 0,
  }), [config.pattern]);

  // ENHANCEMENT FIRST: Initialize session with proper config
  React.useEffect(() => {
    if (!useSessionStore.getState().config) {
      session.initialize({
        mode: config.mode,
        pattern: flatPattern,
        enableAudio: true,
        enableAI: false,
      });
    }
  }, [session, config, flatPattern]);

  // Handle session start from the preview
  const handleSessionStart = React.useCallback(() => {
    // Always call session.start() - it handles the ready transition internally
    session.start();

    // CRITICAL FIX: Ensure no return value that could be interpreted as cleanup function
    return undefined;
  }, [session]);

  const breathPhase: BreathPhase =
    (session.metrics?.currentPhase === "pause"
      ? "hold_after_exhale"
      : session.metrics?.currentPhase) || "inhale";
  const breathProgress01 = (session.metrics?.phaseProgress || 0) / 100;
  const sessionActive = session.phase === 'active';
  const audioEnabled = session.audioEnabled;
  const toggleAudio = useSessionStore((s) => s.toggleAudio);

  // Brume speaks: spoken breath cues so a session works with eyes closed.
  // The store emits "pause" for the hold_after_exhale phase — the same phase
  // the UI displays as "Rest".
  React.useEffect(() => {
    preloadCues();
    return () => stopCues();
  }, []);

  React.useEffect(() => {
    setVoiceEnabled(audioEnabled);
  }, [audioEnabled]);

  React.useEffect(() => {
    if (session.phase === 'paused' || session.phase === 'complete') {
      stopCues();
      return;
    }
    if (!sessionActive || !audioEnabled) return;
    speakCue(breathPhase === 'hold_after_exhale' ? 'pause' : breathPhase);
  }, [breathPhase, sessionActive, session.phase, audioEnabled]);

  // Brume IS the breath: centred in the orb, same eased curve.
  const mascotState: BrumeMascotState =
    session.phase === 'complete' ? 'proud'
    : session.phase === 'paused' ? 'sleepy'
    : !sessionActive ? 'watching'
    : breathPhase === 'inhale' ? 'inhale'
    : breathPhase === 'exhale' ? 'exhale'
    : 'hold';
  const mascotBreath = sessionActive && !reduceMotion
    ? breathAmount(breathPhase, breathProgress01, true)
    : undefined;

  const prevPhaseRef = React.useRef(session.phase);
  const [mascotReaction, setMascotReaction] = React.useState<
    { name: MascotReaction; key: number } | undefined
  >();
  React.useEffect(() => {
    if (session.phase === prevPhaseRef.current) return;
    prevPhaseRef.current = session.phase;
    const name: MascotReaction | null =
      session.phase === 'active' ? 'hop'
      : session.phase === 'paused' ? 'settle'
      : session.phase === 'complete' ? 'celebrate'
      : null;
    if (name) setMascotReaction({ name, key: Date.now() });
  }, [session.phase]);

  const animationWithMascot = (
    <BreathingAnimation
      phase={breathPhase}
      pattern={config.pattern}
      isActive={sessionActive}
      isPaused={session.phase === 'paused'}
      phaseProgress={session.metrics?.phaseProgress || 0}
    >
      <BrumeMascot
        state={mascotState}
        breath={mascotBreath}
        reaction={mascotReaction}
        presence={mascotPresence}
        size={isMobile ? 140 : 176}
        layoutId="brume-companion"
        className="absolute z-10"
      />
    </BreathingAnimation>
  );

  // Session controls component
  const controls = (
    <SessionControls
      onEndSession={() => {
        // Complete first: the store freezes the monotonic clock and writes
        // the final timing snapshot before we read it.
        session.complete();
        const finalMetrics = useSessionStore.getState().metrics;
        const durationSeconds = finalMetrics.duration || 0;

        const sessionMetrics = {
          duration: durationSeconds,
          sessionDuration: durationSeconds,
          elapsedTime: durationSeconds * 1000,
          cycleCount: finalMetrics.cycleCount || 0,
          startTime: finalMetrics.startTime,
          breathHoldTime: 0,
          sessionType: config.mode === "classic" ? "classic" : "enhanced",
          patternName: config.pattern.name,
        };

        onSessionComplete(sessionMetrics);
      }}
    />
  );

  const showPreview = ['setup', 'preparation', 'camera_setup'].includes(sessionPhase);

  // The preview and the session hand over with both halves now: the
  // outgoing screen lifts away briefly (AnimatePresence) before the
  // incoming one settles in. Reduced motion keeps only the opacity.
  return (
    <AnimatePresence mode="wait" initial={false}>
      {showPreview ? (
        <motion.div
          key="preview"
          initial={skipEntranceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion
            ? { opacity: 0, transition: { duration: 0.16, ease: [0.3, 0, 0.8, 0.15] } }
            : { opacity: 0, y: 4, transition: { duration: 0.16, ease: [0.3, 0, 0.8, 0.15] } }
          }
          transition={{ duration: 0.22, ease: EASE }}
          className="min-h-screen flex flex-col"
        >
          <SessionPreview
            mascot={
              <BrumeMascot
                state={feelAt(checkInIndex)?.state ?? "watching"}
                presence={mascotPresence}
                trackPointer={mascotPresence === "companion"}
                breathing
                size={112}
                layoutId="brume-companion"
                className="block mx-auto mb-2"
              />
            }
            patternName={config.pattern.name}
            pattern={{
              name: config.pattern.name,
              phases: {
                inhale: config.pattern.phases.inhale,
                hold: config.pattern.phases.hold,
                exhale: config.pattern.phases.exhale,
                pause: config.pattern.phases.pause,
              },
              benefits: config.pattern.benefits,
              description: config.pattern.description,
            }}
            sessionError={sessionError}
            audioEnabled={audioEnabled}
            onToggleAudio={toggleAudio}
            onStart={handleSessionStart}
            onCancel={onSessionExit}
          />
        </motion.div>
      ) : (
        <motion.div
          key="session"
          initial={skipEntranceMotion ? false : { opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduceMotion
            ? { opacity: 0, transition: { duration: 0.16, ease: [0.3, 0, 0.8, 0.15] } }
            : { opacity: 0, scale: 0.995, transition: { duration: 0.16, ease: [0.3, 0, 0.8, 0.15] } }
          }
          transition={{ duration: 0.28, ease: EASE }}
          className="min-h-screen"
        >
          <EnhancedSessionLayout
            breathingAnimation={animationWithMascot}
            controls={controls}
            onExit={onSessionExit}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ResponsiveEnhancedSession;
