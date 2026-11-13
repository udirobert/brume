import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const {
  ACTIVE_TASK_KEY,
  validateCheckpoint,
  createCheckpointStore,
} = await import(join(here, "..", "bundle", "recovery.js"));

const PLAN = {
  pattern: "cyclic-sigh", seconds: 90, title: "t", opening: "o",
  cues: ["c"], why: "w", planSource: "ai",
};
const READY_PLAN = {
  opening: "o", keyPoint: "k", approach: "a",
  objection: "ob", response: "r", nextStep: "n",
};
const PREP = {
  input: { event: "e", goal: "", keyPoint: "", kind: null },
  stage: "plan", clarificationUsed: false, question: "", clarification: "",
  plan: READY_PLAN, reply: "", feedback: null,
  finalResponse: null, finalNextStep: null,
  busy: null, error: "", completedAt: null, saved: false,
};

function cp(over = {}) {
  return {
    version: 1, id: "task-1", flow: "ready", screen: "plan",
    updatedAt: Date.now(), data: { prep: PREP, pause: null },
    ...over,
  };
}
const alertCp = () => cp({
  flow: "alert", screen: "setup", data: { kss: 3 },
});
const resetCp = (screen, data) => cp({
  flow: "reset", screen, data: { context: "x", plan: PLAN, soundMode: "off", ...data },
});

test("valid ready checkpoint validates", () => {
  const v = validateCheckpoint(cp());
  assert.equal(v.id, "task-1");
});

test("30-day-old checkpoint is still valid", () => {
  assert.ok(validateCheckpoint(cp({ updatedAt: Date.now() - 30 * 24 * 3600 * 1000 })));
});

test("future-dated checkpoint beyond skew rejected", () => {
  assert.equal(validateCheckpoint(cp({ updatedAt: Date.now() + 25 * 3600 * 1000 })), null);
});

for (const [name, over] of [
  ["version 2", { version: 2 }],
  ["empty id", { id: "" }],
  ["unknown flow", { flow: "nap" }],
  ["screen not allowed for flow", { screen: "session" }],
  ["non-finite updatedAt", { updatedAt: NaN }],
  ["negative updatedAt", { updatedAt: -5 }],
  ["data null", { data: null }],
  ["data array", { data: [] }],
  ["huge data", { data: { prep: PREP, pause: null, blob: "x".repeat(200_000) } }],
  ["missing prep plan on plan stage", { data: { prep: { ...PREP, plan: null }, pause: null } }],
  ["bad stage", { data: { prep: { ...PREP, stage: "nope" }, pause: null } }],
  ["bad busy", { data: { prep: { ...PREP, busy: "zipping" }, pause: null } }],
  ["feedback stage missing feedback", { screen: "feedback", data: { prep: { ...PREP, stage: "feedback" }, pause: null } }],
  ["pause missing pause data", { screen: "pause", data: { prep: PREP, pause: null } }],
  ["pause bad step", { screen: "pause", data: { prep: PREP, pause: { step: 9, elapsedMs: 0 } } }],
]) {
  test(`ready rejects ${name}`, () => assert.equal(validateCheckpoint(cp(over)), null));
}

test("feedback stage with feedback valid", () => {
  assert.ok(validateCheckpoint(cp({ screen: "feedback", data: { prep: { ...PREP, stage: "feedback", feedback: { adjustment: "a", response: "r", nextStep: "n" } }, pause: null } })));
});

test("ready pause data valid", () => {
  assert.ok(validateCheckpoint(cp({ screen: "pause", data: { prep: PREP, pause: { step: 2, elapsedMs: 5000, return: "plan" } } })));
});

for (const [name, screen, data] of [
  ["bad pattern", "plan", { plan: { ...PLAN, pattern: "nope" } }],
  ["bad seconds", "plan", { plan: { ...PLAN, seconds: 45 } }],
  ["non-array cues", "plan", { plan: { ...PLAN, cues: "x" } }],
  ["session missing clock", "session", { tracker: { tauMs: 0, tempo: 1, syncedElapsedMs: 0 }, paceIdx: 1 }],
  ["session bad tempo", "session", { clock: { elapsedMs: 0 }, tracker: { tauMs: 0, tempo: 3.3, syncedElapsedMs: 0 }, paceIdx: 1 }],
  ["session bad paceIdx", "session", { clock: { elapsedMs: 0 }, tracker: { tauMs: 0, tempo: 1, syncedElapsedMs: 0 }, paceIdx: 7 }],
  ["checkin missing pendingResult", "checkin", {}],
  ["result bad completedAt", "result", { pendingResult: { activeSeconds: 5, cycles: 0, interrupted: true }, result: { completedAt: "nope", reflectionStatus: "ready", reflection: "x", recordSaved: false } }],
  ["result missing result", "result", { pendingResult: { activeSeconds: 5, cycles: 0, interrupted: true } }],
  ["result bad status", "result", { pendingResult: { activeSeconds: 5, cycles: 0, interrupted: true }, result: { completedAt: new Date().toISOString(), reflectionStatus: "nope", reflection: null, recordSaved: false } }],
]) {
  test(`reset rejects ${name}`, () => assert.equal(validateCheckpoint(resetCp(screen, data)), null));
}

test("reset session valid", () => {
  assert.ok(validateCheckpoint(resetCp("session", {
    clock: { elapsedMs: 3000, runningSince: null },
    tracker: { tauMs: 2800, tempo: 1.25, syncedElapsedMs: 3000 },
    paceIdx: 0,
  })));
});

test("reset result valid", () => {
  assert.ok(validateCheckpoint(resetCp("result", {
    pendingResult: { activeSeconds: 90, cycles: 10, interrupted: false },
    felt: "calmer",
    result: { completedAt: new Date().toISOString(), reflectionStatus: "ready", reflection: "r", recordSaved: true },
  })));
});

for (const [name, over] of [
  ["kss 0", { data: { kss: 0 } }],
  ["kss 10", { data: { kss: 10 } }],
  ["result missing metrics", { screen: "result", data: { kss: 3, record: { completedAt: new Date().toISOString() } } }],
  ["result bad inputType", { screen: "result", data: { kss: null, metrics: { trials: 1, medianMs: 1, meanSpeed: 1, lapses: 0, falseStarts: 0, inputType: "foot" }, record: { completedAt: new Date().toISOString() } } }],
]) {
  test(`alert rejects ${name}`, () => assert.equal(validateCheckpoint(alertCp() && cp(over)), null));
}

test("alert result valid", () => {
  assert.ok(validateCheckpoint(cp({
    flow: "alert", screen: "result",
    data: {
      kss: 3, metrics: { trials: 4, medianMs: 300, meanSpeed: 3, lapses: 0, falseStarts: 0, inputType: "mouse" },
      record: { completedAt: new Date().toISOString() }, recordSaved: true, note: "", noteSource: "none",
    },
  })));
});

function fakeHost({ delayMs = 0, failTimes = 0, getRes = null, getThrows = false, setThrowsSync = false } = {}) {
  const map = new Map();
  const calls = { set: [], get: 0 };
  let fails = failTimes;
  const storage = {
    async set({ key, value }) {
      if (setThrowsSync) throw new Error("sync boom");
      calls.set.push({ key, value: JSON.parse(JSON.stringify(value)) });
      await new Promise((r) => setTimeout(r, delayMs));
      if (fails > 0) { fails -= 1; const e = new Error("host down"); e.code = "unavailable"; throw e; }
      map.set(key, JSON.parse(JSON.stringify(value)));
      return { ok: true, result: null };
    },
    async get({ key }) {
      calls.get += 1;
      if (getThrows) { const e = new Error("read failed"); e.code = "denied"; throw e; }
      if (getRes !== null) return getRes(map.get(key));
      return map.get(key) ?? null;
    },
  };
  return { map, calls, storage, anna: { storage } };
}

test("save->load round trip resolves true", async () => {
  const h = fakeHost();
  const store = createCheckpointStore(h.anna);
  assert.equal(await store.save(alertCp()), true);
  const got = await store.load();
  assert.equal(got.flow, "alert");
});

test("load failure is error not empty", async () => {
  const store = createCheckpointStore(fakeHost({ getThrows: true }).anna);
  assert.equal(await store.load(), null);
  assert.equal(store.lastLoad.state, "error");
});

test("corrupt surfaces without writes", async () => {
  const h = fakeHost({ getRes: () => ({ junk: true }) });
  const store = createCheckpointStore(h.anna);
  assert.equal(await store.load(), null);
  assert.equal(store.lastLoad.state, "corrupt");
  assert.equal(h.calls.set.length, 0);
});

test("coalescing under slow host", async () => {
  const h = fakeHost({ delayMs: 25 });
  const store = createCheckpointStore(h.anna);
  store.save(cp({ id: "a" }));
  store.save(cp({ id: "b" }));
  store.save(cp({ id: "c" }));
  await store.flush();
  assert.ok(h.calls.set.length >= 1 && h.calls.set.length <= 3);
  assert.equal(h.calls.set.at(-1).value.id, "c");
  assert.equal(h.map.get(ACTIVE_TASK_KEY).id, "c");
});

test("rejected write kept for retry; retry succeeds", async () => {
  const h = fakeHost({ failTimes: 1 });
  const statuses = [];
  const store = createCheckpointStore(h.anna, { onStatus: (s) => statuses.push(s) });
  assert.equal(await store.save(cp({ id: "x" })), false);
  assert.ok(store.failed !== undefined);
  assert.equal(await store.retry(), true);
  assert.equal(h.map.get(ACTIVE_TASK_KEY).id, "x");
});

test("rejected clear leaves task recoverable; successful clear tombstones", async () => {
  const h = fakeHost();
  const store = createCheckpointStore(h.anna);
  await store.save(cp({ id: "a" }));
  h.anna.storage.set = () => Promise.reject(Object.assign(new Error("x"), { code: "down" }));
  assert.equal(await store.clear(), false);
  assert.equal(h.map.get(ACTIVE_TASK_KEY).id, "a");
  assert.ok(store.failed !== undefined);
  h.anna.storage.set = async ({ key, value }) => { value === null ? h.map.delete(key) : h.map.set(key, value); };
  assert.equal(await store.retry(), true);
  assert.equal(h.map.get(ACTIVE_TASK_KEY), undefined);
  const s2 = createCheckpointStore(h.anna);
  assert.equal(await s2.load(), null);
});

test("synchronous host throw doesn't wedge later saves", async () => {
  const h = fakeHost({ setThrowsSync: true });
  const store = createCheckpointStore(h.anna);
  await store.save(cp({ id: "a" })).catch(() => {});
  await store.flush();
  h.anna.storage.set = async ({ key, value }) => { h.map.set(key, value); };
  await store.save(cp({ id: "b" }));
  await store.flush();
  assert.equal(h.map.get(ACTIVE_TASK_KEY)?.id, "b");
});

test("disconnected reports not saved", async () => {
  const statuses = [];
  const store = createCheckpointStore(null, { onStatus: (s) => statuses.push(s) });
  await store.save(cp());
  await store.flush();
  assert.ok(statuses.includes("disconnected"));
  assert.ok(!statuses.includes("saved"));
});

test("invalid checkpoint -> onStatus error, no write, resolves false", async () => {
  const h = fakeHost();
  const statuses = [];
  const store = createCheckpointStore(h.anna, { onStatus: (s) => statuses.push(s) });
  assert.equal(await store.save({ version: 99 }), false);
  assert.equal(h.calls.set.length, 0);
  assert.ok(statuses.includes("error"));
});

test("snapshot frozen at save", async () => {
  const h = fakeHost();
  const store = createCheckpointStore(h.anna);
  const c = cp({ data: { prep: { ...PREP, reply: "draft" }, pause: null } });
  store.save(c);
  c.data.prep.reply = "MUTATED";
  await store.flush();
  assert.equal(h.map.get(ACTIVE_TASK_KEY).data.prep.reply, "draft");
});

test("flush reflects last write outcome", async () => {
  const h = fakeHost({ failTimes: 1 });
  const store = createCheckpointStore(h.anna);
  await store.save(cp({ id: "a" }));
  assert.equal(await store.flush(), false);
  await store.save(cp({ id: "b" }));
  assert.equal(await store.flush(), true);
  assert.equal(h.map.get(ACTIVE_TASK_KEY).id, "b");
});
