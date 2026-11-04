/**
 * Brume icon set — drawn fresh in the mascot's soft rounded style.
 * 24x24 stroke icons; slightly organic curves, one weight throughout.
 */
import React from "react";

export interface BrumeIconProps {
  className?: string;
  size?: number;
}

const base = (size: number): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
});

const make = (paths: string[]) =>
  function Icon({ className, size = 24 }: BrumeIconProps) {
    return (
      <svg {...base(size)} className={className}>
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    );
  };

/** A soft doorway / arch with a small mist curl — "a room", not a house. */
export const HomeIcon = make([
  // arch
  "M5.5 20v-7.2c0-3.6 2.7-6.3 6.5-6.3s6.5 2.7 6.5 6.3V20",
  // threshold
  "M4 20h16",
  // mist curl inside the doorway
  "M9.6 16.4c.9-.9 2.3-.9 3.1-.1.7.7 1.9.7 2.6-.1",
]);

/** Three stacked pebbles, decreasing size — accumulation, not a chart. */
export const ProgressIcon = make([
  "M4 17.5c0-2.2 3.6-3.5 8-3.5s8 1.3 8 3.5c0 1.6-3.2 2.8-8 2.8s-8-1.2-8-2.8z",
  "M6.5 11.6c0-1.9 2.4-3.1 5.5-3.1s5.5 1.2 5.5 3.1c0 1.3-2.3 2.2-5.5 2.2s-5.5-.9-5.5-2.2z",
  "M9 7c0-1.4 1.3-2.4 3-2.4s3 1 3 2.4c0 1-1.3 1.7-3 1.7S9 8 9 7z",
]);

/** A gentle swirl with a short trailing breath, echoing the mascot's swirl. */
export const DecompressIcon = make([
  "M12 4.5c4.4 0 7.5 3.1 7.5 7 0 3.6-2.8 6-6 6-2.9 0-5-1.9-5-4.4 0-2.1 1.6-3.6 3.5-3.6 1.6 0 2.7 1 2.7 2.3",
  "M3.5 16.2c1.5.8 3.2 1.2 4.9 1",
]);

/** A round head, tiny smile, soft shoulders. */
export const ProfileIcon = make([
  "M12 13.2c2.7 0 4.8-2 4.8-4.6 0-2.6-2.1-4.6-4.8-4.6s-4.8 2-4.8 4.6c0 2.6 2.1 4.6 4.8 4.6z",
  "M10.4 9.2c.5.5 1 .7 1.6.7s1.1-.2 1.6-.7",
  "M5.6 20c.7-3 3.2-4.7 6.4-4.7s5.7 1.7 6.4 4.7",
]);

/** A breath ring — outer circle with an inner offset arc (inhale/exhale). */
export const ResetIcon = make([
  "M12 20.2a8.2 8.2 0 1 1 8.2-8.2 8.2 8.2 0 0 1-8.2 8.2z",
  "M8.2 12.4a4.1 4.1 0 0 1 7.2-2.1",
]);

/** Cue glyph: an open mouth-ring with one ripple across the room — a voice. */
export const CueVoiceIcon = make([
  "M10.4 15.6a4.3 4.3 0 1 1 4.2-6.9",
  "M17.6 8.4c1.3 1.9 1.3 4.6 0 6.5",
]);

/** Cue glyph: two stacked mist curls — the sound of the breath, no words. */
export const CueBreathIcon = make([
  "M5.6 10c1.5-1.5 3.5-1.5 4.7-.2 1.2 1.2 3 1.1 4.2-.3",
  "M8.1 14.6c1.5-1.5 3.5-1.5 4.7-.2 1.2 1.2 3 1.1 4.2-.3",
]);

/** Cue glyph: a resting crescent — the closed eye of the mascot, nothing heard. */
export const CueQuietIcon = make([
  "M6.4 10.6a6.4 6.4 0 0 0 11.2 0",
]);

export default {
  HomeIcon,
  ProgressIcon,
  DecompressIcon,
  ProfileIcon,
  ResetIcon,
  CueVoiceIcon,
  CueBreathIcon,
  CueQuietIcon,
};
