import { describe, it, expect } from "vitest";
import { easeInOutSine, breathScale, breathAmount } from "../breathCurve";

describe("easeInOutSine", () => {
  it("hits the endpoints and midpoint", () => {
    expect(easeInOutSine(0)).toBe(0);
    expect(easeInOutSine(0.5)).toBeCloseTo(0.5);
    expect(easeInOutSine(1)).toBeCloseTo(1);
  });

  it("is monotonic non-decreasing", () => {
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = easeInOutSine(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("clamps out-of-range inputs", () => {
    expect(easeInOutSine(-0.4)).toBe(0);
    expect(easeInOutSine(1.6)).toBeCloseTo(1);
  });
});

describe("breathScale", () => {
  it("inhale eases 0.82 → 1.24", () => {
    expect(breathScale("inhale", 0)).toBeCloseTo(0.82);
    expect(breathScale("inhale", 0.5)).toBeCloseTo(1.03);
    expect(breathScale("inhale", 1)).toBeCloseTo(1.24);
  });

  it("hold is constant 1.24; hold_after_exhale constant 0.82", () => {
    expect(breathScale("hold", 0.7)).toBeCloseTo(1.24);
    expect(breathScale("hold_after_exhale", 0.3)).toBeCloseTo(0.82);
  });

  it("exhale eases 1.24 → 0.82", () => {
    expect(breathScale("exhale", 0)).toBeCloseTo(1.24);
    expect(breathScale("exhale", 1)).toBeCloseTo(0.82);
  });

  it("prepare/countdown are 1.0; inactive is 0.88", () => {
    expect(breathScale("prepare", 0.5)).toBe(1.0);
    expect(breathScale("countdown", 0.5)).toBe(1.0);
    expect(breathScale("inhale", 0.5, false)).toBeCloseTo(0.88);
  });
});

describe("breathAmount", () => {
  it("matches the eased curve 0..1", () => {
    expect(breathAmount("inhale", 0)).toBe(0);
    expect(breathAmount("inhale", 1)).toBeCloseTo(1);
    expect(breathAmount("hold", 0.5)).toBe(1);
    expect(breathAmount("exhale", 1)).toBeCloseTo(0);
    expect(breathAmount("inhale", 0.5, false)).toBe(0);
  });
});

describe("breathGlow", () => {
  it("stays in 0.55..1 and follows the eased curve", async () => {
    const { breathGlow } = await import("../breathCurve");
    expect(breathGlow("inhale", 0)).toBeCloseTo(0.55);
    expect(breathGlow("inhale", 1)).toBeCloseTo(1);
    expect(breathGlow("exhale", 1)).toBeCloseTo(0.55);
    expect(breathGlow("hold", 0.5)).toBe(1);
    expect(breathGlow("inhale", 0.5, false)).toBe(0.55);
  });
});
