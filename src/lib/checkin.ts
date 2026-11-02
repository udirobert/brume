/**
 * Check-in vocabulary — the "say it without explaining it" loop.
 * Shared by Decompress, Home and the post-session words card.
 */

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

export const CHECK_IN_PHRASES = [
  "okay as I am",
  "a little stretched",
  "carrying a lot",
  "near my limit",
  "quietly overwhelmed",
] as const;

export const SUPPORT_SENTENCES: Record<SupportChoice, string> = {
  company: "Some company would be enough.",
  space: "A little space would help.",
  listening: "Listening would help; I don't need it solved.",
  unsure: "I'm not sure what would help yet.",
};

export type ForChoice = "someone_close" | "work" | "just_for_me";

export const FOR_OPTIONS: Array<{ id: ForChoice; label: string }> = [
  { id: "someone_close", label: "Someone close" },
  { id: "work", label: "Work" },
  { id: "just_for_me", label: "Just for me" },
];

const NEUTRAL_PHRASE = "not sure how I am";

function phraseFor(checkInIndex: number | null): string {
  if (checkInIndex == null || checkInIndex < 0) return NEUTRAL_PHRASE;
  const index = Math.max(0, Math.min(CHECK_IN_PHRASES.length - 1, checkInIndex));
  return CHECK_IN_PHRASES[index];
}

function openerFor(phrase: string, forChoice: ForChoice | null): string {
  if (forChoice === "work") return `Heads up: I'm ${phrase} today.`;
  return `I'm ${phrase} today.`;
}

/**
 * One honest shareable sentence. `forChoice === "just_for_me"` means the
 * message is only ever shown, never offered for copy/share — the caller
 * handles that branch.
 */
export function composeCheckInMessage(
  checkInIndex: number | null,
  support: SupportChoice | null,
  forChoice: ForChoice | null = null,
): string {
  const supportSentence = support
    ? SUPPORT_SENTENCES[support]
    : "I don't need it solved; I just wanted you to know.";
  return `${openerFor(phraseFor(checkInIndex), forChoice)} ${supportSentence}`;
}
