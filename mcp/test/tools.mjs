// Contract tests for the MCP tools — same plan contract as the Anna
// executa, exercised through anna/bundle/plan.js (the shared file).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateAgentPlan,
  fallbackPlan,
  effectiveLengthSeconds,
  phaseWord,
  cleanReflection,
  HEALTH_CLAIM_RE,
} from "../../anna/bundle/plan.js";

const GOOD = {
  context: "writing a difficult email",
  pattern: "box",
  seconds: 120,
  title: "A square breath",
  opening: "Four even sides to gather your attention.",
  cues: ["Notice your feet on the floor", "Sit tall, stay easy"],
  why: "An even structure suits getting ready for focused work.",
};

test("a well-formed agent plan validates with planSource agent", () => {
  const plan = validateAgentPlan(GOOD);
  assert.equal(plan.pattern, "box");
  assert.equal(plan.seconds, 120);
  assert.equal(plan.planSource, "agent");
  assert.deepEqual(plan.cues, GOOD.cues);
});

test("missing or unknown pattern falls back to the deterministic plan", () => {
  assert.equal(validateAgentPlan({ ...GOOD, pattern: "wim-hof" }), null);
  const fb = fallbackPlan("about to present to the board");
  assert.ok(["cyclic-sigh", "long-exhale", "box", "steady"].includes(fb.pattern));
  assert.equal(fb.planSource, "fallback");
});

test("health claims in agent text are stripped", () => {
  const plan = validateAgentPlan({
    ...GOOD,
    opening: "This is proven to lower your cortisol and calm your nerves.",
  });
  if (plan) assert.ok(!HEALTH_CLAIM_RE.test(plan.opening));
  assert.ok(HEALTH_CLAIM_RE.test("proven to lower your cortisol"));
});

test("breath-narrating cues are refilled from canned cues", () => {
  const plan = validateAgentPlan({ ...GOOD, cues: ["Breathe in 4 counts"] });
  if (plan) assert.ok(!/breathe|in|out|hold|\d/i.test(plan.cues.join(" ")));
});

test("length snaps to whole cycles and phases carry words", () => {
  const { cycles, effectiveSeconds } = effectiveLengthSeconds("box", 90);
  assert.equal(effectiveSeconds % 16, 0);
  assert.ok(cycles >= 1);
  assert.equal(phaseWord("box", "pause"), "Hold");
  assert.equal(phaseWord("steady", "pause"), "Rest");
});

test("reflection cleaning drops health claims and meta notes", () => {
  assert.equal(cleanReflection("This healed your anxiety."), "Take a moment before you begin again.");
  assert.equal(cleanReflection("Nice pause. (19 words)"), "Nice pause.");
});
