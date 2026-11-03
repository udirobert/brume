/**
 * CONSOLIDATED METRICS TYPES
 * 
 * SINGLE SOURCE OF TRUTH for all metrics-related interfaces.
 * Eliminates duplication across stores, hooks, and components.
 * 
 * Core Principles Applied:
 * - DRY: Single source for all metric types
 * - CLEAN: Clear separation of concerns
 * - ORGANIZED: Domain-driven type organization
 */

// ============================================================================
// CORE MEDITATION METRICS - Primary user-facing metrics
// ============================================================================

export interface MeditationMetrics {
  // Primary meditation metrics (user-facing)
  stillness: number;     // 0-100, movement calmness
  presence: number;      // 0-100, face detection confidence  
  posture: number;       // 0-100, sitting posture quality
  restlessnessScore?: number; // 0-100, restlessness level (inverse of stillness)

  // Visual feedback data
  faceLandmarks?: Array<{ x: number; y: number; z?: number }>;
  faceDetected: boolean;

  // Technical metrics (hidden from users)
  confidence: number;
  processingTimeMs: number;
  source: 'backend' | 'frontend' | 'fallback';
}

// ============================================================================
// SESSION METRICS - Session performance and progress tracking
// ============================================================================

export interface SessionMetrics {
  duration: number; // seconds
  cycleCount: number;

  // Phase tracking
  currentPhase?: BreathPhase;
  phaseProgress?: number; // 0-100
  startTime?: Date;
}

// ============================================================================
// STABLE METRICS - UI-stable metrics for consistent display
// ============================================================================

export type DisplayState = 'hidden' | 'appearing' | 'visible' | 'fading';

export interface StableMetricsResult {
  // Core metrics (always available, smoothed)
  stillnessScore: number;  // 0-100% (100 = perfectly still, 0 = very restless)
  presenceScore: number;
  postureScore: number;
  
  // Display state
  displayState: DisplayState;
  isStable: boolean;
  confidence: number;
  
  // Raw metrics (for debugging)
  rawMetrics: MeditationMetrics | null;
  hasValidData: boolean;
}

// ============================================================================
// PERFORMANCE METRICS - System and processing performance
// ============================================================================

export interface PerformanceMetrics {
  processingTime: number;
  memoryUsage: number;
  frameRate: number;
  errorCount: number;
  warningCount: number;
  lastUpdated: number;
}

export interface DebugMetrics {
  componentRenders: Record<string, number>;
  hookCalls: Record<string, number>;
  stateUpdates: Record<string, number>;
  performanceMarks: Array<{
    name: string;
    timestamp: number;
    duration?: number;
  }>;
}

// ============================================================================
// QUALITY METRICS - Quality scoring and assessment
// ============================================================================

export interface QualityMetrics {
  overall: number;      // 0-100
  focus: number;        // 0-100
  consistency: number;  // 0-100
  progress: number;     // 0-100
}

export interface SessionScores {
  breathingQuality: number;
  postureStability: number;
  mindfulnessLevel: number;
  overallPerformance: number;
}

// ============================================================================
// VISION METRICS - Camera and vision processing specific
// ============================================================================

export interface VisionMetrics {
  stillness?: number;
  confidence?: number;
  presence?: number;
  posture?: number;
  restlessnessScore?: number;
  faceLandmarks?: Array<{ x: number; y: number; z?: number }>;
}

// ============================================================================
// SHARED ENUMS AND TYPES
// ============================================================================

export type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'pause' | 'hold_after_exhale';
export type SessionPhase = 'setup' | 'preparation' | 'camera_setup' | 'ready' | 'active' | 'paused' | 'complete';
export type SessionMode = 'classic' | 'enhanced' | 'advanced' | 'mobile';
export type VisionStatus = 'idle' | 'initializing' | 'ready' | 'active' | 'error' | 'paused';

// ============================================================================
// UTILITY TYPES - Helper types for metrics processing
// ============================================================================

export type MetricTrend = 'improving' | 'stable' | 'worsening';
export type QualityLevel = 'excellent' | 'good' | 'fair' | 'needs_focus' | 'getting_started';

// ============================================================================
// CONFIGURATION TYPES - Metrics-related configuration
// ============================================================================

export interface MetricsConfig {
  smoothingAlpha: number;
  stabilityThreshold: number;
  confidenceHysteresis: number;
  minDisplayTime: number;
  fadeOutDelay: number;
}

export interface SessionModeConfig {
  enableCamera: boolean;
  enableVision: boolean;
  enableAudio: boolean;
  enableAdvancedFeatures: boolean;
  enableMobileOptimizations: boolean;
  showPerformanceMonitor: boolean;
  layout: "single" | "dual" | "mobile";
  description: string;
}