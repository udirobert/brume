// @vitest-environment jsdom
/**
 * The wire — what may leave a device, and only that.
 *
 * These tests are the second half of the privacy contract: the type map in
 * `events.ts` says what a caller may send, this file says what the network
 * may carry, and the last block checks the counter accepts exactly that.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WIRE, isWired, sendMetrics, wireFields } from "../metrics";
import { track } from "../events";
// The counter's own map, so the two sides are checked against each other.
import {
  ALLOWED,
  add,
  clean,
  empty,
} from "../../../netlify/functions/metrics.mjs";

type Sent = { name: string; props: Record<string, unknown> };
let posted: Sent[];

beforeEach(() => {
  posted = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit) => {
      posted.push(JSON.parse(String(init.body)));
      expect(url).toBe("/api/metrics");
      return Promise.resolve(new Response("{}", { status: 202 }));
    }),
  );
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("what leaves the device", () => {
  it("sends the wired events", () => {
    sendMetrics("visit", { days_since_first: 0 });
    sendMetrics("session_start", { pattern: "reset", mode: "classic" });
    sendMetrics("after_answer", { choice: "lighter", material_changes: 2 });
    expect(posted.map((p) => p.name)).toEqual([
      "visit",
      "session_start",
      "after_answer",
    ]);
  });

  it("sends nothing for an event that is not wired", () => {
    sendMetrics("checkin_word", { feeling: 3, surface: "home" });
    sendMetrics("room_touch", { strokes: 2, seconds: 5, material: "mist" });
    sendMetrics("words_card_shared", { surface: "post_session" });
    expect(posted).toEqual([]);
    expect(isWired("checkin_word")).toBe(false);
  });

  it("drops a value that is not a number, a boolean or an id", () => {
    sendMetrics("session_start", {
      pattern: "reset",
      mode: "I felt a heavy weight in my chest all morning",
    });
    expect(posted[0].props).toEqual({ pattern: "reset" });
  });

  it("drops a payload left with nothing legal in it", () => {
    sendMetrics("session_start", {
      pattern: "a whole sentence about the user's evening",
      mode: "x".repeat(40),
    });
    expect(posted).toEqual([]);
  });

  it("carries both day numbers of a visit, and only the first on day 0", () => {
    track("visit", { days_since_first: 0 });
    track("visit", { days_since_first: 9, days_since_last: 3 });
    expect(posted.map((p) => p.props)).toEqual([
      { days_since_first: 0 },
      { days_since_first: 9, days_since_last: 3 },
    ]);
  });

  it("never sends an id, a name, or anything that could single a person out", () => {
    for (const name of Object.keys(WIRE)) {
      expect(["user_id", "id", "email", "device", "session"]).not.toContain(name);
    }
    sendMetrics("visit", { days_since_first: 4, days_since_last: 2, path: "/post-session" });
    expect(Object.keys(posted[0].props).sort()).toEqual([
      "days_since_first",
      "days_since_last",
    ]);
  });
});

describe("the counter's side of the contract", () => {
  it("knows exactly the events the wire knows", () => {
    expect(Object.keys(ALLOWED).sort()).toEqual(Object.keys(WIRE).sort());
  });

  it("accepts every field the wire would send, as the same kind", () => {
    for (const name of Object.keys(WIRE) as Array<keyof typeof WIRE>) {
      const client = wireFields(name)
        .map(([key, kind]) => `${key}:${kind}`)
        .sort();
      const server = Object.entries(ALLOWED[name])
        .map(([key, kind]) => `${key}:${kind}`)
        .sort();
      expect(server).toEqual(client);
    }
  });

  it("sends no field that could single a person out", () => {
    expect(wireFields("visit")).toEqual([
      ["days_since_first", "num"],
      ["days_since_last", "num"],
    ]);
    for (const name of Object.keys(WIRE) as Array<keyof typeof WIRE>) {
      for (const [key] of wireFields(name)) {
        expect(key).not.toMatch(/user|device|email|path|name|token/);
      }
    }
  });
});

describe("the counter's arithmetic", () => {
  it("drops a value it was not told about, or that is not an id", () => {
    expect(
      clean("after_answer", {
        choice: "lighter",
        material_changes: 3,
        note: "a whole sentence about the morning",
      }),
    ).toEqual({ choice: "lighter", material_changes: 3 });
    expect(
      clean("session_start", { pattern: "a whole sentence", mode: "classic" }),
    ).toEqual({ mode: "classic" });
    expect(clean("checkin_word", { feeling: 3 })).toBeNull();
    expect(clean("visit", { days_since_first: -4 })).toBeNull();
  });

  it("rolls a day of counts and keeps the buckets small", () => {
    const day = empty();
    add(day, "visit", { days_since_first: 0 });
    add(day, "visit", { days_since_first: 9, days_since_last: 3 });
    add(day, "visit", { days_since_first: 400, days_since_last: 310 });
    add(day, "session_start", { pattern: "reset", mode: "classic" });
    add(day, "session_complete", { pattern: "reset" });
    add(day, "session_abandon", { phase: "paused" });
    add(day, "after_answer", { choice: "lighter" });
    expect(day).toEqual({
      since_first: { "0": 1, "8-30": 1, "31+": 1 },
      gaps: { "3": 1, "31+": 1 },
      session_starts: 1,
      completes: { reset: 1 },
      abandons: { paused: 1 },
      after: { lighter: 1 },
    });
  });
});
