/**
 * Mist brush — the room's touch response (experiment, no sensors).
 *
 * Press and drag on the empty room and it leaves soft mist. The brush
 * breathes with the companion: same cosine cycle, same clock, same
 * period as the mascot's own breath, so a fuller dab lands when the
 * sprite is fullest. A hurried stroke goes thin and faint — the way the
 * mascot holds still when the pointer is frantic (thresholds mirror
 * `ATTENTION` in `anna/bundle/mascot.js`, which stays frozen).
 *
 * No page, no mode, no gallery: every dab fades on its own. Pure
 * functions only — the canvas lives in `RoomTouch.tsx`.
 */
import { easeInOutSine } from "./breathCurve";

/** Seconds per breath — the mascot's default `breathPeriod`. */
export const MASCOT_BREATH_PERIOD = 7;

/** px/s. FULL equals the mascot's AGITATED; the brush starts easing earlier. */
export const HUSH = { ONSET: 600, FULL: 1200 } as const;

export const MIN_RADIUS = 8;
export const MAX_RADIUS = 34;
/** Seconds a dab stays visible. Long enough to see, short enough to let go. */
export const DAB_LIFE_S = 14;
export const MAX_DABS = 640;

const clamp01 = (v: number) =>
  Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * 0..1 breath at `tSeconds` — the exact formula the mascot engine uses
 * when it breathes on its own (`sampleMascot`, breathing: true).
 */
export function mascotBreath(
  tSeconds: number,
  period: number = MASCOT_BREATH_PERIOD,
): number {
  if (!Number.isFinite(tSeconds)) return 0;
  const p = Math.max(0.5, Number.isFinite(period) ? period : MASCOT_BREATH_PERIOD);
  const cyc = (((tSeconds % p) + p) % p) / p;
  return (1 - Math.cos(cyc * Math.PI * 2)) / 2;
}

/** 0..1 — how hushed a stroke of this speed (px/s) is. Smoothstep. */
export function hushFromSpeed(speed: number): number {
  if (!Number.isFinite(speed) || speed <= HUSH.ONSET) return 0;
  const t = clamp01((speed - HUSH.ONSET) / (HUSH.FULL - HUSH.ONSET));
  return t * t * (3 - 2 * t);
}

export interface Dab {
  radius: number;
  /** 0..1 peak alpha, before the age fade. */
  alpha: number;
}

/** What one dab looks like at this breath and hush. */
export function dabFor(breath: number, hush: number): Dab {
  const b = clamp01(breath);
  const h = clamp01(hush);
  return {
    radius: lerp(MIN_RADIUS, MAX_RADIUS, b) * (1 - 0.45 * h),
    alpha: (0.06 + 0.2 * b) * (1 - 0.85 * h),
  };
}

/** 1 → 0 over a dab's life. Eased, so it lets go gently at both ends. */
export function ageFade(ageSec: number): number {
  if (!Number.isFinite(ageSec) || ageSec <= 0) return 1;
  if (ageSec >= DAB_LIFE_S) return 0;
  return 1 - easeInOutSine(ageSec / DAB_LIFE_S);
}

/** Distance between dabs along a stroke — tighter for small brushes. */
export function dabSpacing(radius: number): number {
  return Math.max(3, radius * 0.35);
}
