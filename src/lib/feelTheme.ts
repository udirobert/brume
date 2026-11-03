/**
 * Check-in feeling → the room's response.
 *
 * The word a user taps is already plumbed through the journey; this is
 * how the environment acknowledges it. One map drives three things:
 * the mascot's expression, its one-shot reaction, and the orb tint
 * (`--brume-orb-mist`, applied for the length of the session flow).
 * Heavy words stay calm-absorbed — empathy, never diagnosis.
 */
import type { BrumeMascotState, MascotReaction } from "@/components/BrumeMascot";

export interface CheckInFeel {
  state: BrumeMascotState;
  reaction?: MascotReaction;
  /** --brume-orb-mist: the room takes the feeling's colour. */
  orbMist: string;
}

export const CHECK_IN_FEELS: readonly CheckInFeel[] = [
  { state: "bright", reaction: "hop", orbMist: "rgb(146 158 214)" },
  { state: "stretch", orbMist: "rgb(150 132 198)" },
  { state: "hum", orbMist: "rgb(124 145 210)" },
  { state: "sleepy", orbMist: "rgb(112 122 192)" },
  { state: "sleepy", reaction: "settle", orbMist: "rgb(98 108 182)" },
];

export function feelAt(index: number | null | undefined): CheckInFeel | null {
  if (index == null || index < 0 || index >= CHECK_IN_FEELS.length) return null;
  return CHECK_IN_FEELS[index];
}

export function applyFeel(index: number | null | undefined) {
  if (typeof document === "undefined") return;
  const feel = feelAt(index);
  const el = document.documentElement;
  if (!feel) {
    clearFeel();
    return;
  }
  el.dataset.feel = String(index);
  el.style.setProperty("--brume-orb-mist", feel.orbMist);
}

export function clearFeel() {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  delete el.dataset.feel;
  el.style.removeProperty("--brume-orb-mist");
}
