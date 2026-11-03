// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  CompanionAnchor,
  JourneyCompanionProvider,
} from "../JourneyCompanion";
import { BrumeMascot } from "@/components/BrumeMascot";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const animateCalls: { target: number; duration?: number }[] = [];
vi.mock("framer-motion", async (importOriginal) => {
  const mod = await importOriginal<typeof import("framer-motion")>();
  return {
    ...mod,
    animate: vi.fn(
      (_mv: unknown, target: number, opts?: { duration?: number }) => {
        animateCalls.push({ target, duration: opts?.duration });
        return { stop: () => {} };
      },
    ),
  };
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
});

const svgNode = () =>
  container.querySelector("[data-journey-companion] .brume-mascot svg");



describe("JourneyCompanionProvider", () => {
  it("renders one persistent engine shared by anchors", async () => {
    await act(async () => {
      root.render(
        <JourneyCompanionProvider>
          <CompanionAnchor state="idle" size={132} />
        </JourneyCompanionProvider>,
      );
    });
    expect(container.querySelectorAll("[data-journey-companion]")).toHaveLength(1);
    const first = svgNode();
    expect(first).not.toBeNull();

    await act(async () => {
      root.render(
        <JourneyCompanionProvider>
          <CompanionAnchor state="watching" size={132} />
          <CompanionAnchor state="tender" size={96} />
        </JourneyCompanionProvider>,
      );
    });
    expect(svgNode()).toBe(first);
    expect(container.querySelectorAll("[data-journey-companion] svg")).toHaveLength(1);
  });

  it("newest mounted anchor wins without reordering the registry", async () => {
    await act(async () => {
      root.render(
        <JourneyCompanionProvider>
          <CompanionAnchor state="idle" size={132} />
          <CompanionAnchor state="bright" size={96} />
        </JourneyCompanionProvider>,
      );
    });
    const host = container.querySelector<HTMLElement>(
      "[data-journey-companion] .brume-mascot",
    )!;
    expect(host.dataset.state).toBe("bright");
    await act(async () => {
      root.render(
        <JourneyCompanionProvider>
          <CompanionAnchor state="idle" size={132} />
        </JourneyCompanionProvider>,
      );
    });
    expect(
      container.querySelector<HTMLElement>("[data-journey-companion] .brume-mascot")!
        .dataset.state,
    ).toBe("idle");
  });

  it("toggling interactive off/on keeps the same SVG", async () => {
    await act(async () => {
      root.render(
        <JourneyCompanionProvider>
          <CompanionAnchor state="idle" size={132} tapReaction="ready" />
        </JourneyCompanionProvider>,
      );
    });
    const first = svgNode();
    await act(async () => {
      root.render(
        <JourneyCompanionProvider>
          <CompanionAnchor state="idle" size={132} />
        </JourneyCompanionProvider>,
      );
    });
    expect(
      container.querySelector("[data-journey-companion] .brume-mascot-frame__tap"),
    ).toBeNull();
    await act(async () => {
      root.render(
        <JourneyCompanionProvider>
          <CompanionAnchor state="idle" size={132} tapReaction="settle" />
        </JourneyCompanionProvider>,
      );
    });
    expect(svgNode()).toBe(first);
    const tap = container.querySelector("[data-journey-companion] .brume-mascot-frame__tap")!;
    act(() => {
      tap.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  });

  it("hides the wrapper when the last anchor leaves, after the grace window", async () => {
    vi.useFakeTimers();
    try {
      await act(async () => {
        root.render(
          <JourneyCompanionProvider>
            <CompanionAnchor state="idle" size={132} />
          </JourneyCompanionProvider>,
        );
      });
      const wrap = container.querySelector<HTMLElement>("[data-journey-companion]")!;
      expect(wrap.getAttribute("aria-hidden")).toBe("false");
      await act(async () => {
        root.render(<JourneyCompanionProvider>{null}</JourneyCompanionProvider>);
      });
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(wrap.getAttribute("aria-hidden")).toBe("true");
      expect(svgNode()).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("anchor switch requests an animated glide, not an eager snap", async () => {
    animateCalls.length = 0;
    await act(async () => {
      root.render(
        <JourneyCompanionProvider>
          <CompanionAnchor state="idle" size={132} />
        </JourneyCompanionProvider>,
      );
    });
    const callsAtMount = animateCalls.length;
    const wrap = container.querySelector<HTMLElement>("[data-journey-companion]")!;
    const before = wrap.style.transform;
    void before;

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.hasAttribute("data-companion-anchor")) {
          return { left: 300, top: 200, width: 176, height: 176 } as DOMRect;
        }
        return { left: 0, top: 0, width: 0, height: 0 } as DOMRect;
      },
    );

    await act(async () => {
      root.render(
        <JourneyCompanionProvider>
          <CompanionAnchor state="idle" size={132} />
          <CompanionAnchor state="watching" size={176} />
        </JourneyCompanionProvider>,
      );
    });
    const newCalls = animateCalls.slice(callsAtMount);
    expect(newCalls.some((c) => c.duration === 0.5 && c.target === 300)).toBe(true);
  });

  it("falls back to a local mascot without a provider", async () => {
    await act(async () => {
      root.render(<CompanionAnchor state="watching" size={64} />);
    });
    const host = container.querySelector<HTMLElement>(".brume-mascot")!;
    expect(host.dataset.state).toBe("watching");
    expect(container.querySelector("[data-journey-companion]")).toBeNull();
  });
});
