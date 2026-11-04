import { describe, expect, it } from "vitest";
import { checkInPrompt } from "../feelings";
import { sessionGreeting } from "../spokenGreeting";

describe("checkInPrompt", () => {
  it("returns a prompt from the daypart-filtered pool", () => {
    const a = checkInPrompt(new Date(2026, 10, 4, 12), () => 0);
    expect(a.text.length).toBeGreaterThan(3);
    expect(["now", "aspire", "avoid"]).toContain(a.mode);
  });
  it("varies across rolls — every visit can ask differently", () => {
    const texts = new Set(
      [...Array(40)].map((_, i) =>
        checkInPrompt(new Date(2026, 10, 4, 12), () => i / 40).text,
      ),
    );
    expect(texts.size).toBeGreaterThan(4);
  });
  it("night-only questions appear at night", () => {
    const texts = new Set(
      [...Array(40)].map(
        (_, i) => checkInPrompt(new Date(2026, 10, 4, 23), () => i / 40).text,
      ),
    );
    expect([...texts].some((t) => t.includes("awake"))).toBe(true);
  });
});

describe("sessionGreeting modes", () => {
  it("says 'looking for' on aspire/avoid, plain on now", () => {
    expect(sessionGreeting(8, 20, "aspire")).toContain("looking for");
    expect(sessionGreeting(8, 20, "now")).not.toContain("looking for");
  });
});
