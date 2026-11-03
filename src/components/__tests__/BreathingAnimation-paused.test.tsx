/**
 * BreathingAnimation — paused state shows the soft "Take your time"
 * word; no timers or cycle counters anywhere on screen.
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
  it("renders the soft paused word", () => {
    const html = renderToString(
      <BreathingAnimation
        phase="inhale"
        pattern={pattern}
        isActive={false}
        isPaused
        phaseProgress={30}
      />,
    );
    expect(html).toContain("Take your time");
    // The way back out of the pause is stated, not hidden in an icon.
    expect(html).toContain("Tap when you"); 
  });

  it("does not show the resume hint while breathing", () => {
    const html = renderToString(
      <BreathingAnimation
        phase="inhale"
        pattern={pattern}
        isActive
        isPaused={false}
        phaseProgress={30}
      />,
    );
    expect(html).not.toContain(" Tap when ");
  });

  it("shows the phase word while breathing — no counters", () => {
    const html = renderToString(
      <BreathingAnimation
        phase="inhale"
        pattern={pattern}
        isActive
        isPaused={false}
        phaseProgress={30}
      />,
    );
    expect(html).toContain("Breathe in");
    expect(html).not.toContain("cycle");
    expect(html).not.toContain("Take your time");
    expect(html).not.toMatch(/\d{2}:\d{2}/);
  });
});
