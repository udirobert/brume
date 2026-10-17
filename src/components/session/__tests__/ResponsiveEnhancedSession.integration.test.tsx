/**
 * ResponsiveEnhancedSession — real mount integration:
 * camera opt-in on mount, flat pattern normalization (id + real holds),
 * one interval owner, vision updates don't teardown, camera-free start
 * while gUM pending never adopts the late stream.
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/errors/error-reporter", () => ({
  errorReporter: { updateSessionId: vi.fn() },
}));
vi.mock("@/lib/notifications/oneSignal", () => ({
  trackSessionCompleted: vi.fn(),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/useStableMetrics", () => ({
  useStableMetrics: () => ({
    stillnessScore: 0,
    presenceScore: 0,
    confidence: 0,
    hasValidData: false,
  }),
}));

let visionAcceptedStream: MediaStream | null = null;
vi.mock("../VisionManager", () => ({
  VisionManager: (props: { cameraStream: MediaStream | null }) => {
    visionAcceptedStream = props.cameraStream;
    return null;
  },
}));
vi.mock("../../VideoFeed", () => ({ default: () => null }));
vi.mock("../../BreathingAnimation", () => ({ default: () => null }));
vi.mock("../EnhancedSessionLayout", () => ({
  EnhancedSessionLayout: (props: { controls?: React.ReactNode }) =>
    React.createElement("div", null, props.controls),
}));

import { ResponsiveEnhancedSession } from "../ResponsiveEnhancedSession";
import { useSessionStore } from "@/stores/sessionStore";
import { useCameraStore } from "@/stores/cameraStore";
import { useVisionStore } from "@/stores/visionStore";

const state = () => useSessionStore.getState();
const nestedBox = {
  id: "box",
  name: "Box",
  phases: { inhale: 4, hold: 4, exhale: 4, pause: 4 },
  benefits: ["test"],
  description: "box",
};

function mount(config: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ResponsiveEnhancedSession, {
          config: { pattern: nestedBox, mode: "enhanced", ...config },
          modeConfig: { enableCamera: true, enableVision: true },
          onSessionComplete: vi.fn(),
          onSessionExit: vi.fn(),
        }),
      ),
    );
  });
  return { container, root };
}

const byText = (c: HTMLElement, t: string) =>
  [...c.querySelectorAll("button")].find((b) => b.textContent.trim() === t);

describe("ResponsiveEnhancedSession integration", () => {
  let container: HTMLDivElement;
  let root: Root;
  let gum: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    state().resetSession();
    useCameraStore.setState({
      stream: null, status: "idle", refCount: 0,
      hasPermission: false, error: null,
    });
    useVisionStore.setState({ isActive: false, config: null, metrics: null });
    visionAcceptedStream = null;
    gum = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: gum, enumerateDevices: vi.fn().mockResolvedValue([]) },
      configurable: true,
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("mount initializes flat pattern with real id/phases; zero camera requests", async () => {
    ({ container, root } = mount());
    await act(async () => {});
    expect(state().config?.pattern.id).toBe("box");
    expect(state().config?.pattern.inhale).toBe(4);
    expect(state().config?.pattern.hold).toBe(4);
    expect(state().config?.pattern.exhale).toBe(4);
    expect(state().config?.pattern.hold_after_exhale).toBe(4);
    expect(gum).not.toHaveBeenCalled();

    await act(async () => {
      byText(container, "Try hands-free preview")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(gum).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Simulation");

    await act(async () => {
      byText(container, "Breathe without camera")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(state().phase).toBe("active");
    expect(gum).not.toHaveBeenCalled();
    expect(visionAcceptedStream).toBeNull();
  });

  it("explicit Enable camera acquires once; vision updates do not teardown", async () => {
    const stop = vi.fn();
    const fake = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    gum.mockResolvedValue(fake);
    ({ container, root } = mount());
    await act(async () => {});

    await act(async () => {
      byText(container, "Enable camera")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await Promise.resolve();
    });
    expect(gum).toHaveBeenCalledTimes(1);
    expect(state().cameraStream).toBe(fake);

    await act(async () => {
      byText(container, "Begin")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(state().phase).toBe("active");
    expect(state().metrics.cameraUsed).toBe(true);
    expect(visionAcceptedStream).toBe(fake);

    // Vision updates must not pause the session or release the camera.
    await act(async () => {
      useVisionStore.setState({
        isActive: true,
        config: { sessionId: state().sessionId } as never,
        metrics: { presence: 1 } as never,
      });
      useVisionStore.setState({ metrics: { presence: 0.5 } as never });
    });
    expect(state().phase).toBe("active");
    expect(state().cameraStream).toBe(fake);
  });

  it("denied camera request still allows camera-free start", async () => {
    gum.mockRejectedValue(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    ({ container, root } = mount());
    await act(async () => {});
    await act(async () => {
      byText(container, "Enable camera")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await Promise.resolve();
    });
    expect(state().cameraStream).toBeNull();
    await act(async () => {
      byText(container, "Breathe without camera")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(state().phase).toBe("active");
    expect(state().metrics.cameraUsed).toBe(false);
  });

  it("enableCamera=false feature forwards camera-free start even with a pre-existing global stream", async () => {
    const { container: c2, root: r2 } = (() => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      act(() => {
        root.render(
          React.createElement(
            MemoryRouter,
            null,
            React.createElement(ResponsiveEnhancedSession, {
              config: { pattern: nestedBox, mode: "enhanced" },
              modeConfig: { enableCamera: false, enableVision: false },
              onSessionComplete: vi.fn(),
              onSessionExit: vi.fn(),
            }),
          ),
        );
      });
      return { container, root };
    })();
    container = c2; root = r2;
    await act(async () => {});
    // A global stream that exists for unrelated reasons must not enable camera.
    const stray = { getTracks: () => [] } as unknown as MediaStream;
    useCameraStore.setState({ stream: stray, status: "active", refCount: 1 });
    expect(byText(container, "Enable camera")).toBeUndefined();
    await act(async () => {
      byText(container, "Breathe without camera")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(state().phase).toBe("active");
    expect(state().metrics.cameraUsed).toBe(false);
  });
});
