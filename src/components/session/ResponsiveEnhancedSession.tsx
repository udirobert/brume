/**
 * Responsive Enhanced Session - orb-only for all devices
 *
 * No camera, no vision. The breathing animation is the session;
 * SessionControls end it and report honest timing metrics.
 */

import { track } from "@/lib/events";
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE } from '../../lib/motion';
import { useIsMobile } from '../../hooks/use-mobile';
import { useSession } from '../../hooks/useSession';
import { useSessionPhase, useSessionStore } from '../../stores/sessionStore';
import { useMascotPresence } from '../../hooks/useMascotPresence';

import BreathingAnimation from '../BreathingAnimation';
import { type BrumeMascotState, type MascotReaction } from '../BrumeMascot';
import { CompanionAnchor } from '../companion/JourneyCompanion';
import { SessionControls } from './SessionControls';
import { EnhancedSessionLayout } from './EnhancedSessionLayout';
import { SessionPreview } from './SessionPreview';
import { breathAmount, type BreathPhase } from '../../lib/breathCurve';
import { preloadCues, setCueStyle as setVoiceCueStyle, setVoiceEnabled, speakCue, speakLine, stopCues } from '../../lib/voiceCues';
import { sessionGreeting } from '../../lib/spokenGreeting';
import { applyFeel, feelAt } from '../../lib/feelTheme';
import { demeanorForFeel } from '../../lib/roomExperience';

// The session keeps its own ending: past a quiet anchor it pauses itself
// at the next full-breath boundary — the landing. A tap on the mist picks
// the breath back up; left alone for one slow beat, it lets itself down
// into the post-session landing. The anchor matches the fullness the
// room's practice meter uses (practiceProgress in roomExperience).
const LANDING_SECONDS = 90;
const LANDING_HOLD_MS = 10_000;
const LANDING_NOTE =
  "About a minute and a half — then the breath offers to rest.";

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
  const navigate = useNavigate();
  const checkInIndex = typeof (location.state as { checkInIndex?: number } | null)
    ?.checkInIndex === "number"
    ? (location.state as { checkInIndex: number }).checkInIndex
    : null;

  // The room takes the feeling's tint for as long as the flow runs;
  // leaving the flow releases it back to the daypart default.
  React.useEffect(() => {
    applyFeel(checkInIndex);
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
    // "Meet me where I am": the line is spoken inside the tap itself —
    // the gesture unlocks audio and consents to the words leaving the
    // device. It hands you into the first breath; overlapping phase
    // cues hold while it plays (see voiceCues).
    if (session.audioEnabled && session.cueStyle === "spoken") {
      speakLine(sessionGreeting(checkInIndex));
    }
    // Always call session.start() - it handles the ready transition internally
    session.start();

    // CRITICAL FIX: Ensure no return value that could be interpreted as cleanup function
    return undefined;
  }, [session, checkInIndex]);

  const startConsumedRef = React.useRef(false);
  React.useEffect(() => {
    const flagged = (location.state as { startImmediately?: boolean } | null)
      ?.startImmediately === true;
    if (!flagged || startConsumedRef.current) return;
    if (!useSessionStore.getState().config) return;
    startConsumedRef.current = true;
    // One tap on Begin = one commitment: the session must be underway.
    // A leftover paused/complete session from an earlier visit must never
    // surface as a paused landing that demands a second play press —
    // restart the chosen rhythm from the top instead.
    const stalePhase = useSessionStore.getState().phase;
    if (stalePhase !== 'setup') {
      useSessionStore.getState().resetSession();
      session.initialize({
        mode: config.mode,
        pattern: flatPattern,
        enableAudio: true,
        enableAI: false,
      });
    }
    if (session.audioEnabled && session.cueStyle === "spoken") {
      speakLine(sessionGreeting(checkInIndex));
    }
    session.start();
    navigate(location.pathname + location.search, {
      replace: true,
      state: { ...(location.state as object), startImmediately: false },
    });
  }, [location.state, location.pathname, location.search, session, navigate, config.mode, flatPattern, checkInIndex]);

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
    setVoiceCueStyle(session.cueStyle);
  }, [session.cueStyle]);

  React.useEffect(() => {
    if (session.phase === 'paused' || session.phase === 'complete') {
      stopCues();
      return;
    }
    if (!sessionActive || !audioEnabled) return;
    speakCue(breathPhase === 'hold_after_exhale' ? 'pause' : breathPhase);
  }, [breathPhase, sessionActive, session.phase, audioEnabled]);

  // Brume IS the breath: centred in the orb, same eased curve.
  const heavy = feelAt(checkInIndex)?.valence === 'heavy';
  const feelDemeanor = demeanorForFeel(checkInIndex);
  const sessionDemeanor =
    feelDemeanor === 'sheltering' && (session.metrics?.duration ?? 0) >= 30
      ? 'attentive'
      : feelDemeanor;
  const mascotState: BrumeMascotState =
    session.phase === 'complete' ? (heavy ? 'tender' : 'proud')
    : session.phase === 'paused' ? 'sleepy'
    : !sessionActive ? 'watching'
    : breathPhase === 'inhale' ? 'inhale'
    : breathPhase === 'exhale' ? 'exhale'
    : 'hold';
  const mascotBreath = sessionActive && !reduceMotion
    ? breathAmount(breathPhase, breathProgress01, true)
    : undefined;

  const prevPhaseRef = React.useRef(session.phase);
  const reactionSerial = React.useRef(0);
  const reactionScope = React.useId();
  const [mascotReaction, setMascotReaction] = React.useState<
    { name: MascotReaction; key: string } | undefined
  >();
  React.useEffect(() => {
    const name = feelAt(checkInIndex)?.reaction ?? 'ready';
    setMascotReaction({ name, key: `${reactionScope}-${++reactionSerial.current}` });
  }, [checkInIndex, reactionScope]);
  React.useEffect(() => {
    if (session.phase === prevPhaseRef.current) return;
    prevPhaseRef.current = session.phase;
    const name: MascotReaction | null =
      session.phase === 'active' ? (heavy ? 'ready' : 'hop')
      : session.phase === 'paused' ? 'settle'
      : session.phase === 'complete' ? 'settle'
      : null;
    if (name) setMascotReaction({ name, key: `${reactionScope}-${++reactionSerial.current}` });
  }, [session.phase, heavy, reactionScope]);

  const endSession = React.useCallback(() => {
    // Complete first: the store freezes the monotonic clock and writes
    // the final timing snapshot before we read it.
    session.complete();
    const finalMetrics = useSessionStore.getState().metrics;
    const durationSeconds = finalMetrics.duration || 0;

    onSessionComplete({
      duration: durationSeconds,
      sessionDuration: durationSeconds,
      elapsedTime: durationSeconds * 1000,
      cycleCount: finalMetrics.cycleCount || 0,
      startTime: finalMetrics.startTime,
      breathHoldTime: 0,
      sessionType: config.mode === "classic" ? "classic" : "enhanced",
      patternName: config.pattern.name,
    });
  }, [session, onSessionComplete, config.mode, config.pattern.name]);
  const endSessionRef = React.useRef(endSession);
  endSessionRef.current = endSession;

  // Offered once per session — a resume means open-ended was chosen.
  const [landing, setLanding] = React.useState(false);
  const landingOffered = React.useRef(false);

  const atRestingPoint =
    sessionActive && breathPhase === "inhale" && breathProgress01 <= 0.1;

  React.useEffect(() => {
    if (landing || landingOffered.current || !atRestingPoint) return;
    if ((session.metrics?.duration ?? 0) < LANDING_SECONDS) return;
    landingOffered.current = true;
    track("landing_reached", { seconds: Math.round(session.metrics?.duration ?? 0) });
    session.pause();
    setLanding(true);
  }, [atRestingPoint, landing, session]);

  // A fresh session (setup/ready after a store reset) re-arms the offer.
  React.useEffect(() => {
    if (session.phase === "setup" || session.phase === "ready") {
      landingOffered.current = false;
      setLanding(false);
    }
  }, [session.phase]);

  // Resuming cancels the landing; left alone, it lets itself down.
  React.useEffect(() => {
    if (!landing) return;
    if (session.phase !== "paused") {
      if (session.phase === "active") track("landing_resumed", {});
      setLanding(false);
      return;
    }
    const hold = window.setTimeout(() => {
      track("landing_settled", {});
      endSessionRef.current();
    }, LANDING_HOLD_MS);
    return () => window.clearTimeout(hold);
  }, [landing, session.phase]);

  // Paused is a user-stop, and the way back is the orb itself: tapping
  // the mist resumes the breath (the icon button stays the keyboard path).
  const pausedResume = session.phase === 'paused';
  const animationWithMascot = (
    <div
      onClick={pausedResume ? session.resume : undefined}
      className={pausedResume ? "cursor-pointer" : undefined}
    >
      <BreathingAnimation
        phase={breathPhase}
        pattern={config.pattern}
        isActive={sessionActive}
        isPaused={session.phase === 'paused'}
        landing={landing}
        phaseProgress={session.metrics?.phaseProgress || 0}
      >
        <CompanionAnchor
          state={mascotState}
          breath={mascotBreath}
          reaction={mascotReaction}
          presence={mascotPresence}
          demeanor={sessionDemeanor}
          size={isMobile ? 140 : 176}
          className="absolute z-10"
        />
      </BreathingAnimation>
    </div>
  );

  // Session controls component
  const controls = (
    <SessionControls onEndSession={() => endSessionRef.current()} />
  );

  // 'ready' must wait at the preview like 'setup' — the session screen
  // out here is active/paused territory only; a ready-phase landing used
  // to render a dead play button (pause() no-ops when not yet active).
  const showPreview = ['setup', 'preparation', 'camera_setup', 'ready'].includes(sessionPhase);

  // The preview and the session hand over with both halves now: the
  // outgoing screen lifts away briefly (AnimatePresence) before the
  // incoming one settles in. Reduced motion keeps only the opacity.
  return (
    <AnimatePresence mode="popLayout" initial={false}>
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
              <CompanionAnchor
                state={feelAt(checkInIndex)?.state ?? "watching"}
                reaction={mascotReaction}
                demeanor={feelDemeanor}
                presence={mascotPresence}
                trackPointer={mascotPresence === "companion"}
                breathing
                size={112}
                tapReaction={feelAt(checkInIndex)?.reaction ?? "ready"}
                allowTapEscalation={!heavy}
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
            onVoiceState={(s) =>
              s === "listening" &&
              setMascotReaction({ name: "ready", key: `${reactionScope}-${++reactionSerial.current}` })
            }
            audioEnabled={audioEnabled}
            cueStyle={session.cueStyle}
            onChooseCues={(choice) => {
              if (choice === "quiet") {
                session.setAudioEnabled(false);
              } else {
                session.setCueStyle(choice);
                session.setAudioEnabled(true);
              }
            }}
            landingNote={LANDING_NOTE}
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
