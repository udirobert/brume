import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const {
  parsePreparation,
  parseRehearsal,
  requestPreparation,
  requestRehearsal,
} = await import(join(here, "..", "bundle", "preparation.js"));

const PLAN = {
  kind: "plan",
  opening: "I'd like to talk about next quarter's workload.",
  keyPoint: "The deadline needs two more people.",
  approach: "Open with the shared goal, then name the constraint.",
  objection: "Why can't the current team absorb it?",
  response: "Here's what slips if we keep the same team.",
  nextStep: "Can we review staffing together this week?",
};

const planJson = (over = {}) => JSON.stringify({ ...PLAN, ...over });

test("valid plan parses with all fields", () => {
  const v = parsePreparation(planJson());
  assert.equal(v.kind, "plan");
  for (const k of ["opening", "keyPoint", "approach", "objection", "response", "nextStep"]) {
    assert.equal(v[k], PLAN[k]);
  }
});

test("fenced JSON parses", () => {
  const v = parsePreparation("```json\n" + planJson() + "\n```");
  assert.equal(v?.kind, "plan");
});

test("clarify parses once", () => {
  const v = parsePreparation(JSON.stringify({ kind: "clarify", question: "Who is in the room?" }));
  assert.deepEqual(v, { kind: "clarify", question: "Who is in the room?" });
});

test("second clarify rejected when clarificationUsed", () => {
  const v = parsePreparation(
    JSON.stringify({ kind: "clarify", question: "Who is in the room?" }),
    { clarificationUsed: true },
  );
  assert.equal(v, null);
});

for (const [name, raw] of [
  ["plain prose", "Here is your preparation, good luck!"],
  ["malformed object", "{opening: 'hi',"],
  ["array", JSON.stringify([PLAN])],
  ["empty", ""],
  ["null", "null"],
  ["missing field", planJson({ nextStep: undefined })],
  ["empty field", planJson({ approach: "   " })],
  ["non-string field", planJson({ keyPoint: 42 })],
  ["over-cap opening", planJson({ opening: "x".repeat(400) })],
  ["health claim", planJson({ response: "This will lower your anxiety before the talk." })],
  ["unknown kind", JSON.stringify({ kind: "essay", text: "hi" })],
  ["over-cap question", JSON.stringify({ kind: "clarify", question: "q".repeat(200) })],
]) {
  test(`rejects ${name}`, () => {
    assert.equal(parsePreparation(raw), null);
  });
}

test("rehearsal parses", () => {
  const v = parseRehearsal(
    JSON.stringify({
      adjustment: "Name the constraint before the ask.",
      response: "Revised wording.",
      nextStep: "Propose a follow-up.",
    }),
  );
  assert.equal(v.adjustment, "Name the constraint before the ask.");
  assert.equal(v.response, "Revised wording.");
});

test("rehearsal rejects missing field", () => {
  assert.equal(parseRehearsal(JSON.stringify({ adjustment: "x", response: "y" })), null);
});

function fakeAnna(result) {
  const calls = [];
  return {
    calls,
    llm: {
      complete: (req) => {
        calls.push(req);
        return Promise.resolve(
          typeof result === "function" ? result(req) : result,
        );
      },
    },
  };
}

const llmResult = (text) => ({
  role: "assistant",
  content: { type: "text", text },
  model: "mock-model",
});

test("requestPreparation returns value + model", async () => {
  const anna = fakeAnna(llmResult(planJson()));
  const { value, model } = await requestPreparation(anna, {
    event: "review with my manager",
    goal: "realistic timeline",
    keyPoint: "",
    kind: "meeting",
    clarification: null,
    clarificationUsed: false,
  });
  assert.equal(value.kind, "plan");
  assert.equal(model, "mock-model");
  assert.equal(anna.calls.length, 1);
  const req = anna.calls[0];
  assert.equal(req.maxTokens, 1800);
  assert.equal(req.messages.length, 2);
  const payload = JSON.parse(req.messages[1].content.text);
  assert.equal(payload.event, "review with my manager");
  assert.equal(payload.goal, "realistic timeline");
  assert.equal(payload.clarificationUsed, false);
});

test("requestPreparation throws unavailable without host", async () => {
  await assert.rejects(() => requestPreparation(null, {}), /Anna's AI/);
  try {
    await requestPreparation({}, {});
    assert.fail("should throw");
  } catch (e) {
    assert.equal(e.code, "unavailable");
  }
});

test("requestPreparation timeout", async () => {
  const anna = { llm: { complete: () => new Promise(() => {}) } };
  await assert.rejects(
    () => requestPreparation(anna, {}, { timeoutMs: 30 }),
    (e) => e.code === "timeout",
  );
});

test("requestPreparation invalid reply -> invalid error, no canned success", async () => {
  const anna = fakeAnna(llmResult("sorry, I cannot help with that"));
  await assert.rejects(
    () => requestPreparation(anna, {}),
    (e) => e.code === "invalid",
  );
});

test("host error envelope surfaces its code", async () => {
  const anna = fakeAnna({ ok: false, error: { code: "quota_exceeded", message: "quota" } });
  await assert.rejects(
    () => requestPreparation(anna, {}),
    (e) => e.code === "quota_exceeded",
  );
});

test("requestRehearsal payload includes edited plan and reply", async () => {
  const anna = fakeAnna(
    llmResult(JSON.stringify({
      adjustment: "Tighten the ask.",
      response: "Better wording.",
      nextStep: "Close with the question.",
    })),
  );
  const editedPlan = { ...PLAN, opening: "EDITED opening", approach: "EDITED approach" };
  delete editedPlan.kind;
  const { value } = await requestRehearsal(anna, {
    event: "budget ask",
    goal: "approval",
    keyPoint: "cost is fixed",
    clarification: { question: "Who decides?", answer: "Finance" },
    plan: editedPlan,
    reply: "MY REPLY to the pushback",
  });
  assert.equal(value.adjustment, "Tighten the ask.");
  const req = anna.calls[0];
  assert.equal(req.maxTokens, 1200);
  const payload = JSON.parse(req.messages[1].content.text);
  assert.equal(payload.plan.opening, "EDITED opening");
  assert.equal(payload.plan.approach, "EDITED approach");
  assert.equal(payload.reply, "MY REPLY to the pushback");
  assert.equal(payload.clarification.answer, "Finance");
});

test("requestRehearsal timeout surfaces", async () => {
  const anna = { llm: { complete: () => new Promise(() => {}) } };
  await assert.rejects(
    () => requestRehearsal(anna, {}, { timeoutMs: 30 }),
    (e) => e.code === "timeout",
  );
});
