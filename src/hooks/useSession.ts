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
 */

import { useEffect, useCallback, useRef } from 'react';
import {
  useSessionStore,
  sessionSelectors,
  useSessionPhase,
  useSessionMetrics,
  useSessionConfig,
  SessionConfig
} from '../stores/sessionStore';
import { useVisionStore, visionSelectors } from '../stores/visionStore';
import { useCameraStore } from '../stores/cameraStore';

export interface UseSessionOptions {
  autoStart?: boolean;
  enableVision?: boolean;
  targetFPS?: number;
  videoElement?: React.RefObject<HTMLVideoElement | null>;
  manageTiming?: boolean;
}

export const useSession = (options: UseSessionOptions = {}) => {
  const {
    autoStart = false,
    enableVision = false,
    manageTiming = false,
    videoElement,
  } = options;

  const {
    initializeSession,
    setSessionReady,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    resetSession,
    setCameraStream,
    setCameraPermission,
    toggleAudio,
    setVisionActive,
    updateVisionMetrics,
    setError,
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
  // The session store's accepted stream — NOT the camera store's pending
  // stream, so a late getUserMedia resolution can't mount vision after a
  // camera-free start.
  const cameraStream = useSessionStore((state) => state.cameraStream);
  const sessionVisionMetrics = useSessionStore((state) => state.visionMetrics);

  const { requestStream: requestCameraStream } = useCameraStore();

  const visionStore = useVisionStore();
  const isVisionActive = visionSelectors.isActive();
  const visionMetrics = visionSelectors.hasMetrics() ? visionStore.metrics : null;

  // ========================================================================
  // CAMERA OWNERSHIP — scoped to the hook instance that acquired the stream
  // ========================================================================

  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const ownedStreamRef = useRef<MediaStream | null>(null);
  const inFlightRef = useRef<Promise<MediaStream | null> | null>(null);

  const releaseOwnedCamera = useCallback(() => {
    generationRef.current += 1;
    const owned = ownedStreamRef.current;
    ownedStreamRef.current = null;
    if (owned) {
      const state = useSessionStore.getState();
      if (state.cameraStream === owned) {
        state.setCameraStream(null);
        state.setCameraPermission(false);
      }
      useCameraStore.getState().releaseStream();
    }
  }, []);

  const requestCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (ownedStreamRef.current) return ownedStreamRef.current;
    if (inFlightRef.current) return inFlightRef.current;

    const generation = generationRef.current;
    const pending = (async () => {
      try {
        const stream = await requestCameraStream();
        // A camera-free start or unmount during the pending request
        // invalidates this acquisition — release it without adopting it
        // and without touching session error/media state.
        if (!mountedRef.current || generation !== generationRef.current) {
          if (stream) useCameraStore.getState().releaseStream();
          return null;
        }
        if (!stream) {
          setError('Camera access failed');
          return null;
        }
        ownedStreamRef.current = stream;
        setCameraStream(stream);
        setCameraPermission(true);
        return stream;
      } catch (error) {
        // A stale or unmounted requester must not surface errors on a
        // session that already chose camera-free or a new session.
        if (!mountedRef.current || generation !== generationRef.current) {
          return null;
        }
        let errorMessage = 'Camera access was denied. Continuing without camera tracking.';
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            errorMessage = 'Camera access denied. You can still practise without it.';
          } else if (error.name === 'NotFoundError') {
            errorMessage = 'No camera found. Please connect a camera and try again.';
          } else if (error.name === 'NotReadableError') {
            errorMessage = 'Camera is already in use by another application.';
          }
        }
        setError(errorMessage);
        return null;
      } finally {
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = pending;
    return pending;
  }, [requestCameraStream, setCameraStream, setCameraPermission, setError]);

  // ========================================================================
  // SESSION LIFECYCLE
  // ========================================================================

  // Initialize stores config only — never requests camera, never starts
  // vision. VisionManager is the sole vision runner after an explicitly
  // acquired stream.
  const initialize = useCallback(async (sessionConfig: SessionConfig) => {
    initializeSession(sessionConfig);
    if (autoStart) {
      setSessionReady();
      startSession();
    }
    return undefined;
  }, [initializeSession, setSessionReady, startSession, autoStart]);

  const start = useCallback((cameraEnabled = false) => {
    const currentState = useSessionStore.getState();
    if (!currentState.config || !['setup', 'ready'].includes(currentState.phase)) {
      return;
    }

    if (!cameraEnabled) {
      // Camera-free start: invalidate any pending request and release an
      // owned stream — a late getUserMedia must not mount vision.
      releaseOwnedCamera();
      const fresh = useSessionStore.getState();
      fresh.setCameraStream(null);
      fresh.setCameraPermission(false);
    }

    const stream = cameraEnabled ? useSessionStore.getState().cameraStream : null;
    const actualCamera = cameraEnabled && !!stream;
    useSessionStore.getState().updatePatternMetrics({
      cameraUsed: actualCamera,
    });
    useSessionStore.setState({
      config: { ...currentState.config, enableCamera: actualCamera },
    });

    // startSession permits setup|ready and validates the pattern before
    // entering active — an invalid pattern stays in setup, not a black
    // screen.
    startSession();
  }, [releaseOwnedCamera, startSession]);

  const pause = useCallback(() => {
    pauseSession();
  }, [pauseSession]);

  const resume = useCallback(() => {
    resumeSession();
  }, [resumeSession]);

  const stopOwnedVision = useCallback(() => {
    // Read fresh — the zustand hook object is a new identity every update.
    const vision = useVisionStore.getState();
    const session = useSessionStore.getState();
    if (vision.isActive && vision.config?.sessionId === session.sessionId) {
      vision.stop();
      session.setVisionActive(false);
    }
  }, []);

  const complete = useCallback(() => {
    // Snapshot final timing before release — consumers read final metrics.
    completeSession();
    releaseOwnedCamera();
    if (manageTiming) stopOwnedVision();
  }, [completeSession, releaseOwnedCamera, manageTiming, stopOwnedVision]);

  // Controls consumers can complete the session; only the timing owner
  // then releases the owned camera stream and stops its vision.
  useEffect(() => {
    if (manageTiming && phase === 'complete') {
      stopOwnedVision();
      releaseOwnedCamera();
    }
  }, [manageTiming, phase, stopOwnedVision, releaseOwnedCamera]);

  const reset = useCallback(() => {
    releaseOwnedCamera();
    resetSession();
    if (manageTiming && visionStore.isActive) {
      visionStore.reset();
    }
  }, [releaseOwnedCamera, resetSession, manageTiming, visionStore]);

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
  // OWNER CLEANUP — pause on owner unmount, release owned resources only
  // ========================================================================

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (manageTiming) {
        const state = useSessionStore.getState();
        if (state.phase === 'active') {
          state.pauseSession();
        }
        const vision = useVisionStore.getState();
        if (vision.isActive && vision.config?.sessionId === state.sessionId) {
          vision.stop();
          state.setVisionActive(false);
        }
      }
      releaseOwnedCamera();
    };
  }, [manageTiming, releaseOwnedCamera]);

  // ========================================================================
  // VISION METRICS PROPAGATION (unchanged behavior)
  // ========================================================================

  const previousVisionMetricsRef = useRef<string>('');

  useEffect(() => {
    if (enableVision && visionMetrics) {
      const { stillness, presence, posture, restlessnessScore, faceLandmarks } = visionMetrics;
      const metricsHash = JSON.stringify({
        stillness,
        presence,
        posture,
        restlessnessScore,
        faceLandmarksCount: faceLandmarks?.length || 0
      });
      if (metricsHash !== previousVisionMetricsRef.current) {
        previousVisionMetricsRef.current = metricsHash;
        updateVisionMetrics({
          stillness,
          presence,
          posture,
          restlessnessScore,
          faceLandmarks,
        });
      }
    }
  }, [enableVision, visionMetrics, updateVisionMetrics]);

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

    // Vision state (if enabled)
    visionMetrics: enableVision ? sessionVisionMetrics : null,
    visionActive: enableVision ? isVisionActive : false,

    // Actions
    initialize,
    start,
    pause,
    resume,
    complete,
    reset,
    toggleAudio,
    requestCamera,

    // Utilities
    getSessionDuration,
    getCompletionPercentage,
    getSessionId,

    // Camera state — the accepted session stream, not the raw camera store
    cameraStream,
    cameraPermissionGranted: useSessionStore((state) => state.cameraPermissionGranted),
  };
};

export default useSession;
