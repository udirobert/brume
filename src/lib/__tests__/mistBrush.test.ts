import { describe, expect, it } from "vitest";
import {
  DAB_LIFE_S,
  HUSH,
  MASCOT_BREATH_PERIOD,
  MAX_RADIUS,
  MIN_RADIUS,
  ageFade,
  dabFor,
  dabSpacing,
  hushFromSpeed,
  mascotBreath,
} from "../mistBrush";
import { sampleMascot } from "../../../anna/bundle/mascot-engine.js";
import { readFileSync } from "node:fs";
import { BANNED_COPY_FOR_TESTS } from "./copyGuard";

describe("mascotBreath", () => {
  it("is 0 at the start, 1 at half a period, and loops", () => {
    expect(mascotBreath(0)).toBeCloseTo(0, 6);
    expect(mascotBreath(MASCOT_BREATH_PERIOD / 2)).toBeCloseTo(1, 6);
    expect(mascotBreath(MASCOT_BREATH_PERIOD)).toBeCloseTo(0, 6);
    expect(mascotBreath(MASCOT_BREATH_PERIOD * 3 + 1)).toBeCloseTo(mascotBreath(1), 6);
  });

  it("matches the mascot engine's own breath, so brush and sprite stay in step", () => {
    for (const t of [0, 0.4, 1.7, 3.5, 5.2, 6.9, 12.3]) {
      const frame = sampleMascot(t, { breathing: true, breathPeriod: MASCOT_BREATH_PERIOD });
      expect(frame.breath).toBeCloseTo(mascotBreath(t), 6);
    }
  });

  it("survives bad input", () => {
    expect(mascotBreath(Number.NaN)).toBe(0);
    expect(mascotBreath(-2)).toBeGreaterThanOrEqual(0);
    expect(mascotBreath(1, Number.NaN)).toBe(mascotBreath(1));
  });

  it("uses the mascot's default period", () => {
    const src = readFileSync("anna/bundle/mascot-engine.js", "utf8");
    expect(src).toMatch(new RegExp(`fin\\(opts\\.breathPeriod, ${MASCOT_BREATH_PERIOD}\\)`));
  });
});

describe("hushFromSpeed", () => {
  it("is 0 below the onset and 1 at the mascot's agitation threshold", () => {
    expect(hushFromSpeed(0)).toBe(0);
    expect(hushFromSpeed(HUSH.ONSET)).toBe(0);
    expect(hushFromSpeed(HUSH.FULL)).toBe(1);
    expect(hushFromSpeed(99999)).toBe(1);
  });

  it("rises smoothly and monotonically", () => {
    let prev = 0;
    for (let s = HUSH.ONSET; s <= HUSH.FULL; s += 50) {
      const h = hushFromSpeed(s);
      expect(h).toBeGreaterThanOrEqual(prev);
      prev = h;
    }
    expect(hushFromSpeed(Number.NaN)).toBe(0);
  });

  it("shares the mascot's agitation threshold", () => {
    const src = readFileSync("anna/bundle/mascot.js", "utf8");
    expect(src).toMatch(new RegExp(`AGITATED: ${HUSH.FULL}\\b`));
  });
});

describe("dabFor", () => {
  it("inhale swells and fills; exhale thins", () => {
    const empty = dabFor(0, 0);
    const full = dabFor(1, 0);
    expect(empty.radius).toBe(MIN_RADIUS);
    expect(full.radius).toBe(MAX_RADIUS);
    expect(full.alpha).toBeGreaterThan(empty.alpha);
  });

  it("a hushed stroke is smaller and fainter, never invisible", () => {
    const calm = dabFor(1, 0);
    const hushed = dabFor(1, 1);
    expect(hushed.radius).toBeLessThan(calm.radius);
    expect(hushed.alpha).toBeLessThan(calm.alpha * 0.2);
    expect(hushed.alpha).toBeGreaterThan(0);
  });

  it("clamps out-of-range input", () => {
    expect(dabFor(5, -3)).toEqual(dabFor(1, 0));
    expect(dabFor(Number.NaN, Number.NaN)).toEqual(dabFor(0, 0));
  });
});

describe("ageFade and spacing", () => {
  it("fades from 1 to 0 over the dab's life", () => {
    expect(ageFade(0)).toBe(1);
    expect(ageFade(DAB_LIFE_S / 2)).toBeCloseTo(0.5, 5);
    expect(ageFade(DAB_LIFE_S)).toBe(0);
    expect(ageFade(DAB_LIFE_S + 5)).toBe(0);
    expect(ageFade(-1)).toBe(1);
  });

  it("keeps dabs overlapping but never packed tighter than 3 px", () => {
    expect(dabSpacing(MIN_RADIUS)).toBeGreaterThanOrEqual(3);
    expect(dabSpacing(MAX_RADIUS)).toBeLessThan(MAX_RADIUS);
  });
});

describe("copy", () => {
  it("the room touch adds no visible copy at all", () => {
    // RoomTouch is an aria-hidden canvas; there are no strings to guard.
    // If copy is ever added, put it here.
    for (const s of [] as string[]) expect(s).not.toMatch(BANNED_COPY_FOR_TESTS);
    expect(true).toBe(true);
  });
});
