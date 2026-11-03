/**
 * Mascot flight — where the companion was, and how it travels.
 *
 * A mascot with a shared `layoutId` flies between mount points across
 * page changes. Each mount records where it sits in a short trail
 * tagged by mount id, so a mount's own records (StrictMode's replayed
 * effects, sibling mounts on the same route) can never masquerade as
 * the previous screen's position. A flight is only reported when the
 * newest foreign entry is recent and far enough away; from it we get
 * the arrival gaze/lean and the smear direction + strength.
 */

export interface CompanionSpot {
  id: number;
  state: string;
  cx: number;
  cy: number;
  t: number;
}

export interface FlightPlan {
  fromState: string;
  gaze: { x: number; y: number };
  lean: number;
  smear: { x: number; y: number; strength: number };
}

const companionTrail: CompanionSpot[] = [];
let nextMountId = 1;

export const FLIGHT_RELEASE_MS = 700;
export const FLIGHT_STALE_MS = 2000;
/** Below this travel distance a remount is a pop, not a flight. */
export const FLIGHT_MIN_DIST = 30;
/** Travel distance at which the smear reaches full strength. */
export const FLIGHT_FULL_DIST = 400;
/** Every real flight deforms at least this much — short hops included. */
export const FLIGHT_MIN_STRENGTH = 0.35;

export function allocMountId(): number {
  return nextMountId++;
}

/** Reset all flight state — tests only. */
export function resetCompanionTrail(): void {
  companionTrail.length = 0;
}

/**
 * The element's natural centre — its rect minus its own transform,
 * so a mid-flight record describes the destination, not the flight.
 */
export function readCenter(
  rect: { left: number; top: number; width: number; height: number },
  transform: string | null,
): { cx: number; cy: number } | null {
  if (!rect.width) return null;
  let tx = 0;
  let ty = 0;
  if (transform && transform !== "none") {
    const m = transform.match(/matrix\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(",").map(Number);
      tx = p[4] || 0;
      ty = p[5] || 0;
    }
  }
  return { cx: rect.left + rect.width / 2 - tx, cy: rect.top + rect.height / 2 - ty };
}

export function recordCompanion(
  id: number,
  state: string,
  center: { cx: number; cy: number },
  now = performance.now(),
): void {
  companionTrail.push({ id, state, cx: center.cx, cy: center.cy, t: now });
  if (companionTrail.length > 4) companionTrail.shift();
}

/**
 * Departure stamp — refresh the *time* of this instance's latest
 * entry without touching its position. Called at unmount so trail
 * staleness measures "how long since the companion was last seen",
 * while cx/cy keep the last resting spot.
 */
export function stampDeparture(id: number, now = performance.now()): void {
  const mine = [...companionTrail].reverse().find((e) => e.id === id);
  if (mine) mine.t = now;
}

export function flightVector(
  selfId: number,
  center: { cx: number; cy: number },
  now = performance.now(),
): FlightPlan | null {
  const prev = [...companionTrail].reverse().find(
    (e) => e.id !== selfId && now - e.t <= FLIGHT_STALE_MS,
  );
  if (!prev) return null;
  const dx = center.cx - prev.cx;
  const dy = center.cy - prev.cy;
  const dist = Math.hypot(dx, dy);
  if (dist < FLIGHT_MIN_DIST) return null;
  return {
    fromState: prev.state,
    gaze: {
      x: Math.max(-2.4, Math.min(2.4, dx * 0.006)),
      y: Math.max(-1.8, Math.min(1.8, dy * 0.006)),
    },
    lean: Math.max(-4, Math.min(4, dx * 0.03)),
    smear: {
      x: dx / dist,
      y: dy / dist,
      // A floor so even a hop reads as a dart; full stretch by FLIGHT_FULL_DIST.
      strength: Math.min(
        1,
        FLIGHT_MIN_STRENGTH + (1 - FLIGHT_MIN_STRENGTH) * (dist / FLIGHT_FULL_DIST),
      ),
    },
  };
}
