/**
 * Session Mode Wrapper — single session route, no mode picker.
 *
 * Consolidated from three modes (classic/enhanced/mobile) to one.
 * Camera permission is asked in-session via SessionPreview. If granted
 * → verified. If denied → unverified. The orb shows the difference.
 * Mobile layout is auto-deted by ResponsiveEnhancedSession.
 *
 * Navigates to /post-session on completion (not /results).
 */

import React, { useCallback, useMemo, useRef } from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";
import { BREATHING_PATTERNS } from "../../lib/breathingPatterns";
import { useOfflineManager } from "../../lib/offline/OfflineManager";
import { useSessionStore } from "@/stores/sessionStore";
import { ResponsiveEnhancedSession } from "./ResponsiveEnhancedSession";
import { SessionErrorBoundary } from "../../lib/errors/error-boundary";

/**
 * Session completion handler — navigates to the post-session surface.
 */
const useSessionCompletion = () => {
  const navigate = useNavigate();
  const { saveSession, syncStatus } = useOfflineManager();

  return useCallback(
    (sessionData: {
      pattern: any;
      cycleCount: number;
      breathHoldTime: number;
      restlessnessScore?: number;
      elapsedTime: number;
      phaseAccuracy?: number;
      rhythmConsistency?: number;
      sessionDuration?: number;
      duration?: number;
      patternName?: string;
      sessionType?: string;
      cameraUsed?: boolean;
      aiUsed?: boolean;
      visionSessionId?: string;
      stillnessScore?: number | null;
      startTime?: Date;
    }) => {
      const {
        pattern,
        cycleCount,
        breathHoldTime,
        restlessnessScore,
        phaseAccuracy,
        rhythmConsistency,
        patternName,
      } = sessionData;

      const durationSeconds =
        (typeof sessionData.sessionDuration === "number" && Number.isFinite(sessionData.sessionDuration)
          ? sessionData.sessionDuration
          : null) ??
        (typeof sessionData.duration === "number" && Number.isFinite(sessionData.duration)
          ? sessionData.duration
          : null) ??
        (typeof sessionData.elapsedTime === "number" && Number.isFinite(sessionData.elapsedTime)
          ? sessionData.elapsedTime / 1000
          : 0);

      const elapsedMs = Math.max(0, durationSeconds * 1000);

      const sessionStart =
        sessionData.startTime instanceof Date && !Number.isNaN(sessionData.startTime.getTime())
          ? sessionData.startTime
          : new Date(Date.now() - elapsedMs); // legacy payloads without a real start date

      const sessionId = saveSession({
        patternId: pattern.id || "custom",
        patternName: pattern.name,
        startTime: sessionStart,
        endTime: new Date(),
        duration: durationSeconds,
        cycleCount,
        breathHoldTime,
        restlessnessScore: restlessnessScore || 0,
        completed: true,
      });

      navigate("/post-session", {
        state: {
          breathHoldTime,
          restlessnessScore: restlessnessScore ?? null,
          stillnessScore: sessionData.stillnessScore,
          patternId: pattern.id || "custom",
          patternName: patternName || pattern.name,
          sessionDuration: durationSeconds,
          sessionId,
          isOffline: !syncStatus.isOnline,
          cycleCount,
          phaseAccuracy,
          rhythmConsistency,
          targetCycles: 10,
          sessionType: sessionData.sessionType,
          cameraUsed: sessionData.cameraUsed,
          aiUsed: sessionData.aiUsed,
          visionSessionId: sessionData.visionSessionId,
        },
      });
    },
    [navigate, saveSession, syncStatus.isOnline]
  );
};

export const SessionModeWrapper: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Zustand keeps phase='complete' after a session. Reset before the
  // preview tree mounts, or the next visit skips warmup and dead-ends.
  const sessionKey = `${location.pathname}${location.search}`;
  const lastKeyRef = useRef<string | null>(null);
  if (lastKeyRef.current !== sessionKey) {
    lastKeyRef.current = sessionKey;
    useSessionStore.getState().resetSession();
  }

  // Get pattern from URL search params, location state, or localStorage
  const initialPattern = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const patternParam = searchParams.get('pattern');

    if (patternParam && BREATHING_PATTERNS[patternParam]) {
      return BREATHING_PATTERNS[patternParam];
    }

    if (location.state?.previewPattern) {
      return location.state.previewPattern;
    }

    try {
      const stored = localStorage.getItem("selectedPattern");
      if (stored) return JSON.parse(stored);
    } catch {
      // silent
    }

    return BREATHING_PATTERNS.box;
  }, [location.search, location.state?.previewPattern]);

  const handleSessionComplete = useSessionCompletion();

  const sessionConfig = useMemo(
    () => ({
      pattern: {
        id: initialPattern.id,
        name: initialPattern.name,
        phases: {
          inhale: initialPattern.inhale,
          hold: initialPattern.hold,
          exhale: initialPattern.exhale,
          pause: initialPattern.hold_after_exhale || 0,
        },
        benefits: initialPattern.benefits,
        description: initialPattern.description,
      },
      mode: 'enhanced' as const,
    }),
    [initialPattern]
  );

  const onSessionComplete = useCallback(
    (metrics: any) => {
      handleSessionComplete({
        ...metrics,
        pattern: {
          id: initialPattern.id || "custom",
          name: initialPattern.name,
        },
        patternName: metrics?.patternName ?? initialPattern.name,
      });
    },
    [handleSessionComplete, initialPattern]
  );

  const responsiveConfig = {
    pattern: {
      id: sessionConfig.pattern.id,
      name: sessionConfig.pattern.name,
      phases: sessionConfig.pattern.phases,
      benefits: sessionConfig.pattern.benefits,
      description: sessionConfig.pattern.description,
    },
    mode: 'enhanced' as 'classic' | 'enhanced',
  };

  const modeConfig = {
    enableCamera: true,
    enableVision: true,
  };

  return (
    <SessionErrorBoundary>
      <ResponsiveEnhancedSession
        config={responsiveConfig}
        modeConfig={modeConfig}
        onSessionComplete={onSessionComplete}
        onSessionExit={() => navigate("/")}
      />
    </SessionErrorBoundary>
  );
};

export default SessionModeWrapper;
