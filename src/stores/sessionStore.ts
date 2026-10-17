/**
 * Unified Session State Store
 * 
 * SINGLE SOURCE OF TRUTH for all session state management.
 * Eliminates duplication across multiple session components and hooks.
 * 
 * Built with Zustand for clean, predictable state management.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { BreathingPattern } from '../lib/breathingPatterns';
import { errorReporter } from '../lib/errors/error-reporter';
import { trackSessionCompleted } from '../lib/notifications/oneSignal';
import type { SessionPhase, BreathPhase, SessionMode, SessionMetrics, PerformanceMode, VisionMetrics } from '../types/metrics';
import {
  createSessionClock,
  pauseSessionClock,
  resumeSessionClock,
  sampleSessionTiming,
  type SessionClock,
} from '../lib/utils/session-timing';

// ============================================================================
// SESSION-SPECIFIC TYPES - Session store specific interfaces
// ============================================================================

export interface SessionConfig {
  mode: SessionMode;
  pattern: BreathingPattern;
  enableCamera: boolean;
  enableAudio: boolean;
  enableAI: boolean;
  maxCycles?: number;
}

// SessionMetrics now imported from types/metrics.ts

export interface SessionState {
  // Core session state
  phase: SessionPhase;
  config: SessionConfig | null;
  metrics: SessionMetrics;
  sessionId: string | null; // Stable session ID

  // Media state
  cameraStream: MediaStream | null;
  cameraPermissionGranted: boolean;
  audioEnabled: boolean;

  // Vision processing state
  visionActive: boolean;
  visionMetrics: VisionMetrics | null;

  // Session outcome (set on completion; cleared on reset)
  lastSessionVerified: boolean;

  // Monotonic active-time clock driving duration/rhythm/cycles
  clock: SessionClock;

  // Error and warning state
  error: string | null;
  warnings: string[];

  // Performance state
  performanceMode: PerformanceMode;
}

// ============================================================================
// ACTIONS - Clean, focused state mutations
// ============================================================================

export interface SessionActions {
  // Session lifecycle
  initializeSession: (config: SessionConfig) => void;
  setSessionReady: () => void;
  startSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  completeSession: () => void;
  resetSession: () => void;
  tickSession: () => void;

  // Phase management
  updateBreathPhase: (phase: BreathPhase, progress: number) => void;
  incrementCycle: () => void;

  // Pattern performance tracking
  updatePatternMetrics: (metrics: Partial<SessionMetrics>) => void;
  recordPatternPerformance: (patternId: string, completionRate: number, engagement: number) => void;

  // Media management
  setCameraStream: (stream: MediaStream | null) => void;
  setCameraPermission: (granted: boolean) => void;
  toggleAudio: () => void;

  // Vision processing
  setVisionActive: (active: boolean) => void;
  updateVisionMetrics: (metrics: VisionMetrics | null) => void;

  // Error handling
  setError: (error: string | null) => void;
  addWarning: (warning: string) => void;
  clearWarnings: () => void;

  // Performance
  setPerformanceMode: (mode: PerformanceMode) => void;

  // Utilities
  getSessionDuration: () => string;
  getCompletionPercentage: () => number;
  getSessionId: () => string | null;
}

// ============================================================================
// INITIAL STATE - Clean defaults
// ============================================================================

const initialMetrics: SessionMetrics = {
  duration: 0,
  cycleCount: 0,
  cameraUsed: false,
  sessionType: 'basic',
  currentPhase: 'inhale',
  phaseProgress: 0,
};

const initialState: SessionState = {
  phase: 'setup',
  config: null,
  metrics: initialMetrics,
  sessionId: null,
  cameraStream: null,
  cameraPermissionGranted: false,
  audioEnabled: true,
  visionActive: false,
  visionMetrics: null,
  lastSessionVerified: false,
  clock: createSessionClock(),
  error: null,
  warnings: [],
  performanceMode: 'optimal',
};

// ============================================================================
// STORE - Unified session state with clean actions
// ============================================================================

export const useSessionStore = create<SessionState & SessionActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // Session lifecycle actions
    initializeSession: (config) => {
      const sessionId = `session_${Date.now()}`;
      set({
        config,
        sessionId,
        phase: 'setup',
        metrics: { ...initialMetrics },
        clock: createSessionClock(),
        error: null,
        warnings: [],
      });
      
      // MODULAR: Notify error reporter of new session
      try {
        errorReporter.updateSessionId(sessionId);
      } catch (e) {
        console.warn('Error reporter not available, session ID not updated.', e);
        // Graceful fallback
      }
      
      console.log('🔧 Session initialized with ID:', sessionId);
    },

    setSessionReady: () => {
      set((state) => (
        ['setup', 'preparation', 'camera_setup'].includes(state.phase)
          ? { phase: 'ready' as SessionPhase, error: null }
          : state
      ));
    },

    startSession: () => {
      const state = get();
      if (!state.config || !['setup', 'ready'].includes(state.phase)) return;
      const now = performance.now();
      const clock = resumeSessionClock(createSessionClock(), now);
      try {
        const timing = sampleSessionTiming(clock, state.config.pattern, now);
        set({
          phase: 'active',
          clock,
          metrics: {
            ...state.metrics,
            ...timing,
            startTime: new Date(),
          },
          error: null,
        });
      } catch {
        set({ error: 'This breathing pattern is unavailable. Choose another rhythm.' });
      }
    },

    pauseSession: () => {
      set((state) => {
        if (state.phase !== 'active' || !state.config) return state;
        const now = performance.now();
        const clock = pauseSessionClock(state.clock, now);
        return {
          phase: 'paused' as SessionPhase,
          clock,
          metrics: {
            ...state.metrics,
            ...sampleSessionTiming(clock, state.config.pattern, now),
          },
        };
      });
    },

    resumeSession: () => {
      set((state) => {
        if (state.phase !== 'paused' || !state.config) return state;
        return {
          phase: 'active' as SessionPhase,
          clock: resumeSessionClock(state.clock, performance.now()),
        };
      });
    },

    completeSession: () => {
      const state = get();
      if (!state.config || !['active', 'paused'].includes(state.phase)) return;
      const now = performance.now();
      const clock = pauseSessionClock(state.clock, now);
      const timing = sampleSessionTiming(clock, state.config.pattern, now);
      // Capture before reset: vision active during the session is our
      // "verified practice" signal for notification journey tags (Brume v1)
      const verified = state.visionActive;
      set({
        phase: 'complete',
        clock,
        metrics: { ...state.metrics, ...timing },
        visionActive: false,
        lastSessionVerified: verified,
      });
      trackSessionCompleted({ verified });
    },

    tickSession: () => {
      set((state) => {
        if (state.phase !== 'active' || !state.config) return state;
        const now = performance.now();
        return {
          metrics: {
            ...state.metrics,
            ...sampleSessionTiming(state.clock, state.config.pattern, now),
          },
        };
      });
    },

    resetSession: () => {
      // NOTE: Camera stream cleanup is now handled by cameraManager
      // We only reset the store state, not the actual camera stream
      console.log('🔄 SessionStore: Resetting session state (camera stream managed by cameraManager)');

      set({
        ...initialState,
        // Preserve camera permission for better UX
        cameraPermissionGranted: get().cameraPermissionGranted,
      });
    },

    // Phase management
    updateBreathPhase: (phase, progress) => {
      set((state) => {
        if (state.phase !== 'active') return state;
        const currentDuration = state.config
          ? sampleSessionTiming(state.clock, state.config.pattern, performance.now()).duration
          : state.metrics.duration;

        const roundedProgress = Math.round(progress);

        // Debug logging for phase updates
        const phaseChanged = state.metrics.currentPhase !== phase;
        const progressChanged = Math.abs((state.metrics.phaseProgress || 0) - roundedProgress) >= 1; // Reduced threshold
        const durationChanged = state.metrics.duration !== currentDuration;

        if (phaseChanged) {
          console.log(`🔄 Phase changed: ${state.metrics.currentPhase} → ${phase}`);
        }

        // Always update if phase changed, or if progress/duration changed
        if (phaseChanged || progressChanged || durationChanged) {
          return {
            metrics: {
              ...state.metrics,
              currentPhase: phase,
              phaseProgress: roundedProgress,
              duration: currentDuration,
            },
          };
        }

        return state; // No significant change
      });
    },

    incrementCycle: () => {
      set((state) => {
        const newCycleCount = state.metrics.cycleCount + 1;
        console.log(`🔄 Cycle incremented: ${state.metrics.cycleCount} → ${newCycleCount}`);
        return {
          metrics: {
            ...state.metrics,
            cycleCount: newCycleCount,
          },
        };
      });
    },

    // Media management
    setCameraStream: (stream) => {
      set({ cameraStream: stream });
    },

    setCameraPermission: (granted) => {
      set({ cameraPermissionGranted: granted });
    },

    toggleAudio: () => {
      set((state) => ({ audioEnabled: !state.audioEnabled }));
    },

    // Vision processing
    setVisionActive: (active) => {
      set({ visionActive: active });
    },

    updateVisionMetrics: (metrics) => {
      set((state) => {
        // Only update if metrics actually changed
        const currentMetrics = state.visionMetrics;
        if (currentMetrics && metrics &&
          currentMetrics.stillness === metrics.stillness &&
          currentMetrics.presence === metrics.presence &&
          currentMetrics.posture === metrics.posture) {
          return state; // No change, don't trigger re-render
        }
        return { visionMetrics: metrics };
      });
    },

    // Error handling
    setError: (error) => {
      set({ error });
    },

    addWarning: (warning) => {
      set((state) => ({
        warnings: [...state.warnings, warning],
      }));
    },

    clearWarnings: () => {
      set({ warnings: [] });
    },

    // Performance
    setPerformanceMode: (mode) => {
      set({ performanceMode: mode });
    },

    // Pattern performance tracking
    updatePatternMetrics: (metrics) => {
      set((state) => ({
        metrics: {
          ...state.metrics,
          ...metrics,
        },
      }));
    },

    recordPatternPerformance: (patternId, completionRate, engagement) => {
      const effectivenessScore = (completionRate + engagement) / 2;
      set((state) => ({
        metrics: {
          ...state.metrics,
          patternId,
          completionRate,
          userEngagement: engagement,
          effectivenessScore,
        },
      }));
    },

    // Utilities
    getSessionDuration: () => {
      const { metrics } = get();
      const totalSeconds = metrics.duration;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },

    getCompletionPercentage: () => {
      const { metrics, config } = get();
      if (!config) return 0;

      // Estimate completion based on typical 5-minute session
      const targetDuration = 300; // 5 minutes
      const percentage = Math.min((metrics.duration / targetDuration) * 100, 100);
      // Fix floating point precision issues
      return Math.round(percentage * 100) / 100;
    },

    getSessionId: () => {
      return get().sessionId;
    },
  }))
);

// ============================================================================
// SELECTORS - Optimized state access
// ============================================================================

// Custom hooks for session selectors
export const useSessionIsActive = () => useSessionStore((state) => state.phase === 'active');
export const useSessionIsPaused = () => useSessionStore((state) => state.phase === 'paused');
export const useSessionIsComplete = () => useSessionStore((state) => state.phase === 'complete');
export const useSessionCurrentMode = () => useSessionStore((state) => state.config?.mode || 'basic');
export const useSessionCurrentPattern = () => useSessionStore((state) => state.config?.pattern);
export const useSessionHasCameraStream = () => useSessionStore((state) => !!state.cameraStream);
export const useSessionCanUseCamera = () => useSessionStore((state) =>
  state.cameraPermissionGranted && !!state.cameraStream
);
export const useSessionHasVisionMetrics = () => useSessionStore((state) => !!state.visionMetrics);
export const useSessionVisionReady = () => useSessionStore((state) =>
  state.visionActive && !!state.visionMetrics
);
export const useSessionIsOptimalPerformance = () => useSessionStore((state) =>
  state.performanceMode === 'optimal'
);
export const useSessionCurrentPatternId = () => useSessionStore((state) => state.metrics.patternId);
export const useSessionPatternCompletionRate = () => useSessionStore((state) => state.metrics.completionRate);
export const useSessionPatternEngagement = () => useSessionStore((state) => state.metrics.userEngagement);
export const useSessionPatternEffectiveness = () => useSessionStore((state) => state.metrics.effectivenessScore);
export const useSessionHasError = () => useSessionStore((state) => !!state.error);
export const useSessionHasWarnings = () => useSessionStore((state) => state.warnings.length > 0);

// ============================================================================
// SELECTORS - Optimized state access
// ============================================================================

export const sessionSelectors = {
  isActive: () => useSessionStore.getState().phase !== 'setup',
  isRunning: () => ['inhale', 'hold', 'exhale', 'pause'].includes(useSessionStore.getState().phase),
  isPaused: () => useSessionStore.getState().phase === 'paused',
  isComplete: () => useSessionStore.getState().phase === 'complete',
  hasError: () => !!useSessionStore.getState().error,
  hasWarnings: () => useSessionStore.getState().warnings.length > 0,
  currentCycle: () => useSessionStore.getState().metrics.cycleCount,
  totalCycles: () => useSessionStore.getState().config?.maxCycles || 10,
  progress: () => {
    const state = useSessionStore.getState();
    const maxCycles = state.config?.maxCycles || 10;
    return Math.min((state.metrics.cycleCount / maxCycles) * 100, 100);
  },
  visionActive: () => useSessionStore.getState().visionActive,
  breathHoldTime: () => useSessionStore.getState().metrics.breathHoldTime,
};

// ============================================================================
// HOOKS - Clean, focused hooks for components
// ============================================================================

export const useSessionPhase = () => useSessionStore((state) => state.phase);
export const useSessionMetrics = () => useSessionStore((state) => state.metrics);
export const useSessionConfig = () => useSessionStore((state) => state.config);
export const useSessionError = () => useSessionStore((state) => state.error);
export const useVisionState = () => useSessionStore((state) => ({
  active: state.visionActive,
  metrics: state.visionMetrics,
}));

// Pattern performance hooks
export const usePatternPerformance = () => useSessionStore((state) => ({
  patternId: state.metrics.patternId,
  completionRate: state.metrics.completionRate,
  engagement: state.metrics.userEngagement,
  effectiveness: state.metrics.effectivenessScore,
}));

export default useSessionStore;
