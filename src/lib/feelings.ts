import type { BrumeMascotState, MascotReaction } from "../../anna/bundle/mascot-engine.js";
import type { RoomDemeanor, RoomMaterial } from "./roomExperience";

export interface FeelingDefinition {
  id: string;
  label: string;
  longLabel: string;
  phrase: string;
  patternId: string;
  valence: "positive" | "heavy";
  state: BrumeMascotState;
  reaction: MascotReaction;
  material: RoomMaterial;
  demeanor: RoomDemeanor;
  weight: number;
  orbMist: string;
  roomMist: readonly [number, number, number];
}

export const HOME_FEELING_COPY = {
  prompt: "How are you feeling?",
  hint: "Tap again to see the other side.",
  options: "Options",
} as const;

export type CheckInMode = "now" | "aspire" | "avoid";

// One question per day — the room asks differently, like weather.
// Modes: "now" = how you feel; "aspire" = what you want; "avoid" =
// what you don't want (the chip answers with its pair partner).
const CHECKIN_PROMPTS: { text: string; mode: CheckInMode }[] = [
  { text: "How are you feeling?", mode: "now" },
  { text: "What would you like to feel?", mode: "aspire" },
  { text: "Sum up your feelings.", mode: "now" },
  { text: "What do you not want to feel?", mode: "avoid" },
  { text: "Name where you are.", mode: "now" },
  { text: "What are you not feeling that you want to?", mode: "aspire" },
  { text: "What's the weather in you?", mode: "now" },
  { text: "Which feeling would you like to lose?", mode: "avoid" },
  { text: "Which feeling do you want more of?", mode: "aspire" },
];

/** Today's check-in question — deterministic per calendar day. */
export function todayCheckInPrompt(
  date = new Date(),
): { text: string; mode: CheckInMode } {
  const day = Math.floor(date.getTime() / 86_400_000);
  return CHECKIN_PROMPTS[day % CHECKIN_PROMPTS.length];
}

const PALETTES = [
  { orbMist: "rgb(146 158 214)", roomMist: [212, 218, 164] },
  { orbMist: "rgb(150 132 198)", roomMist: [188, 176, 224] },
  { orbMist: "rgb(124 145 210)", roomMist: [150, 166, 216] },
  { orbMist: "rgb(112 122 192)", roomMist: [120, 126, 188] },
  { orbMist: "rgb(98 108 182)", roomMist: [100, 104, 170] },
] as const;

const rows = [
  ["okay", "Okay", "Okay as I am", "okay as I am", "mindfulness", "positive", "bright", "hop", "waves", "open", 0.1, 0],
  ["stretched", "Stretched", "A little stretched", "a little stretched", "box", "heavy", "watching", "ready", "sand", "attentive", 0.3, 1],
  ["a-lot", "A lot", "A lot on my mind", "carrying a lot", "relaxation", "heavy", "tender", "settle", "cells", "attentive", 0.55, 2],
  ["at-limit", "At limit", "Near my limit", "near my limit", "relaxation", "heavy", "tender", "settle", "snow", "sheltering", 0.8, 3],
  ["overwhelmed", "Overwhelmed", "Overwhelmed", "quietly overwhelmed", "reset", "heavy", "tender", "settle", "ink", "sheltering", 1, 4],
  ["light", "Light", "Light", "feeling light", "mindfulness", "positive", "bright", "hop", "sand", "open", 0.1, 0],
  ["heavy", "Heavy", "Heavy", "feeling heavy", "reset", "heavy", "exhale", "settle", "sand", "sheltering", 0.75, 3],
  ["energised", "Energised", "Energised", "energised", "box", "positive", "stretch", "ready", "waves", "open", 0.15, 0],
  ["drained", "Drained", "Drained", "drained", "reset", "heavy", "sleepy", "settle", "waves", "attentive", 0.65, 2],
  ["settled", "Settled", "Settled", "settled", "mindfulness", "positive", "hum", "settle", "snow", "open", 0.1, 0],
  ["restless", "Restless", "Restless", "restless", "box", "heavy", "thinking", "ready", "snow", "attentive", 0.45, 1],
  ["connected", "Connected", "Connected", "feeling connected", "mindfulness", "positive", "tender", "ready", "cells", "open", 0.15, 0],
  ["lonely", "Lonely", "Lonely", "lonely", "reset", "heavy", "watching", "settle", "cells", "sheltering", 0.7, 3],
  ["hopeful", "Hopeful", "Hopeful", "hopeful", "reset", "positive", "proud", "celebrate", "ink", "open", 0.1, 0],
] as const;

export const FEELINGS: readonly FeelingDefinition[] = rows.map(
  ([id, label, longLabel, phrase, patternId, valence, state, reaction, material, demeanor, weight, pi]) => ({
    id, label, longLabel, phrase, patternId, valence, state, reaction, material, demeanor, weight,
    orbMist: PALETTES[pi].orbMist,
    roomMist: PALETTES[pi].roomMist,
  }),
);

export function feelingAt(index: number | null | undefined): FeelingDefinition | null {
  if (!Number.isInteger(index) || index! < 0 || index! >= FEELINGS.length) return null;
  return FEELINGS[index!];
}

export function isPositiveFeel(index: number | null | undefined): boolean {
  return feelingAt(index)?.valence === "positive";
}

export const LEGACY_FEEL_INDICES = [0, 1, 2, 3, 4] as const;

export const FEELING_PAIRS = [
  { id: "weight", indices: [5, 6], initialIndex: 5, legacy: [2] },
  { id: "energy", indices: [7, 8], initialIndex: 8, legacy: [] },
  { id: "settled", indices: [9, 10], initialIndex: 9, legacy: [0, 1] },
  { id: "connection", indices: [11, 12], initialIndex: 12, legacy: [] },
  { id: "outlook", indices: [13, 4], initialIndex: 4, legacy: [3] },
] as const;

export function pairForFeel(index: number | null | undefined) {
  if (!Number.isInteger(index)) return null;
  return (
    FEELING_PAIRS.find(
      (p) =>
        (p.indices as readonly number[]).includes(index!) ||
        (p.legacy as readonly number[]).includes(index!),
    ) ?? null
  );
}

export function oppositeFeel(index: number | null | undefined): number | null {
  const feel = feelingAt(index);
  const pair = pairForFeel(index);
  if (!feel || !pair) return null;
  return feel.valence === "positive" ? pair.indices[1] : pair.indices[0];
}

export interface PairedFeelState {
  faces: number[];
  selected: number | null;
}

export function initialPairedFeelState(selected: number | null): PairedFeelState {
  const faces: number[] = FEELING_PAIRS.map((p) => p.initialIndex);
  const sel = feelingAt(selected) ? selected! : null;
  if (sel !== null) {
    const pair = pairForFeel(sel);
    if (pair) faces[FEELING_PAIRS.indexOf(pair)] = sel;
  }
  return { faces, selected: sel };
}

export function selectPairedFeel(
  state: PairedFeelState,
  pairIndex: number,
): PairedFeelState {
  if (!Number.isInteger(pairIndex) || pairIndex < 0 || pairIndex >= state.faces.length)
    return state;
  const face = state.faces[pairIndex];
  const next =
    state.selected === face ? (oppositeFeel(face) ?? face) : face;
  const faces = [...state.faces];
  faces[pairIndex] = next;
  return { faces, selected: next };
}
