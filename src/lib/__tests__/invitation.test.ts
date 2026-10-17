/**
 * Invitation links — the "pass this break on" contract:
 * the URL carries only a pattern id (plus the cosmetic via=invite flag).
 * No mood, history, camera data, scores, or reflection.
 */
import { describe, it, expect } from "vitest";
import {
  buildInvitationUrl,
  invitationShareText,
  estimateRoutineSeconds,
  INVITATION_ORIGIN,
} from "../invitation";
import { BREATHING_PATTERNS, getPattern } from "../breathingPatterns";

describe("reset pattern", () => {
  it("exists in the registry as a ~90-second comfortable routine", () => {
    const reset = getPattern("reset");
    expect(reset).toBeDefined();
    expect(reset!.name).toBe("Reset");
    expect(reset!.inhale).toBe(4);
    expect(reset!.hold).toBe(0);
    expect(reset!.exhale).toBe(6);
    expect(reset!.hold_after_exhale).toBe(0);
    // 9 cycles of 10s ≈ 90 seconds
    expect(estimateRoutineSeconds(reset!)).toBe(90);
  });

  it("makes no medical claims in its benefits", () => {
    const reset = BREATHING_PATTERNS.reset;
    for (const benefit of reset.benefits) {
      expect(benefit.toLowerCase()).not.toMatch(/cure|treat|heal|anxiety relief|reduce stress/);
    }
  });
});

describe("buildInvitationUrl", () => {
  it("points at /session on the public app origin", () => {
    const url = buildInvitationUrl("reset");
    expect(url.startsWith(`${INVITATION_ORIGIN}/session?`)).toBe(true);
  });

  it("contains only the pattern id and the cosmetic via flag", () => {
    const url = new URL(buildInvitationUrl("reset"));
    expect(url.searchParams.get("pattern")).toBe("reset");
    expect(url.searchParams.get("via")).toBe("invite");
    // The whole point of the contract: nothing personal rides the link.
    expect([...url.searchParams.keys()].sort()).toEqual(["pattern", "via"]);
  });

  it("never leaks personal fields", () => {
    const url = buildInvitationUrl("box");
    for (const field of ["mood", "streak", "score", "user", "session", "camera", "reflection", "duration", "cycles"]) {
      expect(new URL(url).searchParams.has(field)).toBe(false);
    }
  });
});

describe("invitationShareText", () => {
  it("describes reset as a 90-second break — useful to the recipient", () => {
    expect(invitationShareText(BREATHING_PATTERNS.reset)).toBe(
      "Take a 90-second breathing break"
    );
  });

  it("rounds longer patterns to whole minutes", () => {
    expect(invitationShareText(BREATHING_PATTERNS.sleep)).toMatch(
      /^Take a \d+-minute breathing break$/
    );
  });

  it("falls back gracefully without a pattern", () => {
    expect(invitationShareText()).toBe("Take a breathing break");
  });
});
