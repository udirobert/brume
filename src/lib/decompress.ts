export const DECOMPRESS_SECONDS = 120;

export interface DecompressStep {
  start: number;
  end: number;
  title: string;
  cue: string;
  mascot: "idle" | "exhale" | "stretch";
}

export const DECOMPRESS_STEPS: DecompressStep[] = [
  {
    start: 0,
    end: 20,
    title: "Arrive",
    cue: "Settle where you are. Let your hands rest somewhere easy.",
    mascot: "idle",
  },
  {
    start: 20,
    end: 48,
    title: "Settle",
    cue: "If comfortable, let your shoulders drift away from your ears.",
    mascot: "exhale",
  },
  {
    start: 48,
    end: 78,
    title: "Roll",
    cue: "Make a few small, slow shoulder circles. Keep it easy.",
    mascot: "stretch",
  },
  {
    start: 78,
    end: 104,
    title: "Soften",
    cue: "Let your arms feel heavy. Make room between your shoulder blades.",
    mascot: "stretch",
  },
  {
    start: 104,
    end: DECOMPRESS_SECONDS,
    title: "Land",
    cue: "Stay still, or sway a little. Nothing needs to happen next.",
    mascot: "exhale",
  },
];

export function getDecompressStep(elapsedSeconds: number): DecompressStep {
  const elapsed = Math.max(0, Math.min(DECOMPRESS_SECONDS, elapsedSeconds));
  return (
    DECOMPRESS_STEPS.find((step) => elapsed >= step.start && elapsed < step.end) ??
    DECOMPRESS_STEPS[DECOMPRESS_STEPS.length - 1]
  );
}

// Check-in vocabulary moved to ./checkin — re-exported for compatibility.
export {
  CHECK_IN_LABELS,
  CHECK_IN_SHORT_LABELS,
  CHECK_IN_PHRASES,
  SUPPORT_SENTENCES,
  composeCheckInMessage,
  type SupportChoice,
} from "./checkin";

import { composeCheckInMessage, type SupportChoice, type ForChoice } from "./checkin";

export function composeDecompressMessage(
  checkInIndex: number,
  support: SupportChoice | null,
): string {
  return composeCheckInMessage(checkInIndex, support, null as ForChoice | null);
}
