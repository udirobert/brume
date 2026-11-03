/**
 * Check-in feeling → the room's response.
 *
 * The word a user taps is already plumbed through the journey; this is
 * how the environment acknowledges it. One map drives four things:
 * the mascot's expression, its one-shot reaction, the orb tint
 * (`--brume-orb-mist`, for the session flow) and the room itself —
 * `--brume-mist-*` retints the MistField live while
 * `--brume-feel-weight` tells it how still and dense to go.
 * Heavy words are absorbed — the fog thickens around them.
 * Empathy, never diagnosis.
 */
import type { BrumeMascotState, MascotReaction } from "@/components/BrumeMascot";

export interface CheckInFeel {
  state: BrumeMascotState;
  reaction?: MascotReaction;
  /** --brume-orb-mist: the session orb takes the feeling's colour. */
  orbMist: string;
  /** --brume-mist-r/g/b: the whole room retints (MistField reads it live). */
  roomMist: readonly [r: number, g: number, b: number];
  /** 0..1 — heavier words still the drift and thicken the folds. */
  weight: number;
}

export const CHECK_IN_FEELS: readonly CheckInFeel[] = [
  { state: "bright", reaction: "hop", orbMist: "rgb(146 158 214)", roomMist: [212, 218, 164], weight: 0.1 },
  { state: "stretch", orbMist: "rgb(150 132 198)", roomMist: [188, 176, 224], weight: 0.3 },
  { state: "hum", orbMist: "rgb(124 145 210)", roomMist: [150, 166, 216], weight: 0.55 },
  { state: "sleepy", orbMist: "rgb(112 122 192)", roomMist: [120, 126, 188], weight: 0.8 },
  { state: "sleepy", reaction: "settle", orbMist: "rgb(98 108 182)", roomMist: [100, 104, 170], weight: 1 },
];

export function feelAt(index: number | null | undefined): CheckInFeel | null {
  if (index == null || index < 0 || index >= CHECK_IN_FEELS.length) return null;
  return CHECK_IN_FEELS[index];
}

/**
 * Where the word was let go (viewport coords). MistField gathers
 * toward this point — the room sighs the word in. When omitted
 * (re-pick on preview, programmatic) it gathers toward the pointer.
 */
export interface FeelOrigin {
  x: number;
  y: number;
}

export function applyFeel(index: number | null | undefined, origin?: FeelOrigin) {
  if (typeof document === "undefined") return;
  const feel = feelAt(index);
  const el = document.documentElement;
  if (!feel) {
    clearFeel();
    return;
  }
  el.dataset.feel = String(index);
  el.style.setProperty("--brume-orb-mist", feel.orbMist);
  el.style.setProperty("--brume-mist-r", String(feel.roomMist[0]));
  el.style.setProperty("--brume-mist-g", String(feel.roomMist[1]));
  el.style.setProperty("--brume-mist-b", String(feel.roomMist[2]));
  el.style.setProperty("--brume-feel-weight", String(feel.weight));
  el.dispatchEvent(
    new CustomEvent("brume:feel", {
      detail: { index, x: origin?.x, y: origin?.y },
    }),
  );
}

export function clearFeel() {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  delete el.dataset.feel;
  el.style.removeProperty("--brume-orb-mist");
  el.style.removeProperty("--brume-mist-r");
  el.style.removeProperty("--brume-mist-g");
  el.style.removeProperty("--brume-mist-b");
  el.style.removeProperty("--brume-feel-weight");
}
