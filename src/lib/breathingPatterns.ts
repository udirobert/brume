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
    description: 'Four equal sides — in, hold, out, hold — four counts each',
    inhale: 4,
    hold: 4,
    exhale: 4,
    hold_after_exhale: 4,
    benefits: ['Steady', 'Even counts', 'Between tasks']
  },

  relaxation: {
    id: 'relaxation',
    name: 'Relaxation Breath',
    description: 'A short hold, then a long exhale — 4 in, 7 held, 8 out',
    inhale: 4,
    hold: 7,
    exhale: 8,
    hold_after_exhale: 0,
    benefits: ['Long exhale', 'Slowing down', 'Before bed']
  },

  wim_hof: {
    id: 'wim_hof',
    name: 'Wim Hof Method',
    description: 'Full, quick breaths in rounds, at your own pace',
    inhale: 6,
    hold: 0,
    exhale: 6,
    hold_after_exhale: 0,
    benefits: ['Fuller breaths', 'Rounds', 'Intensity']
  },

  energy: {
    id: 'energy',
    name: 'Energy Breath',
    description: 'A quicker, lighter rhythm — short in, shorter hold, out',
    inhale: 3,
    hold: 2,
    exhale: 4,
    hold_after_exhale: 1,
    benefits: ['A quicker rhythm', 'Early hours', 'A bright start']
  },

  sleep: {
    id: 'sleep',
    name: 'Sleep Breath',
    description: 'A long exhale and a quiet pause — the last thing before sleep',
    inhale: 4,
    hold: 6,
    exhale: 8,
    hold_after_exhale: 3,
    benefits: ['Before sleep', 'Long exhale', 'Bedtime']
  },

  mindfulness: {
    id: 'mindfulness',
    name: 'Mindfulness Breath',
    description: 'Five in, five out. Even counts.',
    inhale: 5,
    hold: 0,
    exhale: 5,
    hold_after_exhale: 0,
    benefits: ['Even counts', 'Stillness', 'A moment between tasks']
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

/** "4 in · 6 out" / "4 in · 4 hold · 4 out · 4 hold" — skips zero phases. */
export function formatPhases(phases: {
  inhale?: number;
  hold?: number;
  exhale?: number;
  hold_after_exhale?: number;
  pause?: number;
}): string {
  const parts: string[] = [];
  if (phases.inhale) parts.push(`${phases.inhale} in`);
  if (phases.hold) parts.push(`${phases.hold} hold`);
  if (phases.exhale) parts.push(`${phases.exhale} out`);
  const rest = phases.hold_after_exhale ?? phases.pause;
  if (rest) parts.push(`${rest} hold`);
  return parts.join(" · ");
}
