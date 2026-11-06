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
import handler, {
  ALLOWED,
  add,
  clean,
  empty,
} from "../../../netlify/functions/metrics.mjs";

const store = vi.hoisted(() => {
  const docs = new Map<string, unknown>();
  return {
    docs,
    getStore: () => ({
      get: async (key: string, options?: { type?: string }) =>
        options?.type === "json" ? (docs.get(key) ?? null) : null,
      setJSON: async (key: string, value: unknown) => {
        docs.set(key, value);
      },
      // Blobs v11 answers { blobs: [{ key, etag }] }, not { keys }.
      list: async () => ({
        blobs: [...docs.keys()].map((key) => ({ key, etag: "test" })),
        directories: [],
      }),
    }),
  };
});
vi.mock("@netlify/blobs", () => ({ getStore: store.getStore }));

/** A stand-in for the platform's Request: the handler reads four things. */
const request = (
  method: string,
  { url, body, headers }: { url?: string; body?: unknown; headers?: Record<string, string> } = {},
) =>
  ({
    method,
    url: url ?? "https://brume.test/api/metrics",
    headers: { get: (key: string) => headers?.[key.toLowerCase()] ?? null },
    json: async () => body,
  }) as unknown as Request;

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
    // E2's own events: they wait for the arm flag, so they stay local.
    sendMetrics("words_card_shared", { surface: "post_session" });
    sendMetrics("words_card_copied", { surface: "post_session", edited: true });
    expect(posted).toEqual([]);
    expect(isWired("checkin_word")).toBe(false);
  });

  it("sends that a sentence was written, and never what was written", () => {
    sendMetrics("words_written", {
      surface: "post_session",
      arm: "sentence",
      for_me: true,
      message: "It was the first night I slept without my chest being tight",
    });
    expect(posted).toEqual([
      {
        name: "words_written",
        props: { surface: "post_session", arm: "sentence", for_me: true },
      },
    ]);
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
      ["arm", "id"],
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
    add(day, "words_card_shown", { surface: "post_session", arm: "sentence" });
    add(day, "words_written", { surface: "post_session", arm: "sentence", for_me: true });
    add(day, "words_written", { surface: "post_session", arm: "sentence", for_me: false });
    expect(day).toEqual({
      since_first: { "0": 1, "8-30": 1, "31+": 1 },
      gaps: { "3": 1, "31+": 1 },
      by_arm: {},
      session_starts: 1,
      completes: { reset: 1 },
      abandons: { paused: 1 },
      after: { lighter: 1 },
      words: { shown: 1, own: 2, kept: 1 },
    });
  });

  it("splits the visit histograms by arm, and only by an arm on the list", () => {
    const day = empty();
    add(day, "visit", { days_since_first: 0, arm: "line" });
    add(day, "visit", { days_since_first: 7, days_since_last: 7, arm: "control" });
    add(day, "visit", { days_since_first: 7, days_since_last: 7, arm: "control" });
    add(day, "visit", { days_since_first: 3, arm: "whatever_i_typed" });
    expect(day.by_arm).toEqual({
      line: { since_first: { "0": 1 }, gaps: {} },
      control: { since_first: { "7": 2 }, gaps: { "7": 2 } },
    });
    // The unsplit totals still see every visit.
    expect(day.since_first).toEqual({ "0": 1, "7": 2, "3": 1 });
  });

  it("carries the arm as an id on the wire and drops anything shaped like a sentence", () => {
    track("visit", { days_since_first: 2, arm: "line_room" });
    sendMetrics("visit", { days_since_first: 2, arm: "A whole sentence" });
    expect(posted.map((p) => p.props)).toEqual([
      { days_since_first: 2, arm: "line_room" },
      { days_since_first: 2 },
    ]);
  });

  it("counts the act of writing a sentence and drops the sentence", () => {
    const props = clean("words_written", {
      surface: "post_session",
      arm: "sentence",
      for_me: true,
      message: "It was the first night I slept without my chest being tight",
    });
    expect(props).toEqual({ surface: "post_session", arm: "sentence", for_me: true });
    const day = empty();
    add(day, "words_written", props!);
    expect(JSON.stringify(day)).not.toMatch("slept");
    expect(day.words.own).toBe(1);
  });
});

describe("the counter answering a request", () => {
  // Neither of these was ever exercised before deploy, and both were broken:
  // a v2 function must hand back a Response, and Blobs changed the shape of
  // `list` under the read path. A deployed counter that only 502s is worse
  // than none, because the doc would then be reading numbers that never came.
  beforeEach(() => store.docs.clear());

  it("accepts a wired event and stores the day", async () => {
    const res = await handler(
      request("POST", { body: { name: "visit", props: { days_since_first: 9, days_since_last: 3 } } }),
    );
    expect(res, "a v2 function must return a Response").toBeInstanceOf(Response);
    expect(res.status).toBe(202);
    const today = new Date().toISOString().slice(0, 10);
    expect(store.docs.get(today)).toMatchObject({
      since_first: { "8-30": 1 },
      gaps: { "3": 1 },
    });
  });

  it("adds to the day rather than replacing it", async () => {
    const today = new Date().toISOString().slice(0, 10);
    store.docs.set(
      today,
      Object.assign(empty(), { since_first: { "8-30": 2 }, words: { shown: 3, own: 1, kept: 0 } }),
    );
    await handler(request("POST", { body: { name: "words_card_shown", props: { surface: "post_session", arm: "sentence" } } }));
    expect(store.docs.get(today)).toMatchObject({
      since_first: { "8-30": 2 },
      words: { shown: 4, own: 1, kept: 0 },
    });
  });

  it("refuses an event that is not wired, and writes nothing", async () => {
    const res = await handler(
      request("POST", { body: { name: "checkin_word", props: { feeling: 3 } } }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "not_wired" });
    expect(store.docs.size).toBe(0);
  });

  it("reads the days back", async () => {
    store.docs.set("2026-11-03", Object.assign(empty(), { session_starts: 4 }));
    store.docs.set("2026-11-04", Object.assign(empty(), { session_starts: 6 }));
    store.docs.set("not-a-day", Object.assign(empty()));
    const res = await handler(request("GET", { url: "https://brume.test/api/metrics?days=2026-11-03" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body.days)).toEqual(["2026-11-03", "2026-11-04"]);
  });

  it("keeps the read closed when a token is set", async () => {
    process.env.METRICS_READ_TOKEN = "sesame";
    try {
      const open = await handler(request("GET"));
      expect(open.status).toBe(403);
      const bearer = await handler(
        request("GET", { headers: { authorization: "Bearer sesame" } }),
      );
      expect(bearer.status).toBe(200);
    } finally {
      delete process.env.METRICS_READ_TOKEN;
    }
  });

  it("will not be made to write by a query", async () => {
    const res = await handler(request("DELETE"));
    expect(res.status).toBe(405);
  });
});
