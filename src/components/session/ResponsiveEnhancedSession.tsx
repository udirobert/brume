/**
 * Responsive Enhanced Session - orb-only for all devices
 *
 * No camera, no vision. The breathing animation is the session;
 * SessionControls end it and report honest timing metrics.
 */

import React from 'react';
import { motion, useReducedMotion } from "framer-motion";
import { useIsMobile } from '../../hooks/use-mobile';
import { useSession } from '../../hooks/useSession';
import { useSessionPhase, useSessionStore } from '../../stores/sessionStore';
import { useMascotPresence } from '../../hooks/useMascotPresence';

import BreathingAnimation from '../BreathingAnimation';
import { BrumeMascot, type BrumeMascotState } from '../BrumeMascot';
import { SessionControls } from './SessionControls';
import { EnhancedSessionLayout } from './EnhancedSessionLayout';
import { SessionPreview } from './SessionPreview';
import { breathAmount, type BreathPhase } from '../../lib/breathCurve';
import { preloadCues, setVoiceEnabled, speakCue, stopCues } from '../../lib/voiceCues';

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
        presence={mascotPresence}
        size={isMobile ? 140 : 176}
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

  return (
    showPreview ? (
      <motion.div
        key="preview"
        initial={skipEntranceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="min-h-screen flex flex-col"
      >
        <SessionPreview
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
          onStart={handleSessionStart}
          onCancel={onSessionExit}
        />
      </motion.div>
    ) : (
      <motion.div
        key="session"
        initial={skipEntranceMotion ? false : { opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="min-h-screen"
      >
        <EnhancedSessionLayout
          breathingAnimation={animationWithMascot}
          controls={controls}
          onExit={onSessionExit}
        />
      </motion.div>
    )
  );
};

export default ResponsiveEnhancedSession;
