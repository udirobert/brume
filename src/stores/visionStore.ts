/**
 * Unified Vision State Store - HONEST METRICS ONLY
 *
 * CORE PRINCIPLES APPLIED:
 * - ENHANCEMENT FIRST: Enhanced existing vision logic with honest feedback
 * - AGGRESSIVE CONSOLIDATION: Removed all fake linear progression
 * - DRY: Single source of truth for vision metrics
 * - CLEAN: Clear separation between real data and no data
 * - HONEST: Never lie to users about tracking capabilities
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { MeditationMetrics } from '../types/metrics';
import { apiClient } from '../lib/api/unified-client';
import { useSessionStore } from './sessionStore';

// ============================================================================
// TYPES - Clean, focused interfaces
// ============================================================================

export interface VisionConfig {
    sessionId: string;
    backendUrl?: string;
    targetFPS?: number;
    enableAdaptiveFPS?: boolean;
    features?: {
        detectFace?: boolean;
        analyzePosture?: boolean;
        trackMovement?: boolean;
    };
    silentMode?: boolean;
}

export interface VisionState {
    // Core state
    isActive: boolean;
    isReady: boolean;
    metrics: MeditationMetrics | null;
    config: VisionConfig | null;

    // Performance tracking
    currentFPS: number;
    performanceMode: 'optimal' | 'balanced' | 'minimal';

    // Connection status
    backendAvailable: boolean;
    error: string | null;
    isProcessing: boolean;

    // Session tracking
    sessionId: string | null;
    sessionStartTime: number | null;
    frameCount: number;
}

export interface VisionActions {
    // Core lifecycle
    initialize: (config: VisionConfig) => Promise<void>;
    start: (videoElement: HTMLVideoElement) => Promise<void>;
    stop: () => void;
    reset: () => void;

    // Configuration
    updateConfig: (config: Partial<VisionConfig>) => void;

    // Metrics
    updateMetrics: (metrics: MeditationMetrics) => void;
    clearMetrics: () => void;

    // Error handling
    setError: (error: string | null) => void;

    // Backend management
    checkBackendHealth: () => Promise<boolean>;
}

// ============================================================================
// CONSTANTS - Honest defaults
// ============================================================================

const DEFAULT_CONFIG: VisionConfig = {
    sessionId: '',
    backendUrl: 'https://api.brume.trustfall.xyz',
    targetFPS: 1,
    enableAdaptiveFPS: true,
    features: {
        detectFace: true,
        analyzePosture: true,
        trackMovement: true,
    },
    silentMode: false,
};

// ============================================================================
// INITIAL STATE - Clean defaults
// ============================================================================

const initialState: VisionState = {
    isActive: false,
    isReady: false,
    metrics: null,
    config: null,
    currentFPS: 1,
    performanceMode: 'optimal',
    backendAvailable: false,
    error: null,
    isProcessing: false,
    sessionId: null,
    sessionStartTime: null,
    frameCount: 0,
};

// ============================================================================
// STORE - Honest vision state management
// ============================================================================

export const useVisionStore = create<VisionState & VisionActions>()(
    subscribeWithSelector(
        (set, get) => ({
            ...initialState,

            // Core lifecycle management
            initialize: async (config: VisionConfig) => {
                const finalConfig = { ...DEFAULT_CONFIG, ...config };

                set({
                    config: finalConfig,
                    error: null,
                });

                try {
                    // Check backend availability
                    const backendAvailable = await get().checkBackendHealth();

                    set({
                        isReady: true,
                        backendAvailable,
                        currentFPS: finalConfig.targetFPS || 1,
                        performanceMode: 'optimal',
                    });

                    console.log('Vision store initialized:', { backendAvailable });
                } catch (error) {
                    console.error('Vision initialization failed:', error);
                    set({
                        error: error instanceof Error ? error.message : 'Initialization failed',
                    });
                }
            },

            start: async (videoElement: HTMLVideoElement) => {
                const state = get();
                if (state.isActive) return;

                const sessionStartTime = Date.now();

                set({
                    isActive: true,
                    sessionStartTime,
                    error: null,
                    metrics: null, // HONEST: Start with no data
                });

                // Start processing loop with real backend calls
                const processFrame = async () => {
                    const visionState = get();
                    if (!visionState.isActive) return;

                    const startTime = performance.now();

                    try {
                        // Capture frame from video element
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');

                        if (!ctx || !videoElement) {
                            throw new Error('Canvas context or video element unavailable');
                        }

                        // Set canvas size (smaller for performance)
                        canvas.width = Math.min(320, videoElement.videoWidth || 320);
                        canvas.height = Math.min(240, videoElement.videoHeight || 240);

                        // Draw current video frame
                        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                        const imageData = canvas.toDataURL('image/jpeg', 0.8);

                        // Get current breathing phase from session store
                        const currentPhase = useSessionStore.getState().metrics?.currentPhase;

                        // Make API call to backend
                        const response = await apiClient.processVision(visionState.config?.sessionId || 'default', {
                            image_data: imageData,
                            timestamp: Date.now(),
                            breathing_phase: currentPhase, // ENHANCEMENT: Include breathing phase
                            options: {
                                detect_face: visionState.config?.features?.detectFace ?? true,
                                analyze_posture: visionState.config?.features?.analyzePosture ?? true,
                                track_breathing: visionState.config?.features?.trackMovement ?? false,
                            },
                        });

                        const processingTime = performance.now() - startTime;

                        if (response.success && response.data && !response.data?.fallback) {
                            // HONEST: Real backend data only - apply to actual face tracking
                            const backendMetrics = response.data?.metrics;
                            
                            const movementLevel = backendMetrics?.movement_level ?? 0;
                            const confidence = backendMetrics?.confidence ?? 0;
                            const postureScore = backendMetrics?.posture_score ?? 0;
                            const faceDetected = backendMetrics?.face_detected ?? false;
                            
                            const metrics: MeditationMetrics = {
                                // HONEST: Real movement tracking - higher movement = lower stillness
                                stillness: faceDetected ? Math.max(0, (1 - movementLevel) * 100) : 0,
                                presence: faceDetected ? confidence * 100 : 0,
                                posture: faceDetected ? postureScore * 100 : 0,
                                restlessnessScore: faceDetected ? movementLevel * 100 : 0,
                                faceLandmarks: faceDetected ? (backendMetrics?.landmarks || []) : [],
                                faceDetected,
                                confidence,
                                processingTimeMs: backendMetrics?.processing_time_ms ?? processingTime,
                                source: 'backend',
                            };

                            set((state) => ({
                                metrics,
                                frameCount: state.frameCount + 1,
                                error: null,
                                backendAvailable: true,
                            }));

                            // PERFORMANT: Reduced logging - only log every 10th frame to avoid console spam
                            if (get().frameCount % 10 === 0) {
                                console.log('📊 Face tracking (every 10 frames):', {
                                    faceDetected,
                                    stillness: metrics.stillness.toFixed(1) + '%',
                                    frames: get().frameCount,
                                });
                            }
                        } else {
                            // HONEST: Backend unavailable - clear state, no fake data
                            set({
                                metrics: null,
                                error: 'Face tracking unavailable - session continues without biometric feedback',
                                backendAvailable: false,
                            });

                            console.warn('Backend unavailable - no face tracking data');
                        }

                    } catch (error) {
                        console.error('Vision processing error:', error);

                        // HONEST: Clear error state - no fake data
                        set({
                            metrics: null,
                            error: `Vision processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                            backendAvailable: false,
                        });
                    }

                    // Schedule next frame
                    const nextState = get();
                    if (nextState.isActive) {
                        const interval = 1000 / nextState.currentFPS;
                        setTimeout(processFrame, interval);
                    }
                };

                // Start processing with a small delay to ensure video is ready
                setTimeout(processFrame, 500);

                console.log('Started real backend processing');
            },

            stop: () => {
                set({
                    isActive: false,
                    metrics: null,
                });

                console.log('Stopped processing');
            },

            reset: () => {
                const state = get();
                set({
                    ...initialState,
                    config: state.config, // Preserve config
                });

                console.log('Reset to initial state');
            },

            // Configuration management
            updateConfig: (config: Partial<VisionConfig>) => {
                const currentState = get();
                const newConfig = { ...currentState.config, ...config } as VisionConfig;

                set({
                    config: newConfig,
                    currentFPS: newConfig.targetFPS || currentState.currentFPS,
                });

                console.log('Updated config:', newConfig);
            },

            // Metrics management
            updateMetrics: (metrics: MeditationMetrics) => {
                set({ metrics });
            },

            clearMetrics: () => {
                set({ metrics: null });
            },

            // Error handling
            setError: (error: string | null) => {
                set({ error });
            },

            // Backend management
            checkBackendHealth: async (): Promise<boolean> => {
                const state = get();
                const config = state.config;

                if (!config?.backendUrl) return false;

                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2000);

                    const response = await fetch(`${config.backendUrl}/health`, {
                        method: 'GET',
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);
                    return response.ok;
                } catch {
                    return false;
                }
            },
        })
    )
);

// ============================================================================
// SELECTORS - Honest state access
// ============================================================================

// Custom hooks for vision selectors
export const useVisionIsActive = () => useVisionStore((state) => state.isActive);
export const useVisionIsReady = () => useVisionStore((state) => state.isReady);
export const useVisionHasMetrics = () => useVisionStore((state) => !!state.metrics);
export const useVisionHasError = () => useVisionStore((state) => !!state.error);
export const useVisionIsBackendAvailable = () => useVisionStore((state) => state.backendAvailable);
export const useVisionRestlessnessScore = () => useVisionStore((state) => state.metrics?.restlessnessScore || 0);
export const useVisionStillnessScore = () => useVisionStore((state) => state.metrics?.stillness || 0);

// ============================================================================
// SELECTORS - Optimized state access
// ============================================================================

export const visionSelectors = {
  isActive: () => useVisionStore.getState().isActive,
  hasMetrics: () => !!useVisionStore.getState().metrics,
  hasError: () => !!useVisionStore.getState().error,
  isProcessing: () => useVisionStore.getState().isProcessing,
  restlessnessScore: () => useVisionStore.getState().metrics?.restlessnessScore || 0,
  sessionId: () => useVisionStore.getState().sessionId,
  isConfigured: () => !!useVisionStore.getState().config,
};

// ============================================================================
// HOOKS - Clean, focused hooks for components
// ============================================================================

export const useVisionStatus = () => useVisionStore((state) => state.isActive ? 'active' : 'idle');
export const useVisionMetrics = () => useVisionStore((state) => state.metrics);
export const useVisionError = () => useVisionStore((state) => state.error);
export const useVisionConfig = () => useVisionStore((state) => state.config);
export const useRestlessnessScore = () => useVisionStore((state) => state.metrics?.restlessnessScore || 0);

export default useVisionStore;