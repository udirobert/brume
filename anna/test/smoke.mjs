// Smoke test for the Brume Reset Anna App bundle.
// Run with: node anna/test/smoke.mjs   (requires `npm install` inside anna/)
//
// Mounts the app manifest through @anna-ai/cli's mountBundle harness,
// drives the bundle's own session/timing modules against the mock host
// runtime, and asserts the completion record round-trips through the
// ACL-gated storage calls.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { mountBundle, HostApiError } from "@anna-ai/cli/test";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
const timing = await import(join(root, "bundle", "timing.js"));
const session = await import(join(root, "bundle", "session.js"));

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
}

// --- 1. Timing port: monotonic active-time semantics -----------------------

const pattern = { inhale: 4, hold: 0, exhale: 6, holdAfterExhale: 0 };
let clock = timing.createSessionClock();
clock = timing.resumeSessionClock(clock, 1_000);

// 7s of active time -> 3s into the 6s exhale of cycle 0, floored duration.
let snap = timing.sampleSessionTiming(clock, pattern, 8_000);
ok("duration floors to active seconds", snap.duration === 7);
ok("phase at 7s is exhale", snap.currentPhase === "exhale");
ok("phase progress 50% into exhale", Math.abs(snap.phaseProgress - 50) < 1e-9);
ok("zero full cycles at 7s", snap.cycleCount === 0);

// Pause at t=8s (7s accrued), stay paused 60s wall-clock, resume at t=68s.
// Active time must freeze at 7s while paused and pick up the same phase.
clock = timing.pauseSessionClock(clock, 8_000);
snap = timing.sampleSessionTiming(clock, pattern, 68_000);
ok("paused clock does not accrue", snap.duration === 7);
ok("paused phase preserved (exhale)", snap.currentPhase === "exhale");
clock = timing.resumeSessionClock(clock, 68_000);
snap = timing.sampleSessionTiming(clock, pattern, 69_500);
ok("resume continues phase fraction", snap.duration === 8);
ok("resume stays in exhale", snap.currentPhase === "exhale");
ok("resume preserves exhale fraction (75%)", Math.abs(snap.phaseProgress - 75) < 1e-9);

// Full cycles only: 22 active seconds = 2 full 10s cycles + 2s into cycle 3.
clock = { elapsedMs: 22_000, runningSince: 100_000 };
snap = timing.sampleSessionTiming(clock, pattern, 100_000);
ok("cycleCount counts full cycles only", snap.cycleCount === 2);
ok("offset 2s into cycle 3 is inhale", snap.currentPhase === "inhale");

// --- 2. Harness: manifest ACL + storage round-trip -------------------------

const harness = await mountBundle({ manifest });
ok("acl grants storage.set", harness.acl.allowed.has("storage.set"));
ok("acl grants storage.get", harness.acl.allowed.has("storage.get"));
ok("acl grants llm.complete", harness.acl.allowed.has("llm.complete"));
ok("acl does not grant tools.invoke", !harness.acl.allowed.has("tools.invoke"));

// Adapt the mock runtime to the real SDK call shape used by the bundle:
// anna.storage.set({key, value, scope}) -> runtime.call("storage","set",args),
// anna.llm.complete(req) -> runtime.call("llm","complete",req).
const anna = {
  storage: {
    set: (args) => harness.runtime.call("storage", "set", args),
    get: (args) => harness.runtime.call("storage", "get", args),
  },
  llm: {
    complete: (args) => harness.runtime.call("llm", "complete", args),
  },
};

// Other undeclared namespaces are still denied (production-parity ACL).
await assert.rejects(
  () => harness.runtime.call("llm", "stream", {}),
  (e) => e instanceof HostApiError && e.code === "DENIED",
);
passed += 1;
console.log(`ok ${passed} - undeclared llm.stream denied by ACL`);

// --- 3. Completion record write + read --------------------------------------

const record = session.buildCompletionRecord({
  activeSeconds: 90,
  cycles: 9,
  interrupted: false,
  now: Date.UTC(2026, 9, 17, 12, 0, 0),
});
ok("record pattern is the Reset routine", record.pattern === session.PATTERN.name);
ok("record carries ISO completedAt", record.completedAt === "2026-10-17T12:00:00.000Z");
ok("record interrupted flag is boolean", record.interrupted === false);

const key = await session.saveCompletionRecord(anna, record);
ok("record written under reset/sessions/", key.startsWith("reset/sessions/"));

const setCalls = harness.calls.byNs("storage.set");
ok("two storage.set calls (session key + last)", setCalls.length === 2);
ok(
  "writes request user scope",
  setCalls.every((c) => c.args && c.args.scope === "user"),
);

const stored = await anna.storage.get({ key, scope: "user" });
assert.deepEqual(stored, record, "stored record matches written shape");
passed += 1;
console.log(`ok ${passed} - stored record matches written shape`);

const last = await session.loadLastRecord(anna);
assert.deepEqual(last, record, "reset/last mirrors the completion record");
passed += 1;
console.log(`ok ${passed} - reset/last mirrors the completion record`);

// Interrupted run still records (factual record, not a score).
const early = session.buildCompletionRecord({
  activeSeconds: 12,
  cycles: 1,
  interrupted: true,
  now: Date.UTC(2026, 9, 17, 12, 30, 0),
});
assert.equal(early.interrupted, true);
assert.equal(early.activeSeconds, 12);
passed += 1;
console.log(`ok ${passed} - interrupted record is factual`);

// --- 4. llm.complete closing line ------------------------------------------
//
// The harness ships a default "llm.complete" mock that echoes the prompt
// back as `<MOCK LLM: ...>` with the production response shape. Assert the
// bundle issues the call with the expected args, extracts the returned
// line, and falls back cleanly on denial / failure / timeout / no SDK.

const facts = { activeSeconds: 90, cycles: 9, interrupted: false };
harness.calls.clear();
const line = await session.fetchClosingLine(anna, facts);
const llmCalls = harness.calls.byNs("llm.complete");
ok("exactly one llm.complete call per completion", llmCalls.length === 1);

const req = llmCalls[0].args;
ok("request is a single user message", Array.isArray(req.messages) && req.messages.length === 1);
ok("message role is user", req.messages[0].role === "user");
ok("message content is a text block", req.messages[0].content?.type === "text");
const prompt = req.messages[0].content.text;
ok("prompt carries the pattern name", prompt.includes(session.PATTERN.name));
ok("prompt carries active seconds", prompt.includes("90 seconds"));
ok("prompt carries cycles", prompt.includes("9"));
ok("prompt carries the interrupted flag", prompt.includes("Ended early: no"));
ok("prompt asks for <=15 words", prompt.includes("15 words"));
ok("maxTokens is set under the sync ceiling", req.maxTokens === 64);
// The default mock echoes the (60-char-truncated) prompt, so a successful
// call returns the mock line rather than the fixed fallback.
ok(
  "model line is returned on success",
  line === `<MOCK LLM: ${prompt.slice(0, 60)}…>`,
);

// Denied path: a manifest without the llm grant makes the dispatcher
// reject with DENIED — the helper must still resolve the fallback line.
const deniedHarness = await mountBundle({
  manifest: {
    ...manifest,
    ui: { ...manifest.ui, host_api: { storage: ["get", "set"] } },
  },
});
const deniedAnna = {
  llm: { complete: (args) => deniedHarness.runtime.call("llm", "complete", args) },
};
const deniedLine = await session.fetchClosingLine(deniedAnna, facts);
ok("llm denied resolves fallback line", deniedLine === session.FALLBACK_CLOSING_LINE);
ok(
  "denied call is logged as denied",
  deniedHarness.calls.byNs("llm.complete")[0]?.outcome === "denied",
);

// Failure path: a throwing mock (quota_exceeded / transport / llm_disabled).
harness.mock("llm.complete", () => {
  throw new HostApiError("quota_exceeded", "quota exceeded");
});
const failedLine = await session.fetchClosingLine(anna, facts);
ok("llm failure resolves fallback line", failedLine === session.FALLBACK_CLOSING_LINE);

// Timeout path: a mock that never settles; raced with a short test timeout.
harness.mock("llm.complete", () => new Promise(() => {}));
const timedOutLine = await session.fetchClosingLine(anna, facts, { timeoutMs: 50 });
ok("llm timeout resolves fallback line", timedOutLine === session.FALLBACK_CLOSING_LINE);

// No-SDK path (standalone preview outside Anna).
const noSdkLine = await session.fetchClosingLine(null, facts);
ok("no SDK resolves fallback line", noSdkLine === session.FALLBACK_CLOSING_LINE);

// Restore the default-shaped mock for cleanliness.
harness.mock("llm.complete", () => ({
  role: "assistant",
  content: { type: "text", text: "Carry this quiet into whatever comes next." },
  model: "mock-model",
  stopReason: "endTurn",
  usage: { inputTokens: 10, outputTokens: 9, totalTokens: 19 },
}));

// Factual storage write still happens alongside the llm call.
harness.calls.clear();
const factsRecord = session.buildCompletionRecord({
  activeSeconds: facts.activeSeconds,
  cycles: facts.cycles,
  interrupted: facts.interrupted,
  now: Date.UTC(2026, 9, 17, 13, 0, 0),
});
const llmPromise = session.fetchClosingLine(anna, facts);
const writePromise = session.saveCompletionRecord(anna, factsRecord);
const [restoredLine, restoredKey] = await Promise.all([llmPromise, writePromise]);
ok("closing line + storage write proceed together", restoredLine.length > 0 && restoredKey.startsWith("reset/sessions/"));
ok(
  "completion still writes storage",
  harness.calls.byNs("storage.set").length === 2,
);
ok(
  "completion still calls llm.complete",
  harness.calls.byNs("llm.complete").length === 1,
);

console.log(`\n${passed} checks passed`);
