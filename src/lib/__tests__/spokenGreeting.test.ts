import { describe, it, expect } from "vitest";
import { sessionGreeting } from "../spokenGreeting";
import { FEELINGS } from "../feelings";

describe("sessionGreeting", () => {
  it("names the daypart", () => {
    expect(sessionGreeting(null, 6)).toMatch(/^Early morning\./);
    expect(sessionGreeting(null, 12)).toMatch(/^Midday\./);
    expect(sessionGreeting(null, 18)).toMatch(/^Evening\./);
    expect(sessionGreeting(null, 23)).toMatch(/^It's late\./);
  });

  it("greets without a check-in word", () => {
    expect(sessionGreeting(null, 12)).toBe(
      "Midday. A short breathing pause — I'll count the rhythm for you.",
    );
  });

  it("names the feeling's phrase with a tail that matches its valence", () => {
    for (let i = 0; i < FEELINGS.length; i++) {
      const line = sessionGreeting(i, 12);
      expect(line).toContain(`You came in ${FEELINGS[i].phrase}`);
      expect(
        line.endsWith(
          FEELINGS[i].valence === "heavy"
            ? "we'll take it slow."
            : "the rhythm stays easy.",
        ),
      ).toBe(true);
    }
  });

  it("stays a whisper — always one short sentence pair", () => {
    for (let i = -1; i < FEELINGS.length + 1; i++) {
      for (const hour of [6, 12, 18, 23]) {
        expect(sessionGreeting(i, hour).length).toBeLessThanOrEqual(110);
      }
    }
  });
});
