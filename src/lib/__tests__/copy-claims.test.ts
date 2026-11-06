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
import { HOME_FEELING_COPY, FEELINGS } from "../feelings";
import { CHECKIN_REASONS } from "../checkinLedger";
import { sessionGreeting } from "../spokenGreeting";
import { memoryLine } from "../memoryLine";
import { VOICE_HELP, VOICE_HELP_EXIT } from "../voiceCheckin";
import type { LedgerEntry } from "../checkinLedger";
import { appendRoomLink, buildQuietPauseIcs, invitationShareText } from "../invitation";

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
      "No camera. No scores. No streaks. Nothing about you is measured or inferred. Breath cues play from files on this device. Two moments use our voice service, and both wait for you to ask: holding \"say it\" sends a little audio while you speak — or tapping it, if you choose tap in the options — so Brume can offer the closest word, and asking to hear a line sends that line to be spoken back. Nothing from either is recorded — the words are matched and dropped. Nothing else leaves.",
      "Include a quiet room link",
      "Hold 2 min on calendar",
      appendRoomLink(composeCheckInMessage(0, "listening"), "reset"),
      invitationShareText(BREATHING_PATTERNS.reset),
      buildQuietPauseIcs({ patternId: "reset" }),
      "Hear it",
      "Read aloud by our voice service",
      ...CHECKIN_REASONS.map((r) => r.label),
      "because",
      "What is it about?",
      "private · stays on this device",
      "kept — just for you · stays on this device",
      sessionGreeting(null),
      sessionGreeting(null, 6),
      sessionGreeting(null, 18),
      sessionGreeting(null, 23),
    );
    for (let i = 0; i < FEELINGS.length; i++) {
      for (const hour of [6, 12, 18, 23]) {
        strings.push(sessionGreeting(i, hour));
      }
    }
    for (const str of strings) {
      expect(str, `"${str}"`).not.toMatch(BANNED);
    }
  });

  it("the memory line, for every feeling and part of the day, is rhythm-only", () => {
    const now = Date.UTC(2026, 10, 6, 12);
    const lines: string[] = [];
    for (let f = 0; f < FEELINGS.length; f++) {
      for (const p of ["dawn", "day", "dusk", "night"] as const) {
        const rows: LedgerEntry[] = Array.from({ length: 7 }, (_, i) => ({
          t: now - (i + 1) * 3_600_000,
          f,
          r: null,
          p,
        }));
        const line = memoryLine(rows, now);
        expect(line, `${f}/${p}`).not.toBeNull();
        lines.push(line!);
      }
    }
    for (const str of lines) {
      expect(str, `"${str}"`).not.toMatch(BANNED);
      // It names a feeling's own phrase, never a verdict or a number.
      expect(str, `"${str}"`).not.toMatch(/\d|better|worse|improv|progress|streak|score/i);
    }
  });

  it("the spoken-match invitation suffixes are rhythm-only", () => {
    for (const str of ["? tap to choose", "maybe ", "heard ", "okay"]) {
      expect(str, `"${str}"`).not.toMatch(BANNED);
    }
  });

  it("the stuck-mic help table is rhythm-only too", () => {
    const strings: string[] = [VOICE_HELP_EXIT];
    for (const entry of Object.values(VOICE_HELP)) {
      if (typeof entry === "string") strings.push(entry);
      else strings.push(...Object.values(entry));
    }
    expect(strings.length).toBeGreaterThanOrEqual(9);
    for (const str of strings) {
      expect(str, `"${str}"`).not.toMatch(BANNED);
    }
  });
});
});
