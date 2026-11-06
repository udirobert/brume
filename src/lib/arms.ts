/**
 * Experiment arms — one assignment, kept on the device, never shown.
 *
 * An arm is a name for a thing the user can't see, so it must not leak into
 * the UI: no copy, no class name, no URL says which one you are in. It is
 * picked once, on first ask, and then read back from storage forever — a
 * rule that depended on the roll of a die at every visit would be a rule
 * nobody can hold (see the cut prompt deck in docs/EXPERIMENTS.md).
 *
 * The only place an arm leaves the device is the `visit` event, as one id
 * from this closed list, so the counter can split D7 return by arm.
 *
 * E6 — the room remembers:
 *   control    the same Home, nothing remembered
 *   line       a one-line pattern the companion names (memoryLine.ts)
 *   line_room  the line, plus the room tinted by the same weather (E6a)
 */

export const E6_ARMS = ["control", "line", "line_room"] as const;
export type E6Arm = (typeof E6_ARMS)[number];

const KEY = "brume/arm-e6";

export const isE6Arm = (v: unknown): v is E6Arm =>
  typeof v === "string" && (E6_ARMS as readonly string[]).includes(v);

/**
 * This device's E6 arm. Storage that refuses reads as `control` and nothing
 * is persisted, so a browser that can't remember never gets the treatment
 * half the time and the control the other half.
 */
export function e6Arm(rand: () => number = Math.random): E6Arm {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (isE6Arm(stored)) return stored;
    const pick = Math.floor(rand() * E6_ARMS.length);
    const arm = E6_ARMS[Math.min(E6_ARMS.length - 1, Math.max(0, pick))];
    window.localStorage.setItem(KEY, arm);
    return arm;
  } catch {
    return "control";
  }
}
