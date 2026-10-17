import { describe, expect, it } from "vitest";
import {
  createSessionClock,
  pauseSessionClock,
  readSessionElapsedMs,
  resumeSessionClock,
  sampleSessionTiming,
} from "../session-timing";

const box = { inhale: 4, hold: 4, exhale: 4, hold_after_exhale: 4 };

describe("active session timing", () => {
  it("does not count setup time", () => {
    expect(sampleSessionTiming(createSessionClock(), box, 100_000)).toEqual({
      duration: 0, cycleCount: 0, currentPhase: "inhale", phaseProgress: 0,
    });
  });

  it("retains fractional active time across a long pause", () => {
    const running = resumeSessionClock(createSessionClock(), 5000);
    const paused = pauseSessionClock(running, 8750);
    expect(readSessionElapsedMs(paused, 999_999)).toBe(3750);
    expect(sampleSessionTiming(paused, box, 999_999)).toEqual({
      duration: 3, cycleCount: 0, currentPhase: "inhale", phaseProgress: 93.75,
    });
    const resumed = resumeSessionClock(paused, 1_000_000);
    expect(sampleSessionTiming(resumed, box, 1_000_250)).toEqual({
      duration: 4, cycleCount: 0, currentPhase: "hold", phaseProgress: 0,
    });
  });

  it("makes repeated pauses and resumes idempotent", () => {
    const running = resumeSessionClock(createSessionClock(), 0);
    expect(resumeSessionClock(running, 100)).toBe(running);
    const paused = pauseSessionClock(running, 1250);
    expect(pauseSessionClock(paused, 10_000)).toEqual(paused);
    const resumed = resumeSessionClock(paused, 20_000);
    expect(readSessionElapsedMs(resumed, 20_750)).toBe(2000);
    expect(readSessionElapsedMs(paused, 30_000)).toBe(1250);
  });

  it.each([
    [4000, "hold", 0, 0],
    [8000, "exhale", 0, 0],
    [12_000, "pause", 0, 0],
    [16_000, "inhale", 0, 1],
    [41_000, "exhale", 25, 2],
  ] as const)("samples %ims without losing delayed phases", (now, phase, progress, cycles) => {
    const clock = resumeSessionClock(createSessionClock(), 0);
    expect(sampleSessionTiming(clock, box, now)).toEqual({
      duration: Math.floor(now / 1000),
      cycleCount: cycles,
      currentPhase: phase,
      phaseProgress: progress,
    });
  });

  it("omits zero-length holds rather than creating phantom cycles", () => {
    const pattern = { inhale: 5, hold: 0, exhale: 5, hold_after_exhale: 0 };
    const clock = resumeSessionClock(createSessionClock(), 100);
    expect(sampleSessionTiming(clock, pattern, 5600)).toEqual({
      duration: 5, cycleCount: 0, currentPhase: "exhale", phaseProgress: 10,
    });
    expect(sampleSessionTiming(clock, pattern, 10_100)).toEqual({
      duration: 10, cycleCount: 1, currentPhase: "inhale", phaseProgress: 0,
    });
  });

  it("does not round up partial seconds or count an unfinished cycle", () => {
    const clock = resumeSessionClock(createSessionClock(), 0);
    expect(sampleSessionTiming(clock, box, 7999).duration).toBe(7);
    expect(sampleSessionTiming(clock, box, 15_999).cycleCount).toBe(0);
  });

  it.each([0, -1, NaN, Infinity])("rejects invalid inhale duration %s", (inhale) => {
    expect(() => sampleSessionTiming(createSessionClock(), { ...box, inhale }, 0))
      .toThrow(RangeError);
  });

  it("rejects invalid holds and clock timestamps", () => {
    expect(() => sampleSessionTiming(createSessionClock(), { ...box, hold: -1 }, 0))
      .toThrow(RangeError);
    expect(() => resumeSessionClock(createSessionClock(), NaN)).toThrow(RangeError);
    expect(() => readSessionElapsedMs(createSessionClock(), Infinity)).toThrow(RangeError);
  });
});
