import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const { saveCompletionRecord, buildCompletionRecord } = await import(join(here, "..", "bundle", "session.js"));

const rec = () => buildCompletionRecord({
  context: "x", pattern: "box", plannedSeconds: 90, activeSeconds: 90,
  cycles: 9, interrupted: false, felt: "calmer", planSource: "ai",
  reflection: "r", source: "app", now: 0,
});

function host(map = new Map(), faults = {}) {
  return {
    storage: {
      async get({ key }) {
        if ((faults.get || 0) > 0) { faults.get -= 1; return { ok: false, error: { code: "denied", message: "no" } }; }
        return { value: map.get(key) ?? null };
      },
      async set({ key, value }) {
        if ((faults.set || 0) > 0) { faults.set -= 1; return { ok: false, error: { code: "down", message: "no" } }; }
        map.set(key, value);
        return { ok: true, result: null };
      },
    },
  };
}

test("duplicate retry does not double-fold summary", async () => {
  const map = new Map();
  const anna = host(map);
  const r = rec();
  await saveCompletionRecord(anna, r);
  await saveCompletionRecord(anna, r);
  assert.equal(map.get("reset/summary").total, 1);
  assert.equal(map.get("reset/summary").recent.length, 1);
});

test("ok:false set fails visibly", async () => {
  const map = new Map();
  const anna = host(map, { set: 1 });
  await assert.rejects(() => saveCompletionRecord(anna, rec()), /no/);
});

test("denied summary read propagates, does not overwrite history", async () => {
  const map = new Map();
  const anna = host(map);
  await saveCompletionRecord(anna, rec());
  const before = map.get("reset/summary").total;
  const r2 = { ...rec(), completedAt: "2026-01-01T00:00:00.000Z" };
  const anna2 = host(map, { get: 1 });
  await assert.rejects(() => saveCompletionRecord(anna2, r2));
  assert.equal(map.get("reset/summary").total, before);
});

test("summary lands then response lost: retry preserves total", async () => {
  const map = new Map();
  const anna = host(map);
  const r = rec();
  let lost = false;
  const flaky = {
    storage: {
      get: anna.storage.get,
      async set({ key, value }) {
        map.set(key, value);
        if (key === "reset/summary" && !lost) {
          lost = true;
          throw new Error("response lost");
        }
        return { ok: true, result: null };
      },
    },
  };
  await assert.rejects(() => saveCompletionRecord(flaky, r));
  assert.equal(map.get("reset/summary").total, 1);
  await saveCompletionRecord(anna, r);
  assert.equal(map.get("reset/summary").total, 1);
});
