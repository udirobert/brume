/**
 * Default breathing pattern definitions
 * Provides standard patterns used in the application
 */

export type BreathingPhaseName = 'inhale' | 'hold' | 'exhale' | 'hold_after_exhale';

export interface BreathingPhase {
  name: BreathingPhaseName;
  duration: number;
}

export interface CustomBreathingPhase {
  name: 'inhale' | 'hold' | 'exhale' | 'hold_after_exhale';
  duration: number;
  text?: string;
}

export interface BreathingPattern {
  id: string;
  name: string;
  description: string;
  inhale: number;
  hold: number;
  exhale: number;
  hold_after_exhale: number;
  benefits: string[];
}

export const BREATHING_PATTERNS: Record<string, BreathingPattern> = {
  reset: {
    id: 'reset',
    name: 'Reset',
    description: 'A short, comfortable rhythm to settle between one thing and the next',
    inhale: 4,
    hold: 0,
    exhale: 6,
    hold_after_exhale: 0,
    benefits: ['A moment between tasks', 'Settle before you continue']
  },

  box: {
    id: 'box',
    name: 'Box Breathing',
    description: 'Equal duration for all phases - excellent for focus and stress reduction',
    inhale: 4,
    hold: 4,
    exhale: 4,
    hold_after_exhale: 4,
    benefits: ['Stress reduction', 'Improved focus', 'Mental clarity']
  },

  relaxation: {
    id: 'relaxation',
    name: 'Relaxation Breath',
    description: 'Longer exhale promotes relaxation and parasympathetic response',
    inhale: 4,
    hold: 7,
    exhale: 8,
    hold_after_exhale: 0,
    benefits: ['Anxiety relief', 'Better sleep', 'Relaxation', 'Stress reduction']
  },

  wim_hof: {
    id: 'wim_hof',
    name: 'Wim Hof Method',
    description: 'Powerful breathing technique for energy and immune system strength',
    inhale: 6,
    hold: 0,
    exhale: 6,
    hold_after_exhale: 0,
    benefits: ['Energy increase', 'Immune system boost', 'Cold tolerance']
  },

  energy: {
    id: 'energy',
    name: 'Energy Breath',
    description: 'Quick, energizing breath pattern to increase alertness',
    inhale: 3,
    hold: 2,
    exhale: 4,
    hold_after_exhale: 1,
    benefits: ['Energy boost', 'Increased alertness', 'Morning activation']
  },

  sleep: {
    id: 'sleep',
    name: 'Sleep Breath',
    description: 'Calming pattern designed to prepare the body for sleep',
    inhale: 4,
    hold: 6,
    exhale: 8,
    hold_after_exhale: 3,
    benefits: ['Improved sleep quality', 'Reduced insomnia', 'Evening relaxation']
  },

  mindfulness: {
    id: 'mindfulness',
    name: 'Mindfulness Breath',
    description: 'Simple pattern for meditation and present-moment awareness',
    inhale: 5,
    hold: 0,
    exhale: 5,
    hold_after_exhale: 0,
    benefits: ['Meditation support', 'Present moment awareness', 'Anxiety reduction']
  }
};

/**
 * Get a breathing pattern by id
 */
export function getPattern(id: string): BreathingPattern | undefined {
  return BREATHING_PATTERNS[id];
}

/**
 * Get all available breathing patterns
 */
export function getAllPatterns(): BreathingPattern[] {
  return Object.values(BREATHING_PATTERNS);
}

/**
 * Get patterns filtered by benefit
 */
export function getPatternsByBenefit(benefit: string): BreathingPattern[] {
  return Object.values(BREATHING_PATTERNS).filter(pattern =>
    pattern.benefits.some(b => b.toLowerCase().includes(benefit.toLowerCase()))
  );
}

export default BREATHING_PATTERNS;
