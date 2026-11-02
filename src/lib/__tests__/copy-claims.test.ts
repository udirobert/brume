/**
 * Copy claims guard — nothing user-facing may promise an outcome.
 * Every recommendation reason/explanation/bestFor and every pattern
 * description/benefit describes the rhythm, not a health result.
 */
import { describe, it, expect } from "vitest";
import { SmartPatternRecommendations } from "../recommendations/SmartPatternRecommendations";
import { BREATHING_PATTERNS } from "../breathingPatterns";

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
});
