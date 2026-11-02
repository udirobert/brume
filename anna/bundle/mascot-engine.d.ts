export type BrumeMascotState =
  | "idle" | "thinking" | "inhale" | "topup" | "hold" | "exhale"
  | "proud" | "sleepy" | "bright" | "stretch" | "hum" | "watching";

export type MascotPresence = "quiet" | "companion";

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
  reducedMotion?: boolean;
  idleSeconds?: number;
  breathing?: boolean;
  breathPeriod?: number;
  stateAge?: number;
}

export interface MascotFrame {
  state: BrumeMascotState;
  presence: MascotPresence;
  reduced: boolean;
  breath: number | null;
  avatar: BrumeAvatar;
  svg: { scale: number; originX: number; originY: number };
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
export const BRUME_AVATAR: BrumeAvatar;

export function validateAvatar(
  value: unknown,
): { ok: true; value: BrumeAvatar } | { ok: false; errors: string[] };

export function sampleMascot(
  timeSeconds: number,
  options?: SampleMascotOptions,
): MascotFrame;
