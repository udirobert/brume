export type BrumeMascotState =
  | "idle" | "thinking" | "inhale" | "topup" | "hold" | "exhale"
  | "proud" | "sleepy" | "bright" | "stretch" | "hum" | "watching";

export type MascotPresence = "quiet" | "companion";

export type MascotReaction = "hop" | "settle" | "celebrate";

export interface MascotPose {
  open: number;
  dy: number;
  lid: number;
  lookX: number;
  lookY: number;
  mouth: string;
  cheek: number;
  arms: number;
  wisps: number;
  waves: number;
  swirl: number;
  bodyScale: number;
}

export type AvatarPrimitive =
  | { readonly type: "ellipse"; readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number; readonly opacity?: number }
  | { readonly type: "circle"; readonly cx: number; readonly cy: number; readonly r: number; readonly opacity?: number };

export interface BrumeAvatar {
  readonly version: 1;
  readonly body: readonly AvatarPrimitive[];
  readonly highlight: AvatarPrimitive;
  readonly eyes: Readonly<{ leftX: number; rightX: number; y: number; rx: number; ry: number }>;
  readonly mouths: Readonly<Record<"closed" | "smile" | "open" | "flat", string>>;
}

export interface SampleMascotOptions {
  avatar?: BrumeAvatar;
  state?: BrumeMascotState | string;
  breath?: number;
  presence?: MascotPresence;
  gaze?: { x?: number; y?: number };
  /** Static root tilt in degrees — used for the flight lean. */
  lean?: number;
  reducedMotion?: boolean;
  idleSeconds?: number;
  breathing?: boolean;
  breathPeriod?: number;
  stateAge?: number;
  from?: MascotPose;
  reaction?: { name: MascotReaction | string; age: number };
}

export interface MascotFrame {
  state: BrumeMascotState;
  presence: MascotPresence;
  reduced: boolean;
  breath: number | null;
  avatar: BrumeAvatar;
  root: { y: number; rotate: number; sx: number; sy: number; originX: number; originY: number };
  pose: MascotPose;
  body: { scale: number; originX: number; originY: number };
  eyes: {
    left: { cx: number; cy: number; rx: number; ry: number };
    right: { cx: number; cy: number; rx: number; ry: number };
    lidLeft: { x: number; y: number; width: number; height: number };
    lidRight: { x: number; y: number; width: number; height: number };
  };
  mouth: { d: string; dx: number; dy: number };
  gaze: { x: number; y: number };
  accessories: {
    halo: { opacity: number; scale: number };
    arms: {
      opacity: number;
      rotateLeft: number;
      rotateRight: number;
      pivotLeft: { x: number; y: number };
      pivotRight: { x: number; y: number };
    };
    cheeks: { opacity: number };
    wisps: { dy: number; opacity: number }[];
    waves: { opacity: number };
    swirl: { opacity: number; rotate: number };
  };
}

export const MASCOT_STATES: readonly BrumeMascotState[];
export const MASCOT_REACTIONS: readonly MascotReaction[];
export const MASCOT_REACTION_DURATIONS: Readonly<Record<MascotReaction, number>>;
export const BRUME_AVATAR: BrumeAvatar;

export function blendPath(a: string, b: string, k: number): string;
export function breathAmount(phase: string, progress01: number): number;

export function validateAvatar(
  value: unknown,
): { ok: true; value: BrumeAvatar } | { ok: false; errors: string[] };

export function sampleMascot(
  timeSeconds: number,
  options?: SampleMascotOptions,
): MascotFrame;
