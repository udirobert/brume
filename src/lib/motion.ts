/**
 * Motion constants — CALM archetype.
 * One signature ease, three durations, plus the two sanctioned
 * additions: a settle ease for releases (the only sanctioned
 * overshoot) and a press grammar (see PRESS). Transform + opacity
 * only; reduced-motion = opacity only (handled at call sites via
 * useReducedMotion).
 */

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Settle — releases bounce back with a small, quick overshoot.
 *  Cubic bezier with a control point above 1, so the value passes
 *  the target once and settles. Not for entrances. */
export const EASE_SETTLE = [0.34, 1.56, 0.64, 1] as const;

/** Press grammar — asymmetric squash on press (wider, shorter) so a
 *  button reads as a soft object taking weight, matched to the CSS
 *  pass in styles/brume-controls.css. */
export const PRESS = {
  squash: { scaleX: 1.02, scaleY: 0.96 },
  chipSquash: { scaleX: 1.04, scaleY: 0.94 },
} as const;

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
