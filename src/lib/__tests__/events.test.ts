// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as analytics from "../analytics";
import { recordVisit, track } from "../events";
import { useSessionStore } from "@/stores/sessionStore";
import { getPattern } from "../breathingPatterns";

let sent: Array<[string, Record<string, unknown>]>;

beforeEach(() => {
  sent = [];
  vi.spyOn(analytics, "trackEvent").mockImplementation((n, p = {}) => {
    sent.push([n, p]);
  });
  window.localStorage.clear();
  useSessionStore.getState().resetSession();
  sent.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("privacy contract", () => {
  it("every property sent is a number, a boolean, or a short catalog id", () => {
    track("checkin_word", { feeling: 3, surface: "home" });
    track("words_card_copied", {
      surface: "post_session", arm: "sentence", room_link: true, for_me: false, edited: true,
    });
    track("room_touch", { strokes: 2, seconds: 5, material: "mist" });
    for (const [, props] of sent) {
      for (const v of Object.values(props)) {
        if (typeof v === "string") expect(v).toMatch(/^[a-z_0-9-]{1,24}$/);
        else expect(["number", "boolean"]).toContain(typeof v);
      }
    }
  });

  it("never throws when the sink does", () => {
    vi.spyOn(analytics, "trackEvent").mockImplementation(() => {
      throw new Error("sink down");
    });
    expect(() => track("landing_resumed", {})).not.toThrow();
  });
});

describe("after_answer", () => {
  it("carries how much the room was played with, then resets the count", () => {
    track("material_changed", { to: "sand" });
    track("material_changed", { to: "auto" });
    track("after_answer", { choice: "lighter", material_changes: 0 });
    track("after_answer", { choice: "same", material_changes: 0 });
    const answers = sent.filter(([n]) => n === "after_answer");
    expect(answers[0][1].material_changes).toBe(2);
    expect(answers[1][1].material_changes).toBe(0);
  });
});

describe("session lifecycle events", () => {
  const start = () => {
    const pattern = getPattern("reset")!;
    useSessionStore.getState().initializeSession({
      mode: "classic", pattern, enableAudio: false, enableAI: false,
    });
    useSessionStore.getState().setSessionReady();
    useSessionStore.getState().startSession();
  };

  it("start then complete emits start and complete, never abandon", () => {
    start();
    useSessionStore.getState().completeSession();
    useSessionStore.getState().resetSession();
    expect(sent.map(([n]) => n)).toEqual(["session_start", "session_complete"]);
    expect(sent[0][1]).toEqual({ pattern: "reset", mode: "classic" });
  });

  it("leaving mid-breath emits abandon with the phase, once", () => {
    start();
    useSessionStore.getState().resetSession();
    useSessionStore.getState().resetSession();
    const names = sent.map(([n]) => n);
    expect(names).toEqual(["session_start", "session_abandon"]);
    expect(sent[1][1]).toMatchObject({ pattern: "reset", phase: "active" });
  });

  it("resetting a session that never started emits nothing", () => {
    useSessionStore.getState().resetSession();
    expect(sent).toEqual([]);
  });
});

describe("recordVisit", () => {
  const day = (n: number) => new Date(Date.UTC(2026, 10, n, 12));

  it("first visit is day 0, repeats the same day are silent, later days report the gap", () => {
    recordVisit(day(4));
    recordVisit(day(4));
    recordVisit(day(5));
    recordVisit(day(11));
    expect(sent.map(([n, p]) => [n, p.days_since_first])).toEqual([
      ["visit", 0],
      ["visit", 1],
      ["visit", 7],
    ]);
  });

  it("stores two day numbers and nothing else", () => {
    recordVisit(day(4));
    expect(Number(window.localStorage.getItem("brume/first-seen"))).toBeGreaterThan(0);
    expect(Number(window.localStorage.getItem("brume/last-visit"))).toBeGreaterThan(0);
    // The two day numbers, plus the E6 arm (arms.ts) the visit reports.
    expect(window.localStorage.length).toBe(3);
    expect(window.localStorage.getItem("brume/arm-e6")).toMatch(/^(control|line|line_room)$/);
  });
});
