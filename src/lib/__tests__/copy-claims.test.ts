/**
 * Copy claims guard — nothing user-facing may promise an outcome.
 * Every recommendation reason/explanation/bestFor and every pattern
 * description/benefit describes the rhythm, not a health result.
 */
import { describe, it, expect } from "vitest";
import { SmartPatternRecommendations } from "../recommendations/SmartPatternRecommendations";
import { BREATHING_PATTERNS } from "../breathingPatterns";
import { ROOM_LABELS } from "../roomExperience";
import {
  AFTER_PRACTICE_CHOICES,
  CHECK_IN_LABELS,
  CHECK_IN_SHORT_LABELS,
  CHECK_IN_PHRASES,
  FOR_OPTIONS,
  SUPPORT_SENTENCES,
  composeCheckInMessage,
} from "../checkin";
import { HOME_FEELING_COPY } from "../feelings";

const BANNED =
  /proven|scientific|nervous system|anxiety|insomnia|immune|cortisol|vagus|stress relief|sleep quality|energy boost|parasympathetic|biometric/i;

describe("recommendation copy", () => {
  const moods = ["stressed", "anxious", "tired", "calm"] as const;
  const hours = [7, 11, 15, 19, 23];

  it("contains no outcome or health claims", () => {
    const strings: string[] = [];

    for (const mood of moods) {
      for (const timeOfDay of hours) {
        for (const rec of SmartPatternRecommendations.getRecommendations({
          currentMood: mood,
          timeOfDay,
          userLevel: "beginner",
          sessionType: "classic",
        })) {
          strings.push(rec.reason, ...rec.bestFor);
        }
      }
    }

    for (const rec of SmartPatternRecommendations.getRecommendations({
      isFirstSession: true,
    })) {
      strings.push(rec.reason, ...rec.bestFor);
    }

    expect(strings.length).toBeGreaterThan(0);
    for (const s of strings) {
      expect(s).not.toMatch(BANNED);
    }
  });
});

describe("pattern copy", () => {
  it("contains no outcome or health claims", () => {
    for (const pattern of Object.values(BREATHING_PATTERNS)) {
      expect(pattern.description).not.toMatch(BANNED);
      for (const benefit of pattern.benefits) {
        expect(benefit).not.toMatch(BANNED);
      }
    }
  });

describe("check-in copy", () => {
  it("uses no banned language", () => {
    const strings: string[] = [
      ...CHECK_IN_LABELS,
      ...CHECK_IN_SHORT_LABELS,
      ...CHECK_IN_PHRASES,
      ...Object.values(SUPPORT_SENTENCES),
      ...FOR_OPTIONS.map((o) => o.label),
    ];
    for (let i = 0; i < CHECK_IN_LABELS.length; i++) {
      for (const support of Object.keys(SUPPORT_SENTENCES)) {
        strings.push(
          composeCheckInMessage(i, support as never, "work"),
          composeCheckInMessage(i, support as never, "someone_close"),
        );
      }
    }
    strings.push(composeCheckInMessage(null, null));
    strings.push(...Object.values(ROOM_LABELS), "Change room", "Still room", "Auto", "Ambience");
    strings.push(...Object.values(HOME_FEELING_COPY));
    strings.push(
      ...AFTER_PRACTICE_CHOICES.map((c) => c.label),
      "How is it now?",
      "You can leave it here.",
      "The word you carried can rest here.",
      "The breath can rest here.",
      "Tap to keep breathing",
      "About a minute and a half — then the breath offers to rest.",
      "Practice details",
      "practice time",
      "About Brume.",
      "One check-in, one rhythm, one moment. That is the whole practice.",
      "Every word carries a rhythm",
      "The mascot",
      "The room",
      "What it never does",
      "No camera. No scores. No streaks. Sounds play from files on this device — nothing is sent anywhere.",
    );
    for (const str of strings) {
      expect(str, `"${str}"`).not.toMatch(BANNED);
    }
  });
});
});
