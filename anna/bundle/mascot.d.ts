import type { BrumeMascotState, MascotPresence, SampleMascotOptions } from "./mascot-engine.js";

export interface CreateMascotOptions extends SampleMascotOptions {
  autoAnimate?: boolean;
  trackPointer?: boolean;
}

export interface MascotHandle {
  setState: (name: BrumeMascotState) => void;
  setBreath: (scale01: number) => void;
  setOptions: (partial: Partial<CreateMascotOptions>) => void;
  renderAt: (timeSeconds: number, overrides?: SampleMascotOptions) => void;
  destroy: () => void;
}

export function createMascot(host: HTMLElement, options?: CreateMascotOptions): MascotHandle;

export type { BrumeMascotState, MascotPresence, SampleMascotOptions };
