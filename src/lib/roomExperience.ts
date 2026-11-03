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
  still: boolean;
  progress: number;
  breath: number;
  practicing: boolean;
  paused: boolean;
  setFeel: (index: number | null | undefined) => void;
  setMaterial: (material: RoomMaterial | null) => void;
  setStill: (still: boolean) => void;
  setPractice: (practice: RoomPractice) => void;
  reset: () => void;
}

const ROOM_DEFAULTS = {
  feelIndex: null,
  materialOverride: null,
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
}): RoomMaterial {
  return state.materialOverride ?? materialForFeel(state.feelIndex);
}
