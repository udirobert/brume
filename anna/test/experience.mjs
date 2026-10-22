import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const { parseReadyHandoff, normaliseWordingStyle, MOMENTS, WORDING_STYLES } = await import(join(here, "..", "bundle", "experience.js"));
const { loadWordingPreference, saveWordingPreference } = await import(join(here, "..", "bundle", "ready-preferences.js"));
const { validateCheckpoint, createCheckpointStore } = await import(join(here, "..", "bundle", "recovery.js"));

const PLAN = { kind: "plan", opening: "o", keyPoint: "k", approach: "a", objection: "ob", response: "r", nextStep: "n" };

test("valid handoff yields editable plan, no model", () => {
  const r = parseReadyHandoff({ mode: "ready", context: "Interview", goal: "g", preparation: PLAN });
  assert.equal(r.source, "anna-handoff");
  assert.equal(r.plan.opening, "o");
  assert.equal(r.input.event, "Interview");
  assert.equal(r.input.goal, "g");
  assert.equal(r.invalidDraft, false);
});

test("invalid draft keeps input, flags invalid", () => {
  for (const bad of [{ kind: "clarify", question: "q?" }, { kind: "plan", opening: "o" }, "junk", [PLAN],
    { ...PLAN, opening: "x".repeat(1200) }, { ...PLAN, response: "it will cure your anxiety" }]) {
    const r = parseReadyHandoff({ context: "ctx", preparation: bad });
    assert.equal(r.plan, null);
    assert.equal(r.invalidDraft, true);
    assert.equal(r.input.event, "ctx");
  }
});

test("caps and empty context", () => {
  const r = parseReadyHandoff({ context: "x".repeat(700), goal: "g".repeat(400), preserve: "p".repeat(300) });
  assert.equal(r.input.event.length, 600);
  assert.equal(r.input.goal.length, 300);
  assert.equal(r.input.preserve.length, 220);
  assert.equal(parseReadyHandoff({ preparation: PLAN }).plan, null);
  assert.equal(parseReadyHandoff({ preparation: PLAN }).invalidDraft, false);
  assert.equal(parseReadyHandoff(null).plan, null);
});

test("wording style normalisation", () => {
  assert.equal(normaliseWordingStyle("direct"), "direct");
  assert.equal(normaliseWordingStyle("bossy"), "natural");
  assert.equal(normaliseWordingStyle(undefined), "natural");
  assert.deepEqual(WORDING_STYLES, ["natural", "concise", "direct"]);
  assert.ok(MOMENTS.deadline.event);
});

function host(map = new Map()) {
  return { storage: {
    get: async ({ key }) => ({ value: map.get(key) ?? null }),
    set: async ({ key, value }) => { value === null ? map.delete(key) : map.set(key, value); return { ok: true, result: null }; },
  } };
}

test("prefs load/save/forget round trip", async () => {
  const map = new Map();
  const anna = host(map);
  assert.equal(await loadWordingPreference(anna), "natural");
  assert.equal(await saveWordingPreference(anna, "direct"), "direct");
  assert.equal(await loadWordingPreference(anna), "direct");
  assert.equal(await saveWordingPreference(anna, "natural"), "natural");
  assert.equal(map.has("ready/preferences"), false);
  assert.equal(await loadWordingPreference(anna), "natural");
});

test("corrupt pref reads natural; denied write propagates", async () => {
  const anna = host(new Map([["ready/preferences", { version: 2, wordingStyle: "loud" }]]));
  assert.equal(await loadWordingPreference(anna), "natural");
  const denied = { storage: { get: async () => ({ ok: false, error: { code: "denied", message: "no" } }) } };
  await assert.rejects(() => loadWordingPreference(denied));
});

test("denied writes propagate for remember and forget", async () => {
  const map = new Map([["ready/preferences", { version: 1, wordingStyle: "direct" }]]);
  const denied = { storage: {
    get: async ({ key }) => ({ value: map.get(key) ?? null }),
    set: async () => ({ ok: false, error: { code: "denied", message: "no" } }),
  } };
  await assert.rejects(() => saveWordingPreference(denied, "concise"));
  await assert.rejects(() => saveWordingPreference(denied, "natural"));
  assert.equal(map.get("ready/preferences").wordingStyle, "direct");
});

test("load times out without poisoning next read", async () => {
  let resolveFirst;
  const calls = [];
  const storage = {
    get: async () => new Promise((r) => { calls.push(r); resolveFirst = r; }),
    set: async () => ({ ok: true }),
  };
  const store = createCheckpointStore({ storage }, { timeoutMs: 30 });
  const first = store.load();
  await new Promise((r) => setTimeout(r, 80));
  await first;
  assert.equal(store.lastLoad.state, "error");
  const cp = { version: 1, id: "t", flow: "alert", screen: "setup", updatedAt: Date.now(), data: { kss: 3 } };
  storage.get = async () => ({ value: cp });
  const got = await store.load();
  assert.equal(store.lastLoad.state, "ok");
  assert.equal(got.id, "t");
  resolveFirst({ value: null });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(store.lastLoad.state, "ok");
});
