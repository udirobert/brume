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
import { useRoomExperience, type RoomDemeanor } from "./roomExperience";
import { FEELINGS, feelingAt } from "./feelings";

export interface CheckInFeel {
  state: BrumeMascotState;
  reaction?: MascotReaction;
  /** --brume-orb-mist: the session orb takes the feeling's colour. */
  orbMist: string;
  /** --brume-mist-r/g/b: the whole room retints (MistField reads it live). */
  roomMist: readonly [r: number, g: number, b: number];
  /** 0..1 — heavier words still the drift and thicken the folds. */
  weight: number;
  demeanor: RoomDemeanor;
  valence?: "positive" | "heavy";
}

export const CHECK_IN_FEELS: readonly CheckInFeel[] = FEELINGS;

export function feelAt(index: number | null | undefined): CheckInFeel | null {
  return feelingAt(index);
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
  const feel = feelAt(index);
  useRoomExperience.getState().setFeel(feel ? index : null);
  if (typeof document === "undefined") return;
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

export function demeanorAt(index: number | null | undefined): RoomDemeanor {
  return feelAt(index)?.demeanor ?? "open";
}

export function clearFeel() {
  useRoomExperience.getState().setFeel(null);
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  delete el.dataset.feel;
  el.style.removeProperty("--brume-orb-mist");
  el.style.removeProperty("--brume-mist-r");
  el.style.removeProperty("--brume-mist-g");
  el.style.removeProperty("--brume-mist-b");
  el.style.removeProperty("--brume-feel-weight");
}
