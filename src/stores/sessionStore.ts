/**
 * Unified Session State Store
 * 
 * SINGLE SOURCE OF TRUTH for all session state management.
 * Eliminates duplication across multiple session components and hooks.
 * 
 * Built with Zustand for clean, predictable state management.
 */

import { track } from '@/lib/events';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { BreathingPattern } from '../lib/breathingPatterns';
import { errorReporter } from '../lib/errors/error-reporter';
import { trackSessionCompleted } from '../lib/notifications/oneSignal';
import type { SessionPhase, SessionMode, SessionMetrics } from '../types/metrics';
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
  enableAudio: boolean;
  enableAI: boolean;
}

// SessionMetrics now imported from types/metrics.ts

export interface SessionState {
  // Core session state
  phase: SessionPhase;
  config: SessionConfig | null;
  metrics: SessionMetrics;
  sessionId: string | null; // Stable session ID

  // Media state
  audioEnabled: boolean;
  cueStyle: CueStyle;

  // Monotonic active-time clock driving duration/rhythm/cycles
  clock: SessionClock;

  // Error state
  error: string | null;
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

  // Media management
  toggleAudio: () => void;
  setAudioEnabled: (on: boolean) => void;
  setCueStyle: (style: CueStyle) => void;
}

// ============================================================================
// INITIAL STATE - Clean defaults
// ============================================================================

const initialMetrics: SessionMetrics = {
  duration: 0,
  cycleCount: 0,
  currentPhase: 'inhale',
  phaseProgress: 0,
};

// The user's "Spoken breath cues" choice persists across sessions.
const AUDIO_PREF_KEY = 'brume.audioEnabled';
const CUE_STYLE_KEY = 'brume.cueStyle';
export type CueStyle = 'spoken' | 'breath';
function storedAudioEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(AUDIO_PREF_KEY) !== 'false';
  } catch {
    return true;
  }
}
function storedCueStyle(): CueStyle {
  try {
    return globalThis.localStorage?.getItem(CUE_STYLE_KEY) === 'breath'
      ? 'breath'
      : 'spoken';
  } catch {
    return 'spoken';
  }
}

const initialState: SessionState = {
  phase: 'setup',
  config: null,
  metrics: initialMetrics,
  sessionId: null,
  audioEnabled: storedAudioEnabled(),
  cueStyle: storedCueStyle(),
  clock: createSessionClock(),
  error: null,
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
        track('session_start', {
          pattern: state.config.pattern.id,
          mode: String(state.config.mode),
        });
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
      // No camera, no vision — nothing is "verified" anymore; the tag is
      // kept false so notification journeys see an honest zero.
      set({
        phase: 'complete',
        clock,
        metrics: { ...state.metrics, ...timing },
      });
      trackSessionCompleted({ verified: false });
      track('session_complete', {
        pattern: state.config.pattern.id,
        seconds: Math.round(timing.duration || 0),
        cycles: timing.cycleCount || 0,
      });
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
      const { phase, config, metrics } = get();
      // Left while breathing (never completed) — count it, nothing more.
      if (config && (phase === 'active' || phase === 'paused')) {
        track('session_abandon', {
          pattern: config.pattern.id,
          seconds: Math.round(metrics.duration || 0),
          phase,
        });
      }
      set({ ...initialState });
    },

    // Media management
    toggleAudio: () => get().setAudioEnabled(!get().audioEnabled),

    setAudioEnabled: (on) => {
      try {
        globalThis.localStorage?.setItem(AUDIO_PREF_KEY, String(on));
      } catch {
        // private-mode storage is best-effort
      }
      set({ audioEnabled: !!on });
    },

    setCueStyle: (style) => {
      try {
        globalThis.localStorage?.setItem(CUE_STYLE_KEY, style);
      } catch {
        // private-mode storage is best-effort
      }
      set({ cueStyle: style });
    },
  }))
);

// ============================================================================
// SELECTORS - Optimized state access
// ============================================================================

export const sessionSelectors = {
  isActive: () => useSessionStore.getState().phase === 'active',
  isPaused: () => useSessionStore.getState().phase === 'paused',
  isComplete: () => useSessionStore.getState().phase === 'complete',
};

// ============================================================================
// HOOKS - Clean, focused hooks for components
// ============================================================================

export const useSessionPhase = () => useSessionStore((state) => state.phase);
export const useSessionMetrics = () => useSessionStore((state) => state.metrics);
export const useSessionConfig = () => useSessionStore((state) => state.config);

export default useSessionStore;
