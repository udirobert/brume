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
vi.mock("../../BreathingAnimation", () => ({ default: () => null }));
vi.mock("../EnhancedSessionLayout", () => ({
  EnhancedSessionLayout: (props: { controls?: React.ReactNode }) =>
    React.createElement("div", null, props.controls),
}));

import { ResponsiveEnhancedSession } from "../ResponsiveEnhancedSession";
import { useSessionStore } from "@/stores/sessionStore";

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

    expect(container.textContent).toContain("Spoken breath cues");
    expect(gum).not.toHaveBeenCalled();

    await act(async () => {
      byText(container, "Begin")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(state().phase).toBe("active");
    expect(gum).not.toHaveBeenCalled();
  });

  it("startImmediately consumes once into an active session", async () => {
    ({ container, root } = mount({}, { startImmediately: true }));
    await act(async () => {});
    expect(state().phase).toBe("active");
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
});
