/**
 * useSession — one manageTiming owner drives the clock; a second consumer
 * (like SessionControls) controls only. Pause freezes phase/progress;
 * resume continues from the same fraction; complete snapshots the floor.
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
import { useCameraStore } from "@/stores/cameraStore";
import { useVisionStore } from "@/stores/visionStore";
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
    enableCamera: false,
    enableAudio: true,
    enableAI: false,
  });

function fakeStream() {
  const stop = vi.fn();
  return {
    stream: { getTracks: () => [{ stop }] } as unknown as MediaStream,
    stop,
  };
}

describe("useSession manageTiming ownership", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    state().resetSession();
    useCameraStore.setState({
      stream: null,
      status: "idle",
      refCount: 0,
      hasPermission: false,
      error: null,
    });
    useVisionStore.setState({ isActive: false, config: null, metrics: null });
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
    await act(async () => { parentApi.start(false); });
    expect(state().phase).toBe("active");
    await act(async () => { vi.advanceTimersByTime(16000); });
    expect(state().metrics.cycleCount).toBe(1);
    expect(state().metrics.currentPhase).toBe("inhale");
    expect(state().metrics.duration).toBe(16);
  });

  it("pause freezes at exact fraction; resume continues it", async () => {
    vi.useFakeTimers();
    await act(async () => { await initBox(); parentApi.start(false); });
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
    await act(async () => { await initBox(); parentApi.start(false); });
    await act(async () => { vi.advanceTimersByTime(3750); });
    const startDate = state().metrics.startTime;
    await act(async () => { childApi.complete(); });
    expect(state().phase).toBe("complete");
    expect(state().metrics.duration).toBe(3); // floor(3.75)
    expect(state().metrics.startTime).toEqual(startDate);
  });

  it("vision store updates do NOT tear down the active owner (regression)", async () => {
    vi.useFakeTimers();
    const { stream } = fakeStream();
    const gum = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: gum, enumerateDevices: vi.fn().mockResolvedValue([]) },
      configurable: true,
    });

    await act(async () => { await initBox(); });
    await act(async () => { await parentApi.requestCamera(); });
    expect(state().cameraStream).toBe(stream);
    await act(async () => { parentApi.start(true); });
    expect(state().phase).toBe("active");

    // Simulate a vision state update — new zustand object identity.
    await act(async () => {
      useVisionStore.setState({ isActive: true, metrics: { presence: 1 } as never });
    });
    await act(async () => { vi.advanceTimersByTime(200); });

    expect(state().phase).toBe("active");
    expect(state().cameraStream).toBe(stream); // still owned
  });

  it("unmount during pending prompt: late stream released once, never adopted", async () => {
    const { stream, stop } = fakeStream();
    let resolveGum: (s: MediaStream) => void;
    const gum = vi.fn().mockReturnValue(
      new Promise<MediaStream>((r) => { resolveGum = r; }),
    );
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: gum, enumerateDevices: vi.fn().mockResolvedValue([]) },
      configurable: true,
    });

    await act(async () => { await initBox(); });
    const pending = parentApi.requestCamera();
    expect(gum).toHaveBeenCalledTimes(1);

    await act(async () => { root.unmount(); }); // owner gone mid-prompt
    root = createRoot(container); // keep cleanup symmetric for afterEach
    await act(async () => { resolveGum(stream); await pending; });

    expect(state().cameraStream).toBeNull();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(useVisionStore.getState().isActive).not.toBe(true);
  });

  it("camera-free start during pending prompt: late grant released, session stays camera-free", async () => {
    const { stream, stop } = fakeStream();
    let resolveGum: (s: MediaStream) => void;
    const gum = vi.fn().mockReturnValue(
      new Promise<MediaStream>((r) => { resolveGum = r; }),
    );
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: gum, enumerateDevices: vi.fn().mockResolvedValue([]) },
      configurable: true,
    });

    await act(async () => { await initBox(); });
    const pending = parentApi.requestCamera();
    await act(async () => { parentApi.start(false); }); // camera-free wins
    expect(state().phase).toBe("active");
    await act(async () => { resolveGum(stream); await pending; });

    expect(state().cameraStream).toBeNull();
    expect(state().metrics.cameraUsed).toBe(false);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("double Enable while in-flight shares one request", async () => {
    const { stream } = fakeStream();
    let resolveGum: (s: MediaStream) => void;
    const gum = vi.fn().mockReturnValue(
      new Promise<MediaStream>((r) => { resolveGum = r; }),
    );
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: gum, enumerateDevices: vi.fn().mockResolvedValue([]) },
      configurable: true,
    });

    await act(async () => { await initBox(); });
    const p1 = parentApi.requestCamera();
    const p2 = parentApi.requestCamera();
    await act(async () => { resolveGum(stream); });
    const [r1, r2] = await act(async () => Promise.all([p1, p2]));
    expect(gum).toHaveBeenCalledTimes(1);
    expect(r1).toBe(stream);
    expect(r2).toBe(stream);
    expect(state().cameraStream).toBe(stream);
  });

  it("controls consumer completing releases the owner's stream once", async () => {
    vi.useFakeTimers();
    const { stream, stop } = fakeStream();
    const gum = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: gum, enumerateDevices: vi.fn().mockResolvedValue([]) },
      configurable: true,
    });

    await act(async () => { await initBox(); });
    await act(async () => { await parentApi.requestCamera(); });
    await act(async () => { parentApi.start(true); });
    await act(async () => { vi.advanceTimersByTime(1000); });
    await act(async () => { childApi.complete(); });
    await act(async () => { vi.advanceTimersByTime(50); });

    expect(state().phase).toBe("complete");
    expect(state().cameraStream).toBeNull();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("initialize never requests camera or starts vision", async () => {
    const gum = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: gum },
      configurable: true,
    });
    const initSpy = vi.spyOn(useVisionStore.getState(), "initialize");
    const startSpy = vi.spyOn(useVisionStore.getState(), "start");
    await act(async () => {
      await parentApi.initialize({
        mode: "classic",
        pattern: box,
        enableCamera: true,
        enableAudio: true,
        enableAI: false,
      });
    });
    expect(gum).not.toHaveBeenCalled();
    expect(initSpy).not.toHaveBeenCalled();
    expect(startSpy).not.toHaveBeenCalled();
    expect(state().phase).toBe("setup");
  });

  it("invalid pattern stays in setup with an error, no dead-end active screen", async () => {
    await act(async () => {
      await parentApi.initialize({
        mode: "classic",
        pattern: { ...box, inhale: 0 },
        enableCamera: false,
        enableAudio: true,
        enableAI: false,
      });
    });
    await act(async () => { parentApi.start(false); });
    expect(state().phase).toBe("setup");
    expect(state().error).toBe("This breathing pattern is unavailable. Choose another rhythm.");
  });
});
