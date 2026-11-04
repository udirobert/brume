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
vi.mock("@/lib/Magnetic", () => ({
  Magnetic: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/atmosphere/AbsorbDroplet", () => ({ AbsorbDroplet: () => null }));
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
