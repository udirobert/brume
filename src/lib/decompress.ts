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

export const CHECK_IN_LABELS = [
  "Okay as I am",
  "A little stretched",
  "A lot on my mind",
  "Near my limit",
  "Overwhelmed",
] as const;

export const CHECK_IN_SHORT_LABELS = [
  "Okay",
  "Stretched",
  "A lot",
  "At limit",
  "Overwhelmed",
] as const;

export type SupportChoice = "company" | "space" | "listening" | "unsure";

const CHECK_IN_PHRASES = [
  "okay as I am",
  "a little stretched",
  "carrying a lot",
  "near my limit",
  "quietly overwhelmed",
] as const;

const SUPPORT_SENTENCES: Record<SupportChoice, string> = {
  company: "Some company would be enough.",
  space: "A little space would help.",
  listening: "Listening would help; I don't need it solved.",
  unsure: "I'm not sure what would help yet.",
};

export function getDecompressStep(elapsedSeconds: number): DecompressStep {
  const elapsed = Math.max(0, Math.min(DECOMPRESS_SECONDS, elapsedSeconds));
  return (
    DECOMPRESS_STEPS.find((step) => elapsed >= step.start && elapsed < step.end) ??
    DECOMPRESS_STEPS[DECOMPRESS_STEPS.length - 1]
  );
}

export function composeDecompressMessage(
  checkInIndex: number,
  support: SupportChoice | null,
): string {
  const index = Math.max(0, Math.min(CHECK_IN_PHRASES.length - 1, checkInIndex));
  const supportSentence = support
    ? SUPPORT_SENTENCES[support]
    : "I don't need it solved; I just wanted you to know.";
  return `I'm ${CHECK_IN_PHRASES[index]} today. ${supportSentence}`;
}
