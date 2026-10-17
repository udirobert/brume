/**
 * sessionStore monotonic-clock lifecycle tests.
 * performance.now is controlled independently of Date.now — paused wall
 * time must never enter duration/rhythm/cycles.
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/errors/error-reporter", () => ({
  errorReporter: { updateSessionId: vi.fn() },
}));
vi.mock("@/lib/notifications/oneSignal", () => ({
  trackSessionCompleted: vi.fn(),
}));

import { useSessionStore } from "../sessionStore";
import { trackSessionCompleted } from "@/lib/notifications/oneSignal";
import { BREATHING_PATTERNS } from "@/lib/breathingPatterns";

let nowMs = 0;
const boxConfig = () => ({
  mode: "classic" as const,
  pattern: BREATHING_PATTERNS.box, // 4/4/4/4
  enableCamera: false,
  enableAudio: true,
  enableAI: false,
});

function setNow(v: number) {
  nowMs = v;
  vi.spyOn(performance, "now").mockImplementation(() => nowMs);
}

const state = () => useSessionStore.getState();

describe("sessionStore monotonic timing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    state().resetSession();
    setNow(0);
  });

  afterEach(() => vi.restoreAllMocks());

  it("setup waits indefinitely with duration 0 and no wall-clock start", () => {
    state().initializeSession(boxConfig());
    setNow(100000);
    state().tickSession();
    expect(state().metrics.duration).toBe(0);
    expect(state().metrics.startTime).toBeUndefined();
  });

  it("paused wall time is excluded; resume preserves phase fraction", () => {
    const wallStart = Date.now();
    state().initializeSession(boxConfig());
    setNow(100000);
    state().startSession();
    expect(state().phase).toBe("active");

    setNow(103750); // 3.75s active: 93.75% through 4s inhale
    state().tickSession();
    expect(state().metrics.duration).toBe(3);
    expect(state().metrics.currentPhase).toBe("inhale");
    expect(state().metrics.phaseProgress).toBeCloseTo(93.75, 1);

    state().pauseSession();
    expect(state().phase).toBe("paused");
    const pausedMetrics = { ...state().metrics };

    setNow(500000); // long wall pause
    state().tickSession();
    expect(state().metrics.duration).toBe(pausedMetrics.duration);
    expect(state().metrics.currentPhase).toBe(pausedMetrics.currentPhase);
    expect(state().metrics.phaseProgress).toBe(pausedMetrics.phaseProgress);

    const originalStart = state().metrics.startTime;
    state().resumeSession();
    setNow(500250);
    state().tickSession();
    expect(state().metrics.duration).toBe(4); // 3.75 + 0.25 = 4.0
    expect(state().metrics.currentPhase).toBe("hold"); // crossed 4s boundary
    expect(state().metrics.cycleCount).toBe(0);
    expect(state().metrics.startTime).toEqual(originalStart);
    expect(Date.now() - wallStart).toBeLessThan(5000); // wall clock never drove it

    // Another pause/resume preserves the fraction
    state().pauseSession();
    const p2 = state().metrics.phaseProgress;
    state().resumeSession();
    setNow(500350);
    state().tickSession();
    expect(state().metrics.phaseProgress ?? 0).toBeGreaterThan(p2 ?? 0);
    expect(state().metrics.currentPhase).toBe("hold");
  });

  it("Box 4/4/4/4 hits exhale at 8s, pause at 12s, cycle 1 at 16s", () => {
    state().initializeSession(boxConfig());
    setNow(0);
    state().startSession();
    setNow(8000);
    state().tickSession();
    expect(state().metrics.currentPhase).toBe("exhale");
    setNow(12000);
    state().tickSession();
    expect(state().metrics.currentPhase).toBe("pause");
    setNow(16000);
    state().tickSession();
    expect(state().metrics.cycleCount).toBe(1);
    expect(state().metrics.currentPhase).toBe("inhale");
  });

  it("non-box pattern without holds works (5/0/5/0)", () => {
    state().initializeSession({
      ...boxConfig(),
      pattern: { ...BREATHING_PATTERNS.box, id: "flat55", inhale: 5, hold: 0, exhale: 5, hold_after_exhale: 0 },
    });
    setNow(0);
    state().startSession();
    setNow(5000);
    state().tickSession();
    expect(state().metrics.currentPhase).toBe("exhale");
    setNow(10000);
    state().tickSession();
    expect(state().metrics.cycleCount).toBe(1);
  });

  it("invalid pattern does not start and reports the unavailable message", () => {
    state().initializeSession({
      ...boxConfig(),
      pattern: { ...BREATHING_PATTERNS.box, inhale: 0 },
    });
    state().startSession();
    expect(state().phase).not.toBe("active");
    expect(state().error).toBe("This breathing pattern is unavailable. Choose another rhythm.");
  });

  it("completion freezes the snapshot; repeats are no-ops; reset clears clock", () => {
    state().initializeSession(boxConfig());
    setNow(0);
    state().startSession();
    setNow(2500);
    state().completeSession();
    expect(state().phase).toBe("complete");
    expect(state().metrics.duration).toBe(2);
    setNow(99999);
    state().tickSession();
    expect(state().metrics.duration).toBe(2);
    state().completeSession();
    expect(vi.mocked(trackSessionCompleted)).toHaveBeenCalledTimes(1);
    state().resetSession();
    expect(state().clock).toEqual({ elapsedMs: 0, runningSince: null });
  });

  it("immediate stop after zero active time reports duration 0", () => {
    state().initializeSession(boxConfig());
    setNow(42);
    state().startSession();
    state().completeSession();
    expect(state().metrics.duration).toBe(0);
  });

  it("startSession is idempotent while active", () => {
    state().initializeSession(boxConfig());
    setNow(0);
    state().startSession();
    setNow(5000);
    state().startSession(); // no-op — no second clock
    state().tickSession();
    expect(state().metrics.duration).toBe(5);
  });
});
