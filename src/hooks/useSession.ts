/**
 * Unified Session Hook
 *
 * REPLACES: useEnhancedSession + useSessionFlow + multiple session hooks
 *
 * Provides a clean, simple interface for session management
 * backed by the unified session store.
 *
 * Timing ownership: only the consumer that passes `manageTiming: true`
 * drives the session clock ticks. Other instances subscribe and control.
 *
 * No camera, no vision — the session is pattern + clock only.
 */

import { useEffect, useCallback } from 'react';
import {
  useSessionStore,
  sessionSelectors,
  useSessionPhase,
  useSessionMetrics,
  useSessionConfig,
  SessionConfig
} from '../stores/sessionStore';

export interface UseSessionOptions {
  autoStart?: boolean;
  manageTiming?: boolean;
}

export const useSession = (options: UseSessionOptions = {}) => {
  const {
    autoStart = false,
    manageTiming = false,
  } = options;

  const {
    initializeSession,
    setSessionReady,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    resetSession,
    toggleAudio,
    getSessionDuration,
    getCompletionPercentage,
    getSessionId,
  } = useSessionStore();

  const phase = useSessionPhase();
  const metrics = useSessionMetrics();
  const config = useSessionConfig();

  const isActive = sessionSelectors.isActive();
  const isPaused = sessionSelectors.isPaused();
  const isComplete = sessionSelectors.isComplete();
  const audioEnabled = useSessionStore((state) => state.audioEnabled);

  // ========================================================================
  // SESSION LIFECYCLE
  // ========================================================================

  const initialize = useCallback(async (sessionConfig: SessionConfig) => {
    initializeSession(sessionConfig);
    if (autoStart) {
      setSessionReady();
      startSession();
    }
    return undefined;
  }, [initializeSession, setSessionReady, startSession, autoStart]);

  const start = useCallback(() => {
    const currentState = useSessionStore.getState();
    if (!currentState.config || !['setup', 'ready'].includes(currentState.phase)) {
      return;
    }

    // startSession permits setup|ready and validates the pattern before
    // entering active — an invalid pattern stays in setup, not a black
    // screen.
    startSession();
  }, [startSession]);

  const pause = useCallback(() => {
    pauseSession();
  }, [pauseSession]);

  const resume = useCallback(() => {
    resumeSession();
  }, [resumeSession]);

  const complete = useCallback(() => {
    // Snapshot final timing — consumers read final metrics.
    completeSession();
  }, [completeSession]);

  const reset = useCallback(() => {
    resetSession();
  }, [resetSession]);

  // ========================================================================
  // TIMING — single interval owned by the manageTiming instance
  // ========================================================================

  useEffect(() => {
    if (!manageTiming || phase !== 'active') return;
    useSessionStore.getState().tickSession();
    const interval = setInterval(
      () => useSessionStore.getState().tickSession(),
      100,
    );
    return () => clearInterval(interval);
  }, [manageTiming, phase]);

  // ========================================================================
  // OWNER CLEANUP — pause on owner unmount
  // ========================================================================

  useEffect(() => {
    return () => {
      if (manageTiming) {
        const state = useSessionStore.getState();
        if (state.phase === 'active') {
          state.pauseSession();
        }
      }
    };
  }, [manageTiming]);

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  return {
    // State
    phase,
    metrics,
    config,
    isActive,
    isPaused,
    isComplete,
    audioEnabled,

    // Actions
    initialize,
    start,
    pause,
    resume,
    complete,
    reset,
    toggleAudio,

    // Utilities
    getSessionDuration,
    getCompletionPercentage,
    getSessionId,
  };
};

export default useSession;
