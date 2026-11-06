/**
 * ResponsiveEnhancedSession — real mount integration:
 * flat pattern normalization (id + real holds), one interval owner,
 * and a Begin that starts the session with no camera anywhere.
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
// The voice engine is observed, not exercised, here: the tests pin WHEN
// the component speaks (phase edges only), never the audio plumbing.
vi.mock("@/lib/voiceCues", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/voiceCues")>();
  return {
    ...actual,
    speakCue: vi.fn(),
    speakLine: vi.fn(),
    stopCues: vi.fn(),
    preloadCues: vi.fn(),
    setVoiceEnabled: vi.fn(),
    setCueStyle: vi.fn(),
    previewCue: vi.fn(),
  };
});
vi.mock("../../BreathingAnimation", () => ({ default: () => null }));
vi.mock("../EnhancedSessionLayout", () => ({
  EnhancedSessionLayout: (props: { controls?: React.ReactNode }) =>
    React.createElement("div", null, props.controls),
}));

import { ResponsiveEnhancedSession } from "../ResponsiveEnhancedSession";
import { useSessionStore } from "@/stores/sessionStore";
import { speakCue, stopCues } from "@/lib/voiceCues";

const state = () => useSessionStore.getState();
const nestedBox = {
  id: "box",
  name: "Box",
  phases: { inhale: 4, hold: 4, exhale: 4, pause: 4 },
  benefits: ["test"],
  description: "box",
};

function mount(
  config: Record<string, unknown> = {},
  routeState: Record<string, unknown> | null = null,
  props: Record<string, unknown> = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      React.createElement(
        MemoryRouter,
        {
          initialEntries: [
            { pathname: "/session", state: routeState ?? undefined },
          ],
        },
        React.createElement(ResponsiveEnhancedSession, {
          config: { pattern: nestedBox, mode: "enhanced", ...config },
          onSessionComplete: vi.fn(),
          onSessionExit: vi.fn(),
          ...props,
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

  beforeEach(() => {
    state().resetSession();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("mount initializes flat pattern with real id/phases and no media requests", async () => {
    const gum = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: gum, enumerateDevices: vi.fn().mockResolvedValue([]) },
      configurable: true,
    });

    ({ container, root } = mount());
    await act(async () => {});
    expect(state().config?.pattern.id).toBe("box");
    expect(state().config?.pattern.inhale).toBe(4);
    expect(state().config?.pattern.hold).toBe(4);
    expect(state().config?.pattern.exhale).toBe(4);
    expect(state().config?.pattern.hold_after_exhale).toBe(4);
    expect(gum).not.toHaveBeenCalled();
    expect(container.textContent).not.toMatch(/camera/i);

    expect(container.textContent).toContain("Breath cues");
    expect(gum).not.toHaveBeenCalled();

    await act(async () => {
      byText(container, "Begin")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(state().phase).toBe("active");
    expect(gum).not.toHaveBeenCalled();
  });

describe("voice cue edges", () => {
  // One cue per phase edge — a repeated "breathe out" was the report.
  // Fake timers advance performance.now, which the phase math reads;
  // the 100ms tick interval rides the same clock.
  const cueCalls = () => vi.mocked(speakCue).mock.calls.map((c) => c[0]);

  it("speaks a phase edge once and stays silent under config churn", async () => {
    vi.useFakeTimers();
    ({ container, root } = mount({}, { startImmediately: true }));
    await act(async () => {});
    expect(state().phase).toBe("active");
    vi.mocked(speakCue).mockClear();

    // inhale (4s) → hold: exactly one cue at the edge
    act(() => { vi.advanceTimersByTime(4_300); });
    await act(async () => {});
    expect(state().metrics.currentPhase).toBe("hold");
    expect(cueCalls().filter((id) => id === "hold")).toHaveLength(1);
    const countAtHold = cueCalls().length;

    // Mid-phase identity churn — a fresh but identical config object,
    // what the wrapper rebuilt on every render before it was memoized:
    // the effect re-runs, the edge ref refuses to speak again.
    act(() => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: [{ pathname: "/session", state: { startImmediately: true } }] },
          React.createElement(ResponsiveEnhancedSession, {
            config: {
              pattern: { ...nestedBox, phases: { ...nestedBox.phases } },
              mode: "enhanced",
            },
            onSessionComplete: vi.fn(),
            onSessionExit: vi.fn(),
          }),
        ),
      );
    });
    await act(async () => {});
    expect(state().metrics.currentPhase).toBe("hold");
    expect(cueCalls().length).toBe(countAtHold);
  });

  it("a resume re-orients with exactly one cue for the current phase", async () => {
    vi.useFakeTimers();
    ({ container, root } = mount({}, { startImmediately: true }));
    await act(async () => {});
    act(() => { vi.advanceTimersByTime(4_300); });
    await act(async () => {});
    expect(state().metrics.currentPhase).toBe("hold");

    act(() => { state().pauseSession(); });
    await act(async () => {});
    expect(vi.mocked(stopCues)).toHaveBeenCalled();

    vi.mocked(speakCue).mockClear();
    act(() => { state().resumeSession(); });
    await act(async () => {});
    expect(cueCalls()).toEqual(["hold"]);
  });
});

  it("startImmediately consumes once into an active session", async () => {
    ({ container, root } = mount({}, { startImmediately: true }));
    await act(async () => {});
    expect(state().phase).toBe("active");
  });

  it("startImmediately revives a leftover paused session into a fresh active one", async () => {
    // Someone left mid-breath earlier: the store still holds their
    // paused session. A new Begin must never land them back in that
    // paused limbo demanding a second play press.
    act(() => {
      state().initializeSession({
        mode: "enhanced",
        pattern: {
          id: "box",
          name: "Box",
          description: "",
          benefits: [],
          inhale: 4,
          hold: 4,
          exhale: 4,
          hold_after_exhale: 4,
        },
        enableAudio: false,
        enableAI: false,
      });
      state().startSession();
      state().pauseSession();
    });
    expect(state().phase).toBe("paused");

    ({ container, root } = mount({}, { startImmediately: true }));
    await act(async () => {});
    expect(state().phase).toBe("active");
    expect(state().metrics.cycleCount).toBe(0);
  });

  it("a ready-phase entry waits at the preview, not a dead session screen", async () => {
    act(() => {
      state().initializeSession({
        mode: "enhanced",
        pattern: {
          id: "box",
          name: "Box",
          description: "",
          benefits: [],
          inhale: 4,
          hold: 4,
          exhale: 4,
          hold_after_exhale: 4,
        },
        enableAudio: false,
        enableAI: false,
      });
      state().setSessionReady();
    });
    expect(state().phase).toBe("ready");
    ({ container, root } = mount({}));
    await act(async () => {});
    expect(container.textContent).toContain("Begin");
  });

  it("an unflagged entry waits for Begin and a word pick alone does not start", async () => {
    ({ container, root } = mount({}, { checkInIndex: 2 }));
    await act(async () => {});
    expect(state().phase).not.toBe("active");
  });

  it("a consumed flag does not auto-start on revisit", async () => {
    ({ container, root } = mount({}, { startImmediately: false }));
    await act(async () => {});
    expect(state().phase).not.toBe("active");
    expect(container.textContent).toContain("Begin");
  });

  it("offers a soft landing past the anchor, then lets itself down", async () => {
    const onSessionComplete = vi.fn();
    ({ container, root } = mount(
      {},
      { startImmediately: true },
      { onSessionComplete },
    ));
    await act(async () => {});
    expect(state().phase).toBe("active");

    // Fake the clock before the landing is offered so its let-down
    // timer is ours to advance.
    vi.useFakeTimers();

    // Past the anchor, at the next inhale boundary.
    act(() => {
      useSessionStore.setState((s) => ({
        metrics: {
          ...s.metrics,
          duration: 95,
          currentPhase: "inhale",
          phaseProgress: 2,
        },
      }));
    });
    await act(async () => {});
    expect(state().phase).toBe("paused");

    await act(async () => {
      vi.advanceTimersByTime(11_000);
    });

    expect(onSessionComplete).toHaveBeenCalledTimes(1);
    expect(state().phase).toBe("complete");
  });

  it("a resume during the landing picks the breath back up and never re-offers", async () => {
    const onSessionComplete = vi.fn();
    ({ container, root } = mount(
      {},
      { startImmediately: true },
      { onSessionComplete },
    ));
    await act(async () => {});

    act(() => {
      useSessionStore.setState((s) => ({
        metrics: {
          ...s.metrics,
          duration: 95,
          currentPhase: "inhale",
          phaseProgress: 2,
        },
      }));
    });
    await act(async () => {});
    expect(state().phase).toBe("paused");

    act(() => {
      state().resumeSession();
    });
    await act(async () => {});
    expect(state().phase).toBe("active");

    vi.useFakeTimers();
    await act(async () => {
      vi.advanceTimersByTime(11_000);
    });
    vi.useRealTimers();
    expect(onSessionComplete).not.toHaveBeenCalled();

    // Still active past the anchor — the offer was spent.
    act(() => {
      useSessionStore.setState((s) => ({
        metrics: {
          ...s.metrics,
          duration: 120,
          currentPhase: "inhale",
          phaseProgress: 2,
        },
      }));
    });
    await act(async () => {});
    expect(state().phase).toBe("active");
  });
});
