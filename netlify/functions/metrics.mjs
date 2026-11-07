/**
 * The counter — the only endpoint that receives anything from a session.
 *
 * One POST per wired event; what arrives is id-less and already limited to
 * numbers, booleans and short ids. Nothing is stored per person: each day's
 * counters live in one blob and are summed in place, so the most anyone can
 * read out of here is how many.
 *
 * Reading is a GET on the same path. If METRICS_READ_TOKEN is set in the
 * function env the read needs it in `Authorization`; if it isn't, the
 * aggregates stay open — a small product can afford its own traffic.
 */
import { getStore } from "@netlify/blobs";

const STORE = "brume-metrics";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Mirrors WIRE in src/lib/metrics.ts. A field not listed here is dropped. */
export const ALLOWED = {
  visit: { days_since_first: "num", days_since_last: "num", arm: "id" },
  session_start: { pattern: "id", mode: "id" },
  session_complete: { pattern: "id", seconds: "num", cycles: "num" },
  session_abandon: { pattern: "id", phase: "id", seconds: "num" },
  after_answer: { choice: "id", material_changes: "num" },
  words_card_shown: { surface: "id", arm: "id" },
  words_written: { surface: "id", arm: "id", for_me: "bool" },
  room_touch: { strokes: "num", seconds: "num", material: "id" },
};

/** Mirrors E6_ARMS in src/lib/arms.ts; an arm not listed is not tallied. */
const ARMS = ["control", "line", "line_room"];

/** Mirrors Material in src/lib/events.ts; anything else is tallied as "other". */
const MATERIALS = ["mist", "waves", "sand", "cells", "snow", "ink"];

const ID_SHAPE = /^[a-z][a-z0-9_-]{0,23}$/;

/**
 * A v2 function: the return has to be a Response. `tts.mjs` next door is a v1
 * handler and may return {statusCode, body}; mixing the two fails at runtime,
 * not at build, so the shape is pinned by a test.
 */
const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/** Keeps the histograms small and stops a day document growing forever. */
const bucket = (n) => (n <= 7 ? String(n) : n <= 30 ? "8-30" : "31+");

export const empty = () => ({
  since_first: {},
  gaps: {},
  // The same two histograms split by E6 arm, so D7 can be compared between
  // arms without a person in the data: { control: { since_first, gaps } }.
  by_arm: {},
  session_starts: 0,
  completes: {},
  abandons: {},
  after: {},
  // shown: the sentence card opened. own: the composed sentence was changed,
  // so a person's words exist somewhere. kept: they wrote it for themselves.
  words: { shown: 0, own: 0, kept: 0 },
  // E4 step 1: Home visits where the room was drawn on, how much, and on
  // which material. Never where, never the shape.
  touch: { count: 0, strokes: {}, seconds: {}, material: {} },
});

/**
 * Counting only ever adds to a day, so two writers landing on the same
 * document can lose an increment. Losing the odd count is the trade for never
 * storing a person — the read is a shape, not a ledger.
 */
export function add(day, name, props) {
  switch (name) {
    case "visit": {
      const arm = ARMS.includes(props.arm) ? (day.by_arm[props.arm] ??= { since_first: {}, gaps: {} }) : null;
      if (typeof props.days_since_first === "number") {
        const key = bucket(props.days_since_first);
        day.since_first[key] = (day.since_first[key] ?? 0) + 1;
        if (arm) arm.since_first[key] = (arm.since_first[key] ?? 0) + 1;
      }
      if (typeof props.days_since_last === "number") {
        const key = bucket(props.days_since_last);
        day.gaps[key] = (day.gaps[key] ?? 0) + 1;
        if (arm) arm.gaps[key] = (arm.gaps[key] ?? 0) + 1;
      }
      return;
    }
    case "session_start":
      day.session_starts += 1;
      return;
    case "session_complete":
      day.completes[props.pattern ?? "unknown"] =
        (day.completes[props.pattern ?? "unknown"] ?? 0) + 1;
      return;
    case "session_abandon":
      day.abandons[props.phase ?? "unknown"] =
        (day.abandons[props.phase ?? "unknown"] ?? 0) + 1;
      return;
    case "after_answer":
      day.after[props.choice ?? "unknown"] =
        (day.after[props.choice ?? "unknown"] ?? 0) + 1;
      return;
    case "words_card_shown":
      day.words.shown += 1;
      return;
    case "words_written":
      day.words.own += 1;
      if (props.for_me === true) day.words.kept += 1;
      return;
    case "room_touch": {
      const touch = (day.touch ??= { count: 0, strokes: {}, seconds: {}, material: {} });
      touch.count += 1;
      if (typeof props.strokes === "number") {
        const key = bucket(props.strokes);
        touch.strokes[key] = (touch.strokes[key] ?? 0) + 1;
      }
      if (typeof props.seconds === "number") {
        const key = bucket(props.seconds);
        touch.seconds[key] = (touch.seconds[key] ?? 0) + 1;
      }
      const material = MATERIALS.includes(props.material) ? props.material : "other";
      touch.material[material] = (touch.material[material] ?? 0) + 1;
      return;
    }
  }
}

export function clean(name, props) {
  const spec = ALLOWED[name];
  if (!spec || typeof props !== "object" || props === null) return null;
  const out = {};
  for (const [key, kind] of Object.entries(spec)) {
    const value = props[key];
    if (
      kind === "num" &&
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value < 1e7
    ) {
      out[key] = Math.round(value);
    }
    if (kind === "id" && typeof value === "string" && ID_SHAPE.test(value)) {
      out[key] = value;
    }
    if (kind === "bool" && typeof value === "boolean") out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export default async (request) => {
  let store;
  try {
    store = getStore({ name: STORE });
  } catch {
    return json(503, { error: "metrics_unavailable" });
  }

  if (request.method === "GET") {
    const token = process.env.METRICS_READ_TOKEN;
    if (token && request.headers.get("authorization") !== `Bearer ${token}`) {
      return json(403, { error: "forbidden" });
    }
    const since = new URL(request.url).searchParams.get("days");
    if (since !== null && !DAY.test(since)) {
      return json(400, { error: "bad_days" });
    }
    const keys = (await store.list()).blobs
      .map((entry) => entry.key)
      .filter((key) => DAY.test(key))
      .filter((key) => (since ? key >= since : true))
      .sort();
    const days = {};
    for (const key of keys) {
      const day = await store.get(key, { type: "json" });
      if (day) days[key] = day;
    }
    return json(200, { days });
  }

  if (request.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "bad_json" });
  }
  const props = clean(body?.name, body?.props);
  if (!props) return json(400, { error: "not_wired" });

  const key = new Date().toISOString().slice(0, 10);
  try {
    const stored = await store.get(key, { type: "json" });
    // A day written by an earlier version may lack a counter added since;
    // merging the shape keeps the sum in place rather than failing the write.
    const day = { ...empty(), ...(stored ?? {}) };
    add(day, body.name, props);
    await store.setJSON(key, day);
  } catch {
    return json(503, { error: "metrics_unavailable" });
  }
  return json(202, { ok: true });
};
