/**
 * Breath curve — the shared ease for orb and mascot.
 * CALM archetype: sine ease-in-out per tick, no overshoot.
 */

export function easeInOutSine(p: number): number {
  const clamped = Math.max(0, Math.min(1, p));
  return (1 - Math.cos(Math.PI * clamped)) / 2;
}

export type BreathPhase =
  | "inhale"
  | "hold"
  | "exhale"
  | "hold_after_exhale"
  | "prepare"
  | "countdown";

/** Scale of the breath at phase-progress (0..1). Inhale 0.82→1.24,
 *  hold 1.24, exhale 1.24→0.82, hold_after_exhale 0.82, idle 0.88. */
export function breathScale(
  phase: BreathPhase,
  progress01: number,
  isActive = true,
): number {
  if (!isActive) return 0.88;
  const p = easeInOutSine(progress01);
  switch (phase) {
    case "inhale":
      return 0.82 + p * 0.42;
    case "hold":
      return 1.24;
    case "exhale":
      return 1.24 - p * 0.42;
    case "hold_after_exhale":
      return 0.82;
    case "prepare":
    case "countdown":
      return 1.0;
    default:
      return 1.0;
  }
}

/** The mascot's 0..1 breath value, from the same eased progress. */
export function breathAmount(
  phase: BreathPhase,
  progress01: number,
  isActive = true,
): number {
  if (!isActive) return 0;
  const p = easeInOutSine(progress01);
  switch (phase) {
    case "inhale":
      return p;
    case "hold":
      return 1;
    case "exhale":
      return 1 - p;
    default:
      return 0;
  }
}
