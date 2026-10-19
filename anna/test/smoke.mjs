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
const planCases = JSON.parse(await readFile(join(root, "test", "plan-cases.json"), "utf8"));
const timing = await import(join(root, "bundle", "timing.js"));
const plan = await import(join(root, "bundle", "plan.js"));
const alert = await import(join(root, "bundle", "alertness.js"));
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

// --- 1b. Tempo: mid-session pace change (progress-preserving apply) -------
//
// The SessionClock keeps real active elapsed; a tempo factor stretches
// pattern-time. Switching tempo mid-phase must keep the phase and its
// progress fraction continuous, and must not corrupt duration/cycleCount.

clock = timing.createSessionClock();
clock = timing.resumeSessionClock(clock, 1_000);
let tracker = timing.createTempoTracker();

// 7s in: 3s into the 6s exhale of cycle 0 (50% progress) at tempo 1.
tracker = timing.syncTempoTracker(tracker, clock, 8_000);
snap = timing.sampleSessionTimingWithTempo(clock, tracker, pattern, 8_000);
ok("tempo 1 matches base sampling", snap.currentPhase === "exhale"
  && Math.abs(snap.phaseProgress - 50) < 1e-9 && snap.duration === 7);

// Switch to 1.25x (slower) at the same instant: phase + progress hold.
tracker = timing.setTempo(tracker, clock, 8_000, 1.25);
snap = timing.sampleSessionTimingWithTempo(clock, tracker, pattern, 8_000);
ok("tempo switch preserves phase", snap.currentPhase === "exhale");
ok("tempo switch preserves phase progress", Math.abs(snap.phaseProgress - 50) < 1e-9);
ok("tempo switch does not change duration", snap.duration === 7);
ok("tempo switch does not change cycleCount", snap.cycleCount === 0);

// 3 real seconds later at 1.25x: pattern-time advanced 3/1.25 = 2.4s,
// so exhale ended after 3 real s of the remaining 3 -> 5.4s into
// pattern-time exhale offset... verify phase boundary lands later:
// remaining exhale was 3s of pattern-time = 3.75 real seconds.
snap = timing.sampleSessionTimingWithTempo(clock, tracker, pattern, 9_000);
ok("slower tempo keeps exhale going past base boundary", snap.currentPhase === "exhale");
snap = timing.sampleSessionTimingWithTempo(clock, tracker, pattern, 12_000);
// at t=12s real, tau = 7 + 4/1.25 = 10.2s -> just into cycle 1 inhale
ok("exhale ends at stretched boundary", snap.currentPhase === "inhale");
ok("cycleCount advanced exactly once", snap.cycleCount === 1);
ok("duration is real elapsed seconds", snap.duration === 11);

// Faster tempo 0.8x: phases end sooner in real time.
tracker = timing.setTempo(tracker, clock, 12_000, 0.8);
snap = timing.sampleSessionTimingWithTempo(clock, tracker, pattern, 12_000);
ok("faster switch preserves phase + progress", snap.currentPhase === "inhale"
  && Math.abs(snap.phaseProgress - 5) < 1e-9);

// Paused clock freezes pattern-time too (elapsed is constant while paused).
const pausedClock = timing.pauseSessionClock(clock, 12_000);
tracker = timing.syncTempoTracker(tracker, pausedClock, 40_000);
snap = timing.sampleSessionTimingWithTempo(pausedClock, tracker, pattern, 40_000);
ok("paused tempo session does not accrue pattern-time", snap.currentPhase === "inhale"
  && Math.abs(snap.phaseProgress - 5) < 1e-9 && snap.duration === 11);

// Invalid tempo rejected.
assert.throws(() => timing.setTempo(tracker, clock, 13_000, 0), RangeError);
passed += 1;
console.log(`ok ${passed} - zero/invalid tempo rejected`);

// --- 1c. Topup phase (cyclic sigh): sits between inhale and hold ----------

const sigh = { inhale: 2, topup: 1, hold: 0, exhale: 6, holdAfterExhale: 0 };
snap = timing.sampleSessionTiming(
  { elapsedMs: 2_500, runningSince: null }, sigh, 0,
);
ok("topup phase reached after inhale", snap.currentPhase === "topup");
ok("topup progress 50%", Math.abs(snap.phaseProgress - 50) < 1e-9);
snap = timing.sampleSessionTiming(
  { elapsedMs: 3_500, runningSince: null }, sigh, 0,
);
ok("exhale after topup", snap.currentPhase === "exhale");
ok("sigh cycle is 9s", timing.cycleDurationSeconds(sigh) === 9);
snap = timing.sampleSessionTiming(
  { elapsedMs: 9_500, runningSince: null }, sigh, 0,
);
ok("sigh cycle 1 starts at 9s", snap.cycleCount === 1 && snap.currentPhase === "inhale");

// Box: hold phases appear on both sides of the exhale.
const box = { inhale: 4, topup: 0, hold: 4, exhale: 4, holdAfterExhale: 4 };
snap = timing.sampleSessionTiming(
  { elapsedMs: 5_000, runningSince: null }, box, 0,
);
ok("box mid-cycle is hold", snap.currentPhase === "hold");
snap = timing.sampleSessionTiming(
  { elapsedMs: 14_000, runningSince: null }, box, 0,
);
ok("box closes with a pause", snap.currentPhase === "pause");

// Tempo path treats topup like any other phase (uniform stretch).
clock = { elapsedMs: 0, runningSince: 0 };
tracker = timing.createTempoTracker();
tracker = timing.setTempo(tracker, clock, 2_500, 2.0); // 2x slower mid-topup
snap = timing.sampleSessionTimingWithTempo(clock, tracker, sigh, 2_500);
ok("tempo switch inside topup preserves phase + progress",
  snap.currentPhase === "topup" && Math.abs(snap.phaseProgress - 50) < 1e-9);

// --- 1d. Plan contract: shared fixture drives both JS and Python -----------

for (const tc of planCases.model_outputs) {
  const got = plan.parseModelPlan(tc.raw);
  if (tc.expect === "fallback") {
    ok(`plan "${tc.name}" falls back`, got === null);
    continue;
  }
  assert.ok(got, `plan "${tc.name}" should parse`);
  passed += 1;
  console.log(`ok ${passed} - plan "${tc.name}" parses`);
  for (const k of ["pattern", "seconds", "planSource", "title", "opening", "why"]) {
    if (tc.expect[k] !== undefined) {
      assert.equal(got[k], tc.expect[k], `${tc.name}.${k}`);
    }
  }
  if (tc.expect.cues) assert.deepEqual(got.cues, tc.expect.cues);
  if (tc.expect.cuesForbidden)
    assert.ok(got.cues.every((c) => !tc.expect.cuesForbidden.some((f) => c.includes(f))), `${tc.name}.cues forbidden`);
  const minCues = tc.expect.minCues ?? 2;
  assert.ok(got.cues.length >= minCues && got.cues.length <= 3, `${tc.name}.cues`);
  assert.ok(got.cues.every((c) => c.length <= 60), `${tc.name}.cues length`);
  assert.ok(!/[{}\u{1F300}-\u{1FAFF}]/u.test(got.title + got.opening + got.why), `${tc.name} clean text`);
  passed += 1;
  console.log(`ok ${passed} - plan "${tc.name}" validates`);
}

for (const tc of planCases.agent_args ?? []) {
  const got = plan.validateAgentPlan(tc.args);
  if (tc.expect === null) {
    ok(`agent "${tc.name}" -> null`, got === null);
    continue;
  }
  assert.ok(got, `agent "${tc.name}"`);
  for (const k of ["pattern", "seconds", "planSource", "title"])
    if (tc.expect[k] !== undefined) assert.equal(got[k], tc.expect[k], `${tc.name}.${k}`);
  if (tc.expect.cues) assert.deepEqual(got.cues, tc.expect.cues);
  if (tc.expect.cuesForbidden)
    assert.ok(got.cues.every((c) => !tc.expect.cuesForbidden.some((f) => c.includes(f))), `${tc.name} cues`);
  if (tc.expect.titleForbidden)
    assert.ok(!tc.expect.titleForbidden.some((f) => got.title.includes(f)), `${tc.name} title`);
  passed += 1;
  console.log(`ok ${passed} - agent "${tc.name}"`);
}

for (const tc of planCases.cycle_snap ?? []) {
  const r = plan.effectiveLengthSeconds(tc.pattern, tc.seconds);
  ok(`cycle snap ${tc.pattern} ${tc.seconds}s`, r.cycles === tc.cycles && r.effectiveSeconds === tc.effectiveSeconds);
}

for (const tc of planCases.phase_words ?? []) {
  ok(`phase word ${tc.pattern} ${tc.phase}`, plan.phaseWord(tc.pattern, tc.phase) === tc.word);
}

for (const tc of planCases.fallback_contexts) {
  const fb = plan.fallbackPlan(tc.context);
  ok(
    `fallback "${tc.context.slice(0, 40) || "(empty)"}" -> ${tc.pattern}`,
    fb.pattern === tc.pattern && fb.seconds === tc.seconds && fb.planSource === "fallback",
  );
}

// --- Alertness metrics (pure, bundle/alertness.js) -------------------------
{
  const m = alert.computeMetrics([
    { rtMs: 250, inputType: "mouse" },
    { rtMs: 300, inputType: "touch" },
    { rtMs: 350, inputType: "mouse" },
    { rtMs: 620, inputType: "mouse" },
    { falseStart: true, inputType: "keyboard" },
  ]);
  ok("alert metrics trials", m.trials === 4);
  ok("alert metrics median", m.medianMs === 325);
  ok("alert metrics lapses", m.lapses === 1);
  ok("alert metrics falseStarts", m.falseStarts === 1);
  ok("alert metrics inputType majority", m.inputType === "mouse");
  ok("alert metrics meanSpeed", m.meanSpeed > 0);

  // baseline: needs >=3 same-inputType checks
  const prior = [
    { medianMs: 300, inputType: "mouse" },
    { medianMs: 320, inputType: "mouse" },
    { medianMs: 310, inputType: "mouse" },
    { medianMs: 200, inputType: "touch" },
  ];
  ok("baseline needs 3", alert.baselineMedian(prior.slice(0, 2), "mouse") === null);
  ok("baseline median", alert.baselineMedian(prior, "mouse") === 310);
  ok("baseline ignores other inputType", alert.baselineMedian(prior, "touch") === null);
  // window: uses up to 10
  const many = Array.from({ length: 12 }, (_, i) => ({ medianMs: 300 + i, inputType: "mouse" }));
  ok("baseline window 10", alert.baselineMedian(many, "mouse") !== null);

  // bands
  ok("band sharper", alert.bandFor(280, 0, 310) === "sharper than usual");
  ok("band usual", alert.bandFor(310, 0, 310) === "about your usual");
  ok("band slower", alert.bandFor(350, 0, 310) === "slower than usual");
  ok("band much slower +20%", alert.bandFor(380, 0, 310) === "much slower than usual");
  ok("band lapses>=3 forces much slower", alert.bandFor(280, 3, 310) === "much slower than usual");
  ok("band null baseline", alert.bandFor(300, 0, null) === null);

  const sum = alert.updateAlertSummary(null, { completedAt: "t1", medianMs: 300, lapses: 0, kss: 3, inputType: "mouse" });
  ok("alert summary recent", sum.recent.length === 1 && sum.recent[0].medianMs === 300);

  const np = alert.alertnessNotePrompt({ metrics: m, baseline: 310, band: "about your usual", kss: 5, checkCount: 4, timeOfDay: "15:30" });
  ok("alert prompt facts", np.includes("325 ms") && np.includes("15:30") && np.includes("5"));
  const np2 = alert.alertnessNotePrompt({ metrics: m, baseline: null, band: null, kss: null, checkCount: 1, timeOfDay: "09:10" });
  ok("alert prompt no baseline", np2.includes("check 1 of the 3") && np2.includes("not given"));
}

// Plan prompt shape (the verbatim contract with the model).
const p1 = plan.buildPlanPrompt("big call soon", null);
ok("plan prompt names the library", p1.includes("cyclic-sigh") && p1.includes("box"));
ok("plan prompt embeds the context", p1.includes('"big call soon"'));
ok("no history paragraph without ratings", !p1.includes("worked for them"));
const p2 = plan.buildPlanPrompt("x", "cyclic-sigh: calmer 3 of 4");
ok("history paragraph when rated", p2.includes("cyclic-sigh: calmer 3 of 4"));

// Summary aggregation + personalization gate (>=2 ratings).
let sum = plan.updateSummary(null, { pattern: "box", felt: "calmer", completedAt: "t1", activeSeconds: 60 });
sum = plan.updateSummary(sum, { pattern: "box", felt: "calmer", completedAt: "t2", activeSeconds: 90 });
sum = plan.updateSummary(sum, { pattern: "steady", felt: "wired", completedAt: "t3", activeSeconds: 30 });
ok("summary totals sessions", sum.total === 3 && sum.byPattern.box.sessions === 2);
ok("summary counts ratings", sum.byPattern.box.calmer === 2 && sum.byPattern.steady.wired === 1);
ok("recent capped + newest first", sum.recent.length === 3 && sum.recent[0].completedAt === "t3");
ok("personalization needs >=2 ratings",
  plan.personalizationFromSummary(sum) === "box: calmer 2 of 2");
ok("no personalization under 2 ratings",
  plan.personalizationFromSummary({ byPattern: { box: { calmer: 1, same: 0, wired: 0 } } }) === null);

// Reflection cleaning.
ok("reflection strips wrapping quotes", plan.cleanReflection('"Head back in gently."') === "Head back in gently.");
ok("json-ish reflection falls back", plan.cleanReflection('{"note":"x"}') === plan.FALLBACK_REFLECTION);
ok("empty reflection falls back", plan.cleanReflection("   ") === plan.FALLBACK_REFLECTION);
const rp = plan.buildReflectionPrompt({ context: "call", patternName: "Box", activeSeconds: 30, plannedSeconds: 120, cycles: 2, interrupted: true, felt: "wired" });
ok("reflection prompt carries facts", rp.includes("still wired") && rp.includes("ended early: yes"));
for (const tc of planCases.reflection_outputs ?? []) {
  const want = tc.expect === "FALLBACK" ? plan.FALLBACK_REFLECTION : tc.expect;
  ok(`reflection "${tc.name}"`, plan.cleanReflection(tc.raw) === want);
}

// --- 2. Harness: manifest ACL + storage round-trip -------------------------

const harness = await mountBundle({ manifest });
ok("acl grants storage.set", harness.acl.allowed.has("storage.set"));
ok("acl grants storage.get", harness.acl.allowed.has("storage.get"));
ok("acl grants storage.list", harness.acl.allowed.has("storage.list"));
ok("acl grants llm.complete", harness.acl.allowed.has("llm.complete"));
ok("acl grants llm.catalog", harness.acl.allowed.has("llm.catalog"));
// audio.* / mobile.* are declared in the manifest for production, but
// the 0.1.59 dev harness has no bridge for them — calls deny locally
// (voice degrades to chime; haptics are fire-and-forget no-ops).
ok("manifest declares audio.speak", manifest.ui.host_api.audio?.includes("speak"));
ok("manifest declares mobile.haptics", manifest.ui.host_api.mobile?.includes("haptics"));
await assert.rejects(
  () => harness.runtime.call("audio", "speak", { text: "x" }),
  (e) => e instanceof HostApiError && e.code === "DENIED",
);
passed += 1;
console.log(`ok ${passed} - dev harness denies audio.speak (expected in 0.1.59)`);
// required_executas now declares the bundled plugin, so tools.invoke is
// ACL-granted — but only for the declared tool_id.
ok("acl grants tools.invoke via required_executas", harness.acl.allowed.has("tools.invoke"));
ok("acl allows the bundled tool_id", harness.acl.allowedTools.has("bundled:brume"));
await assert.rejects(
  () => harness.runtime.call("tools", "invoke", { tool_id: "tool-dev-other", method: "x", args: {} }),
  (e) => e instanceof HostApiError && e.code === "DENIED",
);
passed += 1;
console.log(`ok ${passed} - undeclared tool_id denied by ACL`);
await assert.rejects(
  () => harness.runtime.call("audio", "transcribe", {}),
  (e) => e instanceof HostApiError && e.code === "DENIED",
);
passed += 1;
console.log(`ok ${passed} - undeclared audio.transcribe denied by ACL`);

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

// --- 3. Completion record write + read + summary -------------------------

const record = session.buildCompletionRecord({
  context: "big call soon",
  pattern: "cyclic-sigh",
  plannedSeconds: 90,
  activeSeconds: 90,
  cycles: 10,
  interrupted: false,
  felt: "calmer",
  planSource: "ai",
  reflection: "Head back in gently.",
  source: "app",
  now: Date.UTC(2026, 9, 17, 12, 0, 0),
});
ok("record pattern id", record.pattern === "cyclic-sigh");
ok("record carries ISO completedAt", record.completedAt === "2026-10-17T12:00:00.000Z");
ok("record interrupted flag is boolean", record.interrupted === false);
ok("record carries felt + planSource + source",
  record.felt === "calmer" && record.planSource === "ai" && record.source === "app");
ok("record felt validates", session.buildCompletionRecord({
  context: "", pattern: "box", plannedSeconds: 60, activeSeconds: 60,
  cycles: 4, interrupted: false, felt: "great", planSource: "fallback",
  reflection: "", source: "app", now: 0,
}).felt === null);

const key = await session.saveCompletionRecord(anna, record);
ok("record written under reset/sessions/", key.startsWith("reset/sessions/"));

const setCalls = harness.calls.byNs("storage.set");
ok("three storage.set calls (session + last + summary)", setCalls.length === 3);
ok(
  "writes request user scope",
  setCalls.every((c) => c.args && c.args.scope === "user"),
);
const summarySet = setCalls.find((c) => c.args.key === "reset/summary");
ok("summary written", Boolean(summarySet));
ok("summary aggregates the record",
  summarySet.args.value.byPattern["cyclic-sigh"].sessions === 1
  && summarySet.args.value.byPattern["cyclic-sigh"].calmer === 1
  && summarySet.args.value.recent.length === 1);

const stored = await anna.storage.get({ key, scope: "user" });
assert.deepEqual(stored, record, "stored record matches written shape");
passed += 1;
console.log(`ok ${passed} - stored record matches written shape`);

const last = await session.loadLastRecord(anna);
assert.deepEqual(last, record, "reset/last mirrors the completion record");
passed += 1;
console.log(`ok ${passed} - reset/last mirrors the completion record`);

const storedSummary = await session.loadSummary(anna);
ok("summary reads back", storedSummary.total === 1);

// Interrupted run still records (factual record, not a score).
const early = session.buildCompletionRecord({
  context: "",
  pattern: "box",
  plannedSeconds: 120,
  activeSeconds: 12,
  cycles: 1,
  interrupted: true,
  felt: null,
  planSource: "fallback",
  reflection: "",
  source: "app",
  now: Date.UTC(2026, 9, 17, 12, 30, 0),
});
assert.equal(early.interrupted, true);
assert.equal(early.activeSeconds, 12);
passed += 1;
console.log(`ok ${passed} - interrupted record is factual`);

// --- 4. llm.complete plan + reflection ------------------------------------
//
// The harness ships a default "llm.complete" mock that echoes the prompt
// back as `<MOCK LLM: ...>` with the production response shape. Assert the
// bundle issues the calls with the expected args, and that parse/validate
// and cleaning produce the right fallbacks on denial/failure/timeout.

const facts = {
  context: "big call soon",
  patternName: "Cyclic sigh",
  activeSeconds: 90,
  plannedSeconds: 90,
  cycles: 10,
  interrupted: false,
  felt: "calmer",
};
harness.calls.clear();
const line = await session.fetchReflection(anna, facts);
const llmCalls = harness.calls.byNs("llm.complete");
ok("exactly one llm.complete call per reflection", llmCalls.length === 1);

const req = llmCalls[0].args;
ok("request is a single user message", Array.isArray(req.messages) && req.messages.length === 1);
ok("message role is user", req.messages[0].role === "user");
ok("message content is a text block", req.messages[0].content?.type === "text");
const prompt = req.messages[0].content.text;
ok("reflection prompt carries the pattern name", prompt.includes("Cyclic sigh"));
ok("reflection prompt carries context", prompt.includes("big call soon"));
ok("reflection prompt carries the felt word", prompt.includes("calmer"));
ok("reflection prompt asks for <=35 words", prompt.includes("35 words"));
ok("maxTokens is 120", req.maxTokens === 120);
// The default mock echoes the (60-char-truncated) prompt, so a successful
// call returns the mock line rather than the fixed fallback.
ok(
  "model line is returned on success",
  line === `<MOCK LLM: ${prompt.slice(0, 60)}…>`,
);

// fetchPlan issues one llm.complete with the plan prompt and validates.
harness.calls.clear();
const { plan: aiPlan, offline } = await session.fetchPlan(anna, { context: "big call soon", summary: null });
ok("plan issues one llm.complete", harness.calls.byNs("llm.complete").length === 1);
const planReq = harness.calls.byNs("llm.complete")[0].args;
ok("plan prompt is the verbatim contract",
  planReq.messages[0].content.text.startsWith("You plan one short guided breathing break"));
ok("plan maxTokens is 300", planReq.maxTokens === 300);
ok("mock echo does not parse -> fallback plan", offline === true && aiPlan.planSource === "fallback");

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
const deniedLine = await session.fetchReflection(deniedAnna, facts);
ok("llm denied resolves fallback line", deniedLine === session.FALLBACK_REFLECTION);
ok(
  "denied call is logged as denied",
  deniedHarness.calls.byNs("llm.complete")[0]?.outcome === "denied",
);
const deniedPlan = await session.fetchPlan(deniedAnna, { context: "focus next", summary: null });
ok("denied plan resolves fallback", deniedPlan.plan.planSource === "fallback"
  && deniedPlan.plan.pattern === "box" && deniedPlan.offline === true);

// Failure path: a throwing mock (quota_exceeded / transport / llm_disabled).
harness.mock("llm.complete", () => {
  throw new HostApiError("quota_exceeded", "quota exceeded");
});
const failedLine = await session.fetchReflection(anna, facts);
ok("llm failure resolves fallback line", failedLine === session.FALLBACK_REFLECTION);

// Timeout path: a mock that never settles; raced with a short test timeout.
harness.mock("llm.complete", () => new Promise(() => {}));
const timedOutLine = await session.fetchReflection(anna, facts, { timeoutMs: 50 });
ok("llm timeout resolves fallback line", timedOutLine === session.FALLBACK_REFLECTION);

// A successful model plan: mock returns valid plan JSON.
harness.mock("llm.complete", () => ({
  role: "assistant",
  content: { type: "text", text: planCases.model_outputs[0].raw },
  model: "mock-model",
  stopReason: "endTurn",
  usage: { inputTokens: 10, outputTokens: 9, totalTokens: 19 },
}));
const { plan: goodPlan, offline: goodOffline } = await session.fetchPlan(anna, { context: "x", summary: null });
ok("model plan parsed as ai", goodPlan.planSource === "ai"
  && goodPlan.pattern === "cyclic-sigh" && goodOffline === false);

// No-SDK path (standalone preview outside Anna).
const noSdkLine = await session.fetchReflection(null, facts);
ok("no SDK resolves fallback line", noSdkLine === session.FALLBACK_REFLECTION);
const noSdkPlan = await session.fetchPlan(null, { context: "", summary: null });
ok("no SDK plan falls back", noSdkPlan.plan.planSource === "fallback" && noSdkPlan.offline === true);

// Restore the default-shaped mock for cleanliness.
harness.mock("llm.complete", () => ({
  role: "assistant",
  content: { type: "text", text: "Carry this quiet into whatever comes next." },
  model: "mock-model",
  stopReason: "endTurn",
  usage: { inputTokens: 10, outputTokens: 9, totalTokens: 19 },
}));

// Factual storage write still happens alongside the reflection call.
harness.calls.clear();
const factsRecord = session.buildCompletionRecord({
  context: "",
  pattern: "long-exhale",
  plannedSeconds: 90,
  activeSeconds: 90,
  cycles: 9,
  interrupted: false,
  felt: null,
  planSource: "quick",
  reflection: "",
  source: "app",
  now: Date.UTC(2026, 9, 17, 13, 0, 0),
});
const reflPromise = session.fetchReflection(anna, facts);
const writePromise = session.saveCompletionRecord(anna, factsRecord);
const [restoredLine, restoredKey] = await Promise.all([reflPromise, writePromise]);
ok("reflection + storage write proceed together", restoredLine.length > 0 && restoredKey.startsWith("reset/sessions/"));
ok(
  "completion still writes storage",
  harness.calls.byNs("storage.set").length === 3,
);
ok(
  "completion still calls llm.complete",
  harness.calls.byNs("llm.complete").length === 1,
);

console.log(`\n${passed} checks passed`);
