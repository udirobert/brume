/**
 * Check-in vocabulary — the "say it without explaining it" loop.
 * Shared by Decompress, Home and the post-session words card.
 */

import { FEELINGS, feelingAt } from "./feelings";

export const CHECK_IN_LABELS = FEELINGS.map((f) => f.longLabel);

export const CHECK_IN_SHORT_LABELS = FEELINGS.map((f) => f.label);

export type SupportChoice = "company" | "space" | "listening" | "unsure";

export const AFTER_PRACTICE_CHOICES = [
  { id: "lighter", label: "A little lighter" },
  { id: "same", label: "About the same" },
  { id: "heavy", label: "Still a lot" },
] as const;

export type AfterPracticeChoiceId = (typeof AFTER_PRACTICE_CHOICES)[number]["id"];

export const CHECK_IN_PHRASES = FEELINGS.map((f) => f.phrase);

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
  return feelingAt(checkInIndex)?.phrase ?? NEUTRAL_PHRASE;
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
