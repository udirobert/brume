/**
 * Motion constants — CALM archetype.
 * One signature ease, three durations. Transform + opacity only;
 * reduced-motion = opacity only (handled at call sites via useReducedMotion).
 */

export const EASE = [0.16, 1, 0.3, 1] as const;

export const DURATION = {
  quick: 0.2,
  standard: 0.5,
  slow: 0.9,
} as const;

export const ENTRANCE = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION.standard, ease: EASE },
} as const;
