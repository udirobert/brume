import { create } from "zustand";
import { FEELINGS, feelingAt } from "./feelings";

export type RoomMaterial = "mist" | "waves" | "sand" | "cells" | "snow" | "ink";
export type RoomDemeanor = "open" | "attentive" | "sheltering";

export const ROOM_MATERIALS = [
  "mist",
  "waves",
  "sand",
  "cells",
  "snow",
  "ink",
] as const;

export const ROOM_LABELS: Record<RoomMaterial, string> = {
  mist: "Mist",
  waves: "Waves",
  sand: "Sand",
  cells: "Cells",
  snow: "Snow",
  ink: "Ink",
};

export const FEEL_MATERIALS: readonly RoomMaterial[] = FEELINGS.map(
  (f) => f.material,
);

export function materialForFeel(index: number | null | undefined): RoomMaterial {
  return feelingAt(index)?.material ?? "mist";
}

export function demeanorForFeel(index: number | null | undefined): RoomDemeanor {
  return feelingAt(index)?.demeanor ?? "open";
}

/**
 * Art-as-artifact: a remembered room material derived only from closed-set
 * ledger entries (feeling index). Majority material of the recent entries,
 * falling back to the most recent. Returns null when there is no history.
 * No free text, no scores — a skin, not a surface.
 */
export function rememberedMaterialFromFeelings(feelIndices: ReadonlyArray<number | null | undefined>): RoomMaterial | null {
  const valid = feelIndices
    .map((i) => (typeof i === "number" && Number.isInteger(i) ? i : null))
    .filter((i): i is number => i !== null);
  if (!valid.length) return null;
  const recent = valid.slice(-7);
  const counts = new Map<RoomMaterial, number>();
  for (const i of recent) {
    const m = materialForFeel(i);
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  let best: RoomMaterial = materialForFeel(recent[recent.length - 1]);
  let bestN = 0;
  for (const [m, n] of counts) {
    if (n > bestN) { bestN = n; best = m; }
  }
  return best;
}

export function practiceProgress(seconds: number): number {
  return Number.isFinite(seconds) ? Math.min(Math.max(seconds / 90, 0), 1) : 0;
}

export interface RoomPractice {
  progress?: number;
  breath?: number;
  practicing?: boolean;
  paused?: boolean;
}

export interface RoomExperienceState {
  feelIndex: number | null;
  materialOverride: RoomMaterial | null;
  rememberedMaterial: RoomMaterial | null;
  still: boolean;
  progress: number;
  breath: number;
  practicing: boolean;
  paused: boolean;
  setFeel: (index: number | null | undefined) => void;
  setMaterial: (material: RoomMaterial | null) => void;
  setRememberedMaterial: (material: RoomMaterial | null) => void;
  setStill: (still: boolean) => void;
  setPractice: (practice: RoomPractice) => void;
  reset: () => void;
}

const ROOM_DEFAULTS = {
  feelIndex: null,
  materialOverride: null,
  rememberedMaterial: null,
  still: false,
  progress: 0,
  breath: 0,
  practicing: false,
  paused: false,
} as const;

const clamp01 = (v: number) =>
  Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

export const useRoomExperience = create<RoomExperienceState>((set, get) => ({
  ...ROOM_DEFAULTS,
  setFeel: (index) => {
    const next = feelingAt(index) ? (index as number) : null;
    const prev = get().feelIndex;
    set(next === prev ? { feelIndex: next } : { feelIndex: next, progress: 0 });
  },
  setMaterial: (material) =>
    set({ materialOverride: material && ROOM_MATERIALS.includes(material) ? material : null }),
  setRememberedMaterial: (material) =>
    set({ rememberedMaterial: material && ROOM_MATERIALS.includes(material) ? material : null }),
  setStill: (still) => set({ still: !!still }),
  setPractice: (practice) =>
    set((state) => {
      const next = {
        progress:
          practice.progress === undefined
            ? state.progress
            : clamp01(practice.progress),
        breath:
          practice.breath === undefined
            ? state.breath
            : clamp01(practice.breath),
        practicing: practice.practicing ?? state.practicing,
        paused: practice.paused ?? state.paused,
      };
      return next.progress === state.progress &&
        next.breath === state.breath &&
        next.practicing === state.practicing &&
        next.paused === state.paused
        ? state
        : next;
    }),
  reset: () => set({ ...ROOM_DEFAULTS }),
}));

export function resolvedMaterial(state: {
  materialOverride: RoomMaterial | null;
  feelIndex: number | null;
  rememberedMaterial?: RoomMaterial | null;
}): RoomMaterial {
  if (state.materialOverride) return state.materialOverride;
  if (state.feelIndex !== null) return materialForFeel(state.feelIndex);
  return state.rememberedMaterial ?? "mist";
}
