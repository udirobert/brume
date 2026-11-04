/**
 * sessionGreeting — Brume speaks from its own side of the room.
 * The invariants are the character: no echo of the catalog, one line per
 * situation (never a deck), and short enough to hand someone into a breath.
 */
import { describe, it, expect } from "vitest";
import { sessionGreeting } from "../spokenGreeting";
import { FEELINGS } from "../feelings";

const HOURS = [6, 12, 18, 23];
const CATALOG_WORDS = FEELINGS.flatMap((f) => [
  f.label,
  f.longLabel,
  f.phrase,
]).map((w) => w.toLowerCase());

describe("sessionGreeting", () => {
  it("names the hour when it has nothing else to go on", () => {
    expect(sessionGreeting(null, 6)).toBe(
      "Early morning. I'll count the rhythm — leave the rest to me.",
    );
    expect(sessionGreeting(null, 12)).toMatch(/^Midday\./);
    expect(sessionGreeting(null, 23)).toMatch(/^It's late\./);
  });

  it("never says a word from the catalog it just offered", () => {
    for (let i = -1; i < FEELINGS.length; i++) {
      for (const hour of HOURS) {
        const line = sessionGreeting(i, hour).toLowerCase();
        for (const word of CATALOG_WORDS) {
          expect(line, `"${line}" echoes "${word}"`).not.toContain(word);
        }
      }
    }
  });

  it("answers the valence, not the word", () => {
    const heavyLine = sessionGreeting(
      FEELINGS.findIndex((f) => f.valence === "heavy"),
      12,
    );
    const positiveLine = sessionGreeting(
      FEELINGS.findIndex((f) => f.valence === "positive"),
      12,
    );
    expect(heavyLine).not.toBe(positiveLine);
    for (let i = 0; i < FEELINGS.length; i++) {
      const expected = FEELINGS[i].valence === "heavy" ? heavyLine : positiveLine;
      expect(sessionGreeting(i, 12)).toBe(expected);
      expect(sessionGreeting(i, 12)).toMatch(/^Midday/);
    }
  });

  it("is the same companion every visit — no rotation, no RNG", () => {
    for (let i = 0; i < FEELINGS.length; i++) {
      for (const hour of HOURS) {
        expect(sessionGreeting(i, hour)).toBe(sessionGreeting(i, hour));
      }
    }
  });

  it("stays a whisper — one breath of a sentence", () => {
    for (let i = -1; i < FEELINGS.length; i++) {
      for (const hour of HOURS) {
        expect(sessionGreeting(i, hour).length).toBeLessThanOrEqual(80);
      }
    }
  });
});
