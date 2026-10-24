/**
 * Responsive Enhanced Session - HONEST UX for all devices
 * 
 * CORE PRINCIPLES APPLIED:
 * - ENHANCEMENT FIRST: Enhanced existing session with better viewport usage
 * - CLEAN: Clear separation of concerns for desktop vs mobile
 * - MODULAR: Reusable components for different layouts
 * - PERFORMANT: Optimized camera handling for mobile
 * - HONEST: Real metrics correlation visible at all times
 */

import React, { useRef } from 'react';
import { motion, useReducedMotion } from "framer-motion";
import { useIsMobile } from '../../hooks/use-mobile';
import { useStableMetrics } from '../../hooks/useStableMetrics';
import { useSession } from '../../hooks/useSession';
import { useSessionPhase, useSessionStore } from '../../stores/sessionStore';

import VideoFeed from '../VideoFeed';
import { VisionManager } from './VisionManager';
import BreathingAnimation from '../BreathingAnimation';
import { BrumeMascot, type BrumeMascotState } from '../BrumeMascot';
import { SessionControls } from './SessionControls';
import { EnhancedSessionLayout } from './EnhancedSessionLayout';
import { SessionPreview } from './SessionPreview';

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
  modeConfig: {
    enableCamera: boolean;
    enableVision: boolean;
  };
  onSessionComplete: (metrics: any) => void;
  onSessionExit: () => void;
  // AGGRESSIVE CONSOLIDATION: Remove sessionId prop - use sessionStore instead
}

export const ResponsiveEnhancedSession: React.FC<ResponsiveEnhancedSessionProps> = ({
  config,
  modeConfig,
  onSessionComplete,
  onSessionExit,
}) => {
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const skipEntranceMotion =
    reduceMotion || (typeof document !== "undefined" && document.hidden);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Session phase state - SINGLE SOURCE OF TRUTH
  const sessionPhase = useSessionPhase();

  // Camera and vision state — the session store's accepted stream only,
  // not the camera store's pending stream.
  const stableMetrics = useStableMetrics();
  const session = useSession({
    autoStart: false,
    enableVision: modeConfig.enableVision,
    targetFPS: isMobile ? 0.5 : 1, // Slower FPS on mobile for performance
    videoElement: videoRef,
    manageTiming: true,
  });
  const cameraStream = session.cameraStream;
  const sessionError = useSessionStore((state) => state.error);

  // DRY: Single source of truth for session ID
  const sessionId = session.getSessionId();

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
      console.log('🔧 Initializing enhanced session with config:', {
        pattern: flatPattern.name,
        mode: config.mode,
        enableVision: modeConfig.enableVision
      });
      session.initialize({
        mode: config.mode,
        pattern: flatPattern,
        enableCamera: false, // actual acquired state, not feature availability
        enableAudio: true,
        enableAI: modeConfig.enableVision,
      });
    }
  }, [session, config, modeConfig, flatPattern]);

  // Debug session phase changes
  React.useEffect(() => {
    console.log('📊 Session phase changed to:', sessionPhase);
  }, [sessionPhase]);

  // Handle session start from preparation flow
  const handleSessionStart = React.useCallback(async (cameraEnabled: boolean) => {
    console.log('🚀 Starting session with camera:', cameraEnabled);
    console.log('🔍 Current session state before start:', {
      phase: session.phase,
      config: !!session.config,
      isActive: session.isActive,
      metrics: session.metrics
    });
    
    // CRITICAL FIX: Use the session's built-in ready transition
    if (session.phase === 'setup') {
      console.log('🔄 Session in setup, using session.start() to handle transition');
    } else {
      console.log('🚀 Session already ready, starting immediately');
    }
    
    // Always call session.start() - it handles the ready transition internally
    session.start(cameraEnabled);
    
    // CRITICAL FIX: Ensure no return value that could be interpreted as cleanup function
    return undefined;
  }, [session]);

  // Session info for display
  const sessionInfo = {
    duration: session.getSessionDuration ? session.getSessionDuration() : "00:00",
    cycle: session.metrics?.cycleCount || 0,
    phase: session.metrics?.currentPhase || "inhale",
    progressPercentage: session.getCompletionPercentage ? session.getCompletionPercentage() : 0,
  };

  // Metrics for display
  const metrics = {
    stillnessScore: stableMetrics.stillnessScore,
    presenceScore: stableMetrics.presenceScore,
    confidenceScore: Math.round(stableMetrics.confidence * 100),
    showMetrics: modeConfig.enableVision && stableMetrics.hasValidData,
  };

  // Video feed component
  const videoFeed = cameraStream ? (
    <div className="relative w-full h-full">
      <VideoFeed
        videoRef={videoRef}
        isActive={session.isActive}
        landmarks={session.visionMetrics?.faceLandmarks || []}
        trackingStatus={(session.visionMetrics?.presence || 0) > 0 ? "TRACKING" : "IDLE"}
        luxuryMode={false}
      />
      <VisionManager
        enabled={modeConfig.enableVision && cameraStream !== null}
        videoRef={videoRef}
        cameraStream={cameraStream}
        sessionId={sessionId ?? ''}
        quiet
        onVisionReady={() => console.log('Vision processing ready')}
        onVisionError={(error) => console.warn('Vision processing error:', error)}
      />
    </div>
  ) : null;

  // Breathing animation component
  // The breath signal from useStableMetrics drives the orb's quality
  // (glow, stability, color) — making verification visible in real time.
  const breathSignal = modeConfig.enableVision
    ? {
        stillness: stableMetrics.stillnessScore,
        confidence: Math.round(stableMetrics.confidence * 100),
        faceDetected: stableMetrics.hasValidData,
        hasValidData: stableMetrics.hasValidData,
      }
    : undefined;

  const breathingAnimation = (
    <BreathingAnimation
      phase={
        (session.metrics?.currentPhase === "pause"
          ? "hold_after_exhale"
          : session.metrics?.currentPhase) || "inhale"
      }
      pattern={config.pattern}
      isActive={session.phase === 'active'}
      isPaused={session.phase === 'paused'}
      text={session.phase === 'paused' ? 'Paused' : undefined}
      cycleCount={session.metrics?.cycleCount || 0}
      phaseProgress={session.metrics?.phaseProgress || 0}
      breathSignal={breathSignal}
      sessionInfo={{
        duration: sessionInfo.duration,
        progressPercentage: sessionInfo.progressPercentage,
      }}
    />
  );

  // Brume rides the corner of the orb and breathes the same phases.
  const breathPhase = session.metrics?.currentPhase;
  const breathProgress01 = (session.metrics?.phaseProgress || 0) / 100;
  const mascotState: BrumeMascotState =
    session.phase === 'complete' ? 'proud'
    : session.phase === 'paused' ? 'sleepy'
    : session.phase !== 'active' ? 'watching'
    : breathPhase === 'inhale' ? 'inhale'
    : breathPhase === 'exhale' ? 'exhale'
    : 'hold';
  const mascotBreath =
    session.phase !== 'active' ? undefined
    : breathPhase === 'inhale' ? breathProgress01
    : breathPhase === 'exhale' ? 1 - breathProgress01
    : breathPhase === 'hold' ? 1
    : 0;
  const animationWithMascot = (
    <div className="relative">
      {breathingAnimation}
      <BrumeMascot
        state={mascotState}
        breath={mascotBreath}
        size={72}
        className="absolute -bottom-3 -right-3"
      />
    </div>
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
        const lastStillness =
          session.visionMetrics?.stillness != null
            ? Math.round(session.visionMetrics.stillness)
            : stableMetrics.hasValidData
              ? stableMetrics.stillnessScore
              : null;

        const sessionMetrics = {
          duration: durationSeconds,
          sessionDuration: durationSeconds,
          elapsedTime: durationSeconds * 1000,
          cycleCount: finalMetrics.cycleCount || 0,
          startTime: finalMetrics.startTime,
          breathHoldTime: 0,
          stillnessScore: lastStillness,
          restlessnessScore: lastStillness != null ? 100 - lastStillness : null,
          cameraUsed: finalMetrics.cameraUsed,
          sessionType: config.mode === "classic" ? "classic" : "enhanced",
          visionSessionId: sessionId,
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
            benefits: config.pattern.benefits || ['Improved focus', 'Stress reduction'],
            description: config.pattern.description || `Experience the ${config.pattern.name} breathing technique with enhanced AI feedback.`
          }}
          enableCamera={modeConfig.enableCamera}
          sessionError={sessionError}
          capture={videoFeed}
          onEnableCamera={session.requestCamera}
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
          videoFeed={videoFeed}
          showVideo={!!cameraStream}
          seen={stableMetrics.hasValidData}
          breathingAnimation={animationWithMascot}
          metrics={metrics}
          sessionInfo={sessionInfo}
          controls={controls}
          isMobile={isMobile}
          onExit={onSessionExit}
        />
      </motion.div>
    )
  );
};

export default ResponsiveEnhancedSession;
