// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const anchorProps: Record<string, unknown>[] = [];
vi.mock("@/components/companion/JourneyCompanion", () => ({
  CompanionAnchor: (props: Record<string, unknown>) => {
    anchorProps.push(props);
    return <span data-mock-anchor data-state={props.state as string} data-demeanor={props.demeanor as string} />;
  },
}));
vi.mock("@/components/atmosphere/AbsorbDroplet", () => ({ AbsorbDroplet: () => null }));

// --- voice: the companion's listening gaze ---------------------------------
const micMock = vi.hoisted(() => ({
  listenOnce: vi.fn(),
  resolve: undefined as ((v: unknown) => void) | undefined,
  arm() {
    this.listenOnce.mockReset();
    this.listenOnce.mockImplementation((_interim: unknown, signal: AbortSignal) => {
      return new Promise((res) => {
        this.resolve = (v: unknown) => res(v);
        signal.addEventListener("abort", () =>
          res({ transcript: "", index: null, suggest: null, pattern: null, failure: null }),
        );
      });
    });
  },
}));
vi.mock("@/lib/voiceCheckin", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/voiceCheckin")>();
  return {
    ...real,
    voiceCheckinSupported: () => true,
    listenOnce: (...args: unknown[]) => micMock.listenOnce(...(args as [])),
  };
});
vi.mock("@/hooks/useMascotPresence", () => ({
  useMascotPresence: () => ({ presence: "company", setPresence: vi.fn() }),
}));

import Index from "@/pages/Index";
import { useRoomExperience } from "@/lib/roomExperience";
import { useSessionStore } from "@/stores/sessionStore";

let container: HTMLDivElement;
let root: Root;
let locationSeen: { pathname: string; search: string; state: Record<string, unknown> | null };

const Probe = () => {
  const l = useLocation();
  locationSeen = {
    pathname: l.pathname,
    search: l.search,
    state: l.state as Record<string, unknown> | null,
  };
  return null;
};

const buttons = () => [...container.querySelectorAll<HTMLButtonElement>("button")];
const byText = (t: string) => buttons().find((b) => b.textContent === t);
const clickEl = (b: Element) =>
  act(() => {
    b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

beforeEach(() => {
  anchorProps.length = 0;
  window.localStorage.clear();
  useRoomExperience.getState().reset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useRoomExperience.getState().reset();
  useSessionStore.getState().resetSession();
});

const mount = async () => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/"]}>
        <Probe />
        <Index />
      </MemoryRouter>,
    );
  });
};

describe("Home", () => {
  it("shows only the new compact copy with Options closed", async () => {
    await mount();
    expect(container.querySelector("h1")!.textContent).toBe("How are you feeling?");
    const details = container.querySelector<HTMLDetailsElement>(".brume-home-options")!;
    expect(details.open).toBe(false);
    expect(container.textContent).not.toContain("Good morning");
    expect(container.textContent).not.toContain("Choose again");
    expect(container.textContent).not.toContain("Create an account");
    expect(container.textContent).not.toContain("Take two minutes");
    expect(container.textContent).not.toContain("More rhythms");
    expect(container.querySelectorAll(".brume-choice--flip")).toHaveLength(5);
  });

  it("default Begin navigates to reset with startImmediately", async () => {
    await mount();
    clickEl(byText("Begin")!);
    expect(locationSeen.search).toContain("pattern=reset");
    expect(locationSeen.state).toMatchObject({
      checkInIndex: null,
      startImmediately: true,
    });
  });

  it("Light then flip gives Heavy index 6 to Begin", async () => {
    await mount();
    const light = container.querySelectorAll(".brume-choice--flip")[0];
    clickEl(light);
    clickEl(light);
    expect(useRoomExperience.getState().feelIndex).toBe(6);
    clickEl(byText("Begin")!);
    expect(locationSeen.state).toMatchObject({
      checkInIndex: 6,
      startImmediately: true,
    });
    expect(locationSeen.search).toContain("pattern=reset");
  });

  it("Overwhelmed flip to Hopeful shows proud/open and begins index 13", async () => {
    await mount();
    const chip = container.querySelectorAll(".brume-choice--flip")[4];
    clickEl(chip);
    clickEl(chip);
    expect(useRoomExperience.getState().feelIndex).toBe(13);
    const last = anchorProps[anchorProps.length - 1];
    expect(last.state).toBe("proud");
    expect(last.demeanor).toBe("open");
    clickEl(byText("Begin")!);
    expect(locationSeen.state).toMatchObject({ checkInIndex: 13 });
  });

  it("rhythm override inside Options is respected by Begin", async () => {
    await mount();
    const chip = container.querySelectorAll(".brume-choice--flip")[4];
    clickEl(chip);
    clickEl(chip);
    const details = container.querySelector<HTMLDetailsElement>(".brume-home-options")!;
    act(() => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });
    const select = details.querySelector("select")!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
      setter.call(select, "box");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    clickEl(byText("Begin")!);
    expect(locationSeen.search).toContain("pattern=box");
    expect(locationSeen.state).toMatchObject({ checkInIndex: 13 });
  });

  it("names a reason in one tap and keeps it on the device", async () => {
    await mount();
    expect(container.querySelector(".brume-reasons")).toBeNull();
    clickEl(container.querySelectorAll(".brume-choice--flip")[1]);
    const chips = [
      ...container.querySelectorAll<HTMLButtonElement>(".brume-reasons__chip"),
    ];
    expect(chips.map((c) => c.textContent)).toEqual([
      "work",
      "people",
      "sleep",
      "money",
      "the day",
      "something good",
    ]);
    clickEl(chips.find((c) => c.textContent === "work")!);
    expect(container.querySelector(".brume-reasons__kept")).not.toBeNull();
    const stored = JSON.parse(
      window.localStorage.getItem("brume.checkin.ledger.v1") || "[]",
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ f: 8, r: "work" });
  });

  it("room settings inside Options update the store", async () => {
    await mount();
    const details = container.querySelector<HTMLDetailsElement>(".brume-home-options")!;
    act(() => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });
    const sand = [...details.querySelectorAll("button")].find((b) => b.textContent === "Sand")!;
    clickEl(sand);
    expect(useRoomExperience.getState().materialOverride).toBe("sand");
    const still = [...details.querySelectorAll("button")].find((b) => b.textContent === "Still room")!;
    clickEl(still);
    expect(useRoomExperience.getState().still).toBe(true);
  });
});

describe("Home — the room remembers (E6)", () => {
  const RESTLESS = 10;
  const seedWeek = () => {
    const now = Date.now();
    const rows = [
      ...[1, 2, 3].map((d) => ({ t: now - d * 3_600_000 * 24 + 1000, f: RESTLESS, r: null, p: "dawn" })),
      { t: now - 4 * 86_400_000, f: 0, r: null, p: "dusk" },
      { t: now - 5 * 86_400_000, f: 1, r: null, p: "night" },
      { t: now - 5 * 86_400_000 + 5, f: 2, r: null, p: "day" },
      { t: now - 6 * 86_400_000, f: 3, r: null, p: "night" },
    ];
    window.localStorage.setItem("brume.checkin.ledger.v1", JSON.stringify(rows));
  };
  const memory = () => container.querySelector(".brume-home__memory");

  it("shows the control arm nothing, however much the ledger holds", async () => {
    seedWeek();
    window.localStorage.setItem("brume/arm-e6", "control");
    await mount();
    expect(memory()).toBeNull();
    expect(useRoomExperience.getState().rememberedMaterial).toBeNull();
  });

  it("shows the line arm one named pattern and leaves the room alone", async () => {
    seedWeek();
    window.localStorage.setItem("brume/arm-e6", "line");
    await mount();
    expect(memory()?.textContent).toBe("Restless, three mornings this week.");
    expect(useRoomExperience.getState().rememberedMaterial).toBeNull();
  });

  it("tints the room too for line_room, and the arm name never reaches the page", async () => {
    seedWeek();
    window.localStorage.setItem("brume/arm-e6", "line_room");
    await mount();
    expect(memory()?.textContent).toBe("Restless, three mornings this week.");
    expect(useRoomExperience.getState().rememberedMaterial).not.toBeNull();
    expect(container.innerHTML).not.toMatch(/line_room|arm-e6/);
  });

  it("says nothing on a fresh ledger, in every arm", async () => {
    for (const arm of ["control", "line", "line_room"]) {
      window.localStorage.clear();
      window.localStorage.setItem("brume/arm-e6", arm);
      await mount();
      expect(memory(), arm).toBeNull();
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it("does not announce itself — a memory is not an alert", async () => {
    seedWeek();
    window.localStorage.setItem("brume/arm-e6", "line");
    await mount();
    expect(memory()?.getAttribute("aria-live")).toBeNull();
  });
});



describe("Home — the listening gaze", () => {
  const lastAnchor = () => anchorProps[anchorProps.length - 1];
  const mic = () => container.querySelector<HTMLButtonElement>(".brume-mic")!;
  const press = (el: HTMLElement) =>
    act(() => {
      el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 7 }));
    });
  const release = (el: HTMLElement) =>
    act(() => {
      el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 7 }));
    });
  const resolveVoice = async (v: unknown) => {
    await act(async () => {
      micMock.resolve!(v);
    });
  };

  beforeEach(() => micMock.arm());

  it("while hearing, the companion looks at the mic", async () => {
    await mount();
    press(mic());
    expect(lastAnchor().lookAt).toBe(container.querySelector(".brume-mic"));
    release(mic());
  });

  it("after a match, the gaze moves to the suggested word and stays", async () => {
    await mount();
    press(mic());
    release(mic());
    await resolveVoice({ transcript: "drained", index: null, suggest: 6, pattern: null, failure: null });
    const chip = container.querySelector(".brume-choice.is-suggested");
    expect(chip).not.toBeNull();
    expect(lastAnchor().lookAt).toBe(chip);
  });

  it("choosing the word with the hand releases the gaze", async () => {
    await mount();
    press(mic());
    release(mic());
    await resolveVoice({ transcript: "drained", index: null, suggest: 6, pattern: null, failure: null });
    clickEl(container.querySelector(".brume-choice.is-suggested")!);
    expect(lastAnchor().lookAt ?? null).toBeNull();
  });

  it("a blocked mic sends the gaze to the help card", async () => {
    await mount();
    press(mic());
    release(mic());
    await resolveVoice({ transcript: "", index: null, suggest: null, pattern: null, failure: "mic_blocked" });
    expect(container.querySelector(".brume-voice-help")).not.toBeNull();
    expect(lastAnchor().lookAt).toBe(container.querySelector(".brume-voice-help"));
  });

  it("a miss releases the gaze", async () => {
    await mount();
    press(mic());
    release(mic());
    await resolveVoice({ transcript: "the weather", index: null, suggest: null, pattern: null, failure: null });
    expect(lastAnchor().lookAt ?? null).toBeNull();
  });
});
