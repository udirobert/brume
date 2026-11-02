/**
 * useSession — one manageTiming owner drives the clock; a second consumer
 * (like SessionControls) controls only. Pause freezes phase/progress;
 * resume continues from the same fraction; complete snapshots the floor.
 * No camera, no vision — the session is pattern + clock only.
 * Fake timers control both the interval and performance.now.
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

vi.mock("@/lib/errors/error-reporter", () => ({
  errorReporter: { updateSessionId: vi.fn() },
}));
vi.mock("@/lib/notifications/oneSignal", () => ({
  trackSessionCompleted: vi.fn(),
}));

import { useSession } from "../useSession";
import { useSessionStore } from "@/stores/sessionStore";
import { BREATHING_PATTERNS } from "@/lib/breathingPatterns";

const box = BREATHING_PATTERNS.box; // real 4/4/4/4

let parentApi: ReturnType<typeof useSession>;
let childApi: ReturnType<typeof useSession>;

function Owner() {
  parentApi = useSession({ manageTiming: true });
  return null;
}
function Consumer() {
  childApi = useSession();
  return null;
}

const state = () => useSessionStore.getState();
const initBox = () =>
  parentApi.initialize({
    mode: "classic",
    pattern: box,
    enableAudio: true,
    enableAI: false,
  });

describe("useSession manageTiming ownership", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    state().resetSession();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(React.Fragment, null,
          React.createElement(Owner),
          React.createElement(Consumer),
        ),
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("one Box cycle at 16s (single interval, no duplicate controllers)", async () => {
    vi.useFakeTimers();
    await act(async () => { await initBox(); });
    await act(async () => { parentApi.start(); });
    expect(state().phase).toBe("active");
    await act(async () => { vi.advanceTimersByTime(16000); });
    expect(state().metrics.cycleCount).toBe(1);
    expect(state().metrics.currentPhase).toBe("inhale");
    expect(state().metrics.duration).toBe(16);
  });

  it("pause freezes at exact fraction; resume continues it", async () => {
    vi.useFakeTimers();
    await act(async () => { await initBox(); parentApi.start(); });
    await act(async () => { vi.advanceTimersByTime(3750); });
    await act(async () => { childApi.pause(); });
    expect(state().phase).toBe("paused");
    const frozen = { ...state().metrics };
    expect(frozen.duration).toBe(3);
    expect(frozen.currentPhase).toBe("inhale");
    expect(frozen.phaseProgress).toBeCloseTo(93.75, 1);

    await act(async () => { vi.advanceTimersByTime(60000); }); // long wall pause
    expect(state().metrics.duration).toBe(3);
    expect(state().metrics.phaseProgress).toBe(frozen.phaseProgress);

    await act(async () => { childApi.resume(); });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(state().metrics.duration).toBe(4);
    expect(state().metrics.currentPhase).toBe("hold");
    expect(state().metrics.phaseProgress ?? 0).toBeLessThan(5);
  });

  it("complete snapshots the floor between ticks", async () => {
    vi.useFakeTimers();
    await act(async () => { await initBox(); parentApi.start(); });
    await act(async () => { vi.advanceTimersByTime(3750); });
    const startDate = state().metrics.startTime;
    await act(async () => { childApi.complete(); });
    expect(state().phase).toBe("complete");
    expect(state().metrics.duration).toBe(3); // floor(3.75)
    expect(state().metrics.startTime).toEqual(startDate);
  });

  it("initialize leaves the session in setup, waiting for the preview", async () => {
    await act(async () => { await initBox(); });
    expect(state().phase).toBe("setup");
  });

  it("invalid pattern stays in setup with an error, no dead-end active screen", async () => {
    await act(async () => {
      await parentApi.initialize({
        mode: "classic",
        pattern: { ...box, inhale: 0 },
        enableAudio: true,
        enableAI: false,
      });
    });
    await act(async () => { parentApi.start(); });
    expect(state().phase).toBe("setup");
    expect(state().error).toBe("This breathing pattern is unavailable. Choose another rhythm.");
  });
});
