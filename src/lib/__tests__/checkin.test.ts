import { describe, it, expect } from "vitest";
import {
  CHECK_IN_LABELS,
  CHECK_IN_SHORT_LABELS,
  CHECK_IN_PHRASES,
  FOR_OPTIONS,
  SUPPORT_SENTENCES,
  composeCheckInMessage,
} from "../checkin";
import { BREATHING_PATTERNS } from "../breathingPatterns";
import { CHECK_IN_PATTERN_IDS } from "@/components/home/TodayCard";

describe("composeCheckInMessage", () => {
  it("uses the neutral opener when no point was chosen", () => {
    expect(composeCheckInMessage(null, null)).toBe(
      "I'm not sure how I am today. I don't need it solved; I just wanted you to know.",
    );
    expect(composeCheckInMessage(-1, null)).toContain("not sure how I am");
  });

  it("opens 'Heads up' for Work, plain for Someone close / none", () => {
    expect(composeCheckInMessage(0, null, "work")).toContain(
      "Heads up: I'm okay as I am today.",
    );
    expect(composeCheckInMessage(0, null, "someone_close")).toContain(
      "I'm okay as I am today.",
    );
    expect(composeCheckInMessage(2, null)).toContain("I'm carrying a lot today.");
  });

  it("appends the chosen support sentence", () => {
    for (const [key, sentence] of Object.entries(SUPPORT_SENTENCES)) {
      expect(
        composeCheckInMessage(1, key as keyof typeof SUPPORT_SENTENCES),
      ).toContain(sentence);
    }
  });

  it("clamps out-of-range indexes", () => {
    expect(composeCheckInMessage(99, null)).toContain(
      CHECK_IN_PHRASES[CHECK_IN_PHRASES.length - 1],
    );
  });
});

describe("check-in vocab", () => {
  it("labels, phrases and short labels line up", () => {
    expect(CHECK_IN_LABELS).toHaveLength(5);
    expect(CHECK_IN_SHORT_LABELS).toHaveLength(5);
    expect(CHECK_IN_PHRASES).toHaveLength(5);
  });

  it("FOR_OPTIONS covers the three registers", () => {
    expect(FOR_OPTIONS.map((o) => o.id)).toEqual([
      "someone_close",
      "work",
      "just_for_me",
    ]);
  });
});

describe("TodayCard mapping", () => {
  it("every check-in label maps to an existing pattern", () => {
    expect(CHECK_IN_PATTERN_IDS).toHaveLength(CHECK_IN_SHORT_LABELS.length);
    for (const id of CHECK_IN_PATTERN_IDS) {
      expect(BREATHING_PATTERNS[id], `pattern ${id}`).toBeTruthy();
    }
    // Overwhelmed → shortest, no holds
    expect(CHECK_IN_PATTERN_IDS[4]).toBe("reset");
  });
});

describe("formatPhases", () => {
  it("skips zero phases", async () => {
    const { formatPhases } = await import("../breathingPatterns");
    expect(formatPhases({ inhale: 4, hold: 0, exhale: 6 })).toBe("4 in · 6 out");
    expect(formatPhases({ inhale: 4, hold: 4, exhale: 4, hold_after_exhale: 4 })).toBe("4 in · 4 hold · 4 out · 4 hold");
    expect(formatPhases({ inhale: 4, hold: 7, exhale: 8, pause: 0 })).toBe("4 in · 7 hold · 8 out");
  });
});
