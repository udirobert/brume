import { describe, expect, it } from "vitest";
import { todayCheckInPrompt } from "../feelings";
import { sessionGreeting } from "../spokenGreeting";

describe("todayCheckInPrompt", () => {
  it("is deterministic within a day and rotates across days", () => {
    const a = todayCheckInPrompt(new Date(2026, 10, 4, 8));
    const b = todayCheckInPrompt(new Date(2026, 10, 4, 23, 59));
    expect(a).toEqual(b);
    const texts = new Set(
      [...Array(20)].map(
        (_, i) => todayCheckInPrompt(new Date(2026, 10, i + 1)).text,
      ),
    );
    expect(texts.size).toBeGreaterThan(4);
  });
  it("covers all three modes in a rotation window", () => {
    const modes = new Set(
      [...Array(9)].map(
        (_, i) => todayCheckInPrompt(new Date(2026, 10, i + 1)).mode,
      ),
    );
    expect(modes).toContain("now");
    expect(modes).toContain("aspire");
    expect(modes).toContain("avoid");
  });
});

describe("sessionGreeting modes", () => {
  it("says 'looking for' on aspire/avoid days, plain on now days", () => {
    expect(sessionGreeting(8, 20, "aspire")).toContain("looking for");
    expect(sessionGreeting(8, 20, "now")).not.toContain("looking for");
  });
});
