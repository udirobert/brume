import type { BrumeMascotState, MascotPresence, MascotReaction, SampleMascotOptions } from "./mascot-engine.js";

export interface CreateMascotOptions extends SampleMascotOptions {
  autoAnimate?: boolean;
  trackPointer?: boolean;
}

export interface MascotHandle {
  setState: (name: BrumeMascotState) => void;
  setBreath: (scale01: number) => void;
  setOptions: (partial: Partial<CreateMascotOptions>) => void;
  renderAt: (timeSeconds: number, overrides?: SampleMascotOptions) => void;
  react: (name: MascotReaction) => void;
  /** One-shot flight smear: direction vector + strength 0..1 (default 1). */
  smearFrom: (v: { x: number; y: number; strength?: number }) => void;
  destroy: () => void;
}

export function createMascot(host: HTMLElement, options?: CreateMascotOptions): MascotHandle;

export type { BrumeMascotState, MascotPresence, MascotReaction, SampleMascotOptions };
