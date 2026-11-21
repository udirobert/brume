// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/components/companion/JourneyCompanion", () => ({
  CompanionAnchor: (props: Record<string, unknown>) => (
    <span data-mock-anchor data-state={props.state as string} />
  ),
}));
vi.mock("@/lib/decompressAudio", () => ({
  startDecompressTrack: vi.fn(() => () => {}),
}));
vi.mock("@/hooks/useMascotPresence", () => ({
  useMascotPresence: () => ({ presence: "companion", setPresence: vi.fn() }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/lib/events", () => ({ track: vi.fn() }));

import Decompress from "@/pages/Decompress";
import { useRoomExperience } from "@/lib/roomExperience";

let container: HTMLDivElement;
let root: Root;
let locationSeen: string;
let now: number;
const rafQueue = new Map<number, FrameRequestCallback>();
let rafId = 0;

const Probe = () => {
  locationSeen = useLocation().pathname;
  return null;
};

const byText = (t: string) =>
  [...container.querySelectorAll<HTMLElement>("button, a")].find(
    (b) => b.textContent?.trim() === t,
  );
const clickEl = (el: Element) =>
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

// Drive the clock: the room counts *active* seconds from
// performance.now(), so advancing `now` between RAF ticks simulates
// elapsed practice without waiting two real minutes.
const advance = (ms: number) =>
  act(() => {
    const end = now + ms;
    while (now < end) {
      now = Math.min(now + 200, end);
      const cbs = [...rafQueue.values()];
      rafQueue.clear();
      for (const cb of cbs) cb(now);
    }
  });

beforeEach(() => {
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafQueue.set(++rafId, cb);
    return rafId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafQueue.delete(id);
  });
  now = 0;
  rafId = 0;
  rafQueue.clear();
  window.localStorage.clear();
  useRoomExperience.getState().reset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const mount = async (entry = "/decompress") => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <Probe />
        <Decompress />
      </MemoryRouter>,
    );
  });
};

const h1 = () => container.querySelector("h1")!.textContent;

describe("Decompress room", () => {
  it("pond beats: splash on tap, enter on begin, land on finish — no retriggers", async () => {
    await mount();
    const pond = container.querySelector<HTMLElement>(".dc-pond")!;
    const svg = container.querySelector(".dc-pond__svg")!;
    expect(pond.getAttribute("aria-label")).toBe("Make a ripple with Brume");
    expect(svg.getAttribute("data-beat")).toBe("idle");
    expect(container.querySelector(".dc-pond__fx")).toBeNull();

    // A tap splashes: one transient FX group, still on arrival.
    clickEl(pond);
    expect(svg.getAttribute("data-beat")).toBe("splash");
    const splashId = svg.getAttribute("data-moment");
    expect(container.querySelectorAll(".dc-pond__fx")).toHaveLength(1);
    clickEl(pond); // second tap replaces, never queues
    expect(svg.getAttribute("data-beat")).toBe("splash");
    expect(svg.getAttribute("data-moment")).not.toBe(splashId);
    expect(container.querySelectorAll(".dc-pond__fx")).toHaveLength(1);
    expect(h1()).toBe("A little room for you.");
    expect(container.querySelector(".dc-time")).toBeNull();
    expect(useRoomExperience.getState().practicing).toBe(false);

    // Begin enters once; ticks and pause/resume never retrigger it.
    clickEl(byText("Begin a two-minute pause")!);
    expect(svg.getAttribute("data-beat")).toBe("enter");
    const enterId = svg.getAttribute("data-moment");
    expect(enterId).not.toBe(splashId);
    advance(25_000);
    clickEl(byText("Pause")!);
    clickEl(byText("Resume")!);
    expect(svg.getAttribute("data-beat")).toBe("enter");
    expect(svg.getAttribute("data-moment")).toBe(enterId);

    // Early finish lands once and stays.
    clickEl(byText("Finish early")!);
    expect(svg.getAttribute("data-beat")).toBe("land");
    const landId = svg.getAttribute("data-moment");
    expect(landId).not.toBe(enterId);
    clickEl(pond); // resting splash keeps the resting mood
    expect(svg.getAttribute("data-beat")).toBe("splash");
    expect(svg.getAttribute("data-mood")).toBe("rest");
  });

  it("natural expiry lands exactly once", async () => {
    await mount();
    clickEl(byText("Begin a two-minute pause")!);
    advance(120_000);
    const svg = container.querySelector(".dc-pond__svg")!;
    expect(svg.getAttribute("data-beat")).toBe("land");
    expect(h1()).toBe("A moment of rest.");
    const landId = svg.getAttribute("data-moment");
    advance(5_000);
    expect(svg.getAttribute("data-moment")).toBe(landId);
  });

  it("begin → pause excludes paused time → natural end lands on rest → Done home", async () => {
    await mount();
    expect(h1()).toBe("A little room for you.");
    clickEl(byText("Begin a two-minute pause")!);
    expect(h1()).toBe("Rest your hands.");

    advance(25_000); // into the first shoulder step
    expect(h1()).toBe("Let your shoulders drop.");
    expect(container.textContent).toContain("Skip any movement that hurts.");

    clickEl(byText("Pause")!);
    expect(h1()).toBe("Paused.");
    const frozen = container.querySelector(".dc-time")!.textContent;
    advance(60_000); // wall time that must not count
    expect(container.querySelector(".dc-time")!.textContent).toBe(frozen);
    expect(useRoomExperience.getState().paused).toBe(true);

    clickEl(byText("Resume")!);
    expect(h1()).toBe("Let your shoulders drop.");
    advance(95_000); // 25 active + 95 active = the full two minutes
    expect(h1()).toBe("A moment of rest.");
    expect(useRoomExperience.getState().practicing).toBe(false);
    expect(container.textContent).not.toContain("How are you feeling?");

    clickEl(byText("Done")!);
    expect(locationSeen).toBe("/");
  });

  it("sub-second frames don't re-render the room; second ticks do", async () => {
    await mount();
    clickEl(byText("Begin a two-minute pause")!);
    const setPractice = vi.spyOn(useRoomExperience.getState(), "setPractice");

    // 500ms of RAF bursts inside the first second: the clock is floored
    // to whole seconds, so nothing reaches React or the room store.
    const before = setPractice.mock.calls.length;
    advance(500);
    expect(setPractice.mock.calls.length).toBe(before);

    advance(600); // crosses the 1s boundary — one update for "1:59"
    expect(setPractice.mock.calls.length).toBe(before + 1);
    expect(container.querySelector(".dc-time")!.textContent).toBe("1:59 left");

    clickEl(byText("Finish early")!);
    expect(h1()).toBe("A moment of rest.");
  });

  it("begin → End pause → Add a word → choose → words card → Done home", async () => {
    await mount();
    clickEl(byText("Begin a two-minute pause")!);
    clickEl(byText("Finish early")!);
    expect(h1()).toBe("A moment of rest.");

    clickEl(byText("Add a word")!);
    expect(h1()).toBe("How are you feeling?");
    expect(container.querySelector(".dc-share-card")).toBeNull();
    expect(byText("Put it into words")).toBeUndefined();

    const radio = container.querySelector<HTMLInputElement>('.dc-word input[value="3"]');
    clickEl(radio!);
    expect(container.querySelector(".dc-slider-current")!.textContent).toBeTruthy();
    clickEl(byText("Put it into words")!);
    expect(container.querySelector(".dc-share-card")).not.toBeNull();
    expect(container.textContent).toContain(
      "Your message stays here until you copy or share it.",
    );

    clickEl(byText("Done")!);
    expect(locationSeen).toBe("/");
  });
});
