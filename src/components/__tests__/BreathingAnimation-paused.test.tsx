/**
 * BreathingAnimation — paused state: the word "Paused", a soft
 * "take your time" line, and the frozen session duration in the corner.
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import BreathingAnimation from "../BreathingAnimation";

const pattern = {
  name: "Reset",
  phases: { inhale: 4, hold: 0, exhale: 6, hold_after_exhale: 0 },
};

describe("BreathingAnimation paused state", () => {
  it("renders 'Paused', the frozen duration, and a soft line", () => {
    const html = renderToString(
      <BreathingAnimation
        phase="inhale"
        text="Paused"
        pattern={pattern}
        isActive={false}
        isPaused
        phaseProgress={30}
        cycleCount={3}
        sessionInfo={{ duration: "00:47", progressPercentage: 40 }}
      />
    );
    expect(html).toContain("Paused");
    expect(html).toContain("00:47"); // frozen timer, not restarted
    expect(html).toContain("Take your time");
    // SSR inserts a comment node inside "cycle {n}" — match loosely.
    expect(html).toMatch(/cycle <!-- -->3|cycle 3/);
  });

  it("does not show the paused line while actively breathing", () => {
    const html = renderToString(
      <BreathingAnimation
        phase="inhale"
        pattern={pattern}
        isActive
        isPaused={false}
        phaseProgress={30}
        sessionInfo={{ duration: "00:12", progressPercentage: 10 }}
      />
    );
    expect(html).not.toContain("Take your time");
    expect(html).toContain("Inhale");
  });
});
