// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/components/BrumeMascot", () => ({
  BrumeMascot: () => <span data-mock-mascot />,
}));

import RoomPlay from "@/components/roomplay/RoomPlay";

let container: HTMLDivElement;
let root: Root;

const walkBtn = () =>
  container.querySelector<HTMLButtonElement>(".rp-actions .brume-btn--push")!;
const btn = (t: string) =>
  [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim().replace(/\s+/g, " ") === t,
  );
const clickEl = (el: Element) =>
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
// Effects reschedule the next frame timer only when act flushes, so
// playback is walked in short chunks — each act lets React queue the
// following tick before the clock moves again.
const settlePlayback = () => {
  for (let i = 0; i < 40; i++) {
    act(() => {
      vi.advanceTimersByTime(600);
    });
  }
};
const chips = (status?: string) =>
  [...container.querySelectorAll(".rp-chip")].filter(
    (c) => !status || c.classList.contains(`rp-chip--${status}`),
  );

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const mount = async () => {
  await act(async () => {
    root.render(<RoomPlay room="firefly" />);
  });
};

const statusText = () => container.querySelector(".rp-status")!.textContent!;

describe("Firefly wind-up", () => {
  it("default path bumps the stone: one played, one blocked, two pending", async () => {
    await mount();
    expect(statusText()).toBe("");

    clickEl(btn("Walk it")!);
    settlePlayback();

    expect(statusText()).toContain("Oh. A stone.");
    expect(chips("played")).toHaveLength(1);
    expect(chips("blocked")).toHaveLength(1);
    expect(chips("pending")).toHaveLength(1); // the two unused steps group
    expect(chips("pending")[0].textContent).toContain("×2");
  });

  it("Try another path clears the board, empties the path, focuses Step", async () => {
    await mount();
    clickEl(btn("Walk it")!);
    settlePlayback();
    clickEl(btn("Try another path")!);
    act(() => {
      vi.advanceTimersByTime(50); // let the focus RAF land
    });

    expect(statusText()).toBe("");
    expect(container.querySelectorAll(".rp-chip")).toHaveLength(0);
    expect(container.textContent).toContain("Tap a move.");
    expect(btn("Walk it")!.disabled).toBe(true);
    expect(document.activeElement?.textContent).toContain("Step");
  });

  it("undo removes one queued move; cap disables verbs at 16", async () => {
    await mount();
    clickEl(btn("↶ Left")!); // seeded path becomes step,step,step,step,left
    clickEl(btn("Undo")!); // removes the left
    expect(container.querySelectorAll(".rp-chip")).toHaveLength(1);
    expect(container.querySelector(".rp-chip")!.textContent).toContain("×4");

    for (let i = 0; i < 20; i++) clickEl(btn("↑ Step")!);
    expect(statusText()).toContain("Sixteen moves is a full wind.");
    expect(btn("↑ Step")!.disabled).toBe(true);
    expect(btn("↶ Left")!.disabled).toBe(true);

    clickEl(btn("Undo")!);
    expect(btn("↑ Step")!.disabled).toBe(false);
  });

  it("marks chips progressively and locks controls until the beat lands", async () => {
    await mount();
    clickEl(btn("Walk it")!);

    // At the moment of winding, nothing is marked yet — the run
    // hasn't simulated, and edits lock immediately.
    expect(chips("played")).toHaveLength(0);
    expect(chips("blocked")).toHaveLength(0);
    expect(walkBtn().disabled).toBe(true);

    // One frame in: the first move is marked, the rest stay pending —
    // nothing blocked or pre-marked ahead of the walk.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(chips("played")).toHaveLength(1);
    expect(chips("blocked")).toHaveLength(0);
    expect(chips("pending")).toHaveLength(1);
    expect(chips("pending")[0].textContent).toContain("×3");
    expect(walkBtn().disabled).toBe(true);
    expect(btn("↑ Step")!.disabled).toBe(true);

    // Frames exhausted but the landing beat hasn't fired: still locked.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(statusText()).toBe("Walking…");
    expect(walkBtn().disabled).toBe(true);
    expect(btn("↶ Left")!.disabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(statusText()).toContain("Oh. A stone.");
    expect(chips("blocked")).toHaveLength(1);
  });

  it("a routed path lights the lantern and offers Play again", async () => {
    await mount();
    clickEl(btn("Walk it")!);
    settlePlayback();
    clickEl(btn("Try another path")!);

    // left step right step 4 right step — around the stone, home.
    for (const t of ["↶ Left", "↑ Step", "↷ Right", "↑ Step", "↑ Step", "↑ Step", "↑ Step", "↷ Right", "↑ Step"]) {
      clickEl(btn(t)!);
    }
    clickEl(btn("Walk it")!);
    settlePlayback();

    expect(statusText()).toContain("The light is home.");
    expect(btn("Play again")).toBeTruthy();
    expect(container.querySelector(".rp-lantern--lit")).not.toBeNull();
  });
});

describe("Firefly haptics", () => {
  let vibrate: ReturnType<typeof vi.fn>;
  const setVibrate = (fn: unknown) =>
    Object.defineProperty(navigator, "vibrate", { value: fn, configurable: true });

  beforeEach(() => {
    vibrate = vi.fn();
    setVibrate(vibrate);
  });
  afterEach(() => setVibrate(undefined));

  it("stays silent on mount and hums only for accepted inputs", async () => {
    await mount();
    expect(vibrate).not.toHaveBeenCalled();

    clickEl(btn("↑ Step")!);
    expect(vibrate).toHaveBeenLastCalledWith(8);
    clickEl(btn("Undo")!);
    expect(vibrate).toHaveBeenLastCalledWith(8);
    const count = vibrate.mock.calls.length;

    // at cap, nothing accepted — no tick
    for (let i = 0; i < 20; i++) clickEl(btn("↑ Step")!);
    const atCap = vibrate.mock.calls.length;
    expect(btn("↑ Step")!.disabled).toBe(true);
    expect(atCap - count).toBe(12); // the twelve accepted fills to 16
    clickEl(btn("↑ Step")!); // disabled — a no-op
    expect(vibrate.mock.calls.length).toBe(atCap);
  });

  it("blocked input mid-playback produces no pulse", async () => {
    await mount();
    vibrate.mockClear();
    clickEl(btn("Walk it")!);
    expect(vibrate).toHaveBeenLastCalledWith(12); // release
    const count = vibrate.mock.calls.length;
    clickEl(btn("↑ Step")!);
    clickEl(btn("Undo")!);
    expect(vibrate.mock.calls.length).toBe(count);
  });

  it("collision pulses bump once per run, never the home pattern", async () => {
    await mount();
    vibrate.mockClear();
    clickEl(btn("Walk it")!);
    settlePlayback();
    const patterns = vibrate.mock.calls.map((c) => c[0]);
    expect(patterns.filter((p) => p === 18)).toHaveLength(1);
    expect(patterns.some((p) => Array.isArray(p))).toBe(false);
  });

  it("a lit run pulses the home pattern exactly once", async () => {
    await mount();
    clickEl(btn("Walk it")!);
    settlePlayback();
    clickEl(btn("Try another path")!);
    for (const t of ["↶ Left", "↑ Step", "↷ Right", "↑ Step", "↑ Step", "↑ Step", "↑ Step", "↷ Right", "↑ Step"]) {
      clickEl(btn(t)!);
    }
    vibrate.mockClear();
    clickEl(btn("Walk it")!);
    settlePlayback();
    const homes = vibrate.mock.calls.filter((c) => Array.isArray(c[0]));
    expect(homes).toHaveLength(1);
    expect(homes[0][0]).toEqual([7, 45, 10]);
  });

  it("no vibration under reduced motion or without the API", async () => {
    const mm = window.matchMedia;
    window.matchMedia = (q: string) =>
      ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {} } as unknown as MediaQueryList);
    try {
      await mount();
      clickEl(btn("↑ Step")!);
      clickEl(btn("Walk it")!);
      settlePlayback();
      expect(vibrate).not.toHaveBeenCalled();
    } finally {
      window.matchMedia = mm;
    }

    setVibrate(undefined);
    clickEl(btn("Try another path")!);
    expect(() => {
      clickEl(btn("↑ Step")!);
      clickEl(btn("Walk it")!);
      settlePlayback();
    }).not.toThrow();
  });
});
