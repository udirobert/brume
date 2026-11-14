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
  faithfulnessIssues,
  withholdUngrounded,
  preparationSource,
  rehearsalSource,
  PLAN_FACT_FIELDS,
  REHEARSAL_FACT_FIELDS,
  NEUTRAL_OBJECTION,
  faithfulnessMessage,
  groundedSpans,
  ungroundedSpans,
  scheduleQuestion,
  SCHEDULE_QUESTION,
  quotesReply,
  sayableParagraph,
  scanEntities,
  FUNCTION_WORDS,
  CARD_OPENERS,
  scanRoles,
  ROLE_NOUNS,
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

const REVIEW_SOURCE = "I manage 3 projects and I added one deadline in the same week.";

test("reviewer case: 4 projects and a Friday time are not in the input", () => {
  const source = preparationSource({ event: REVIEW_SOURCE, goal: "Keep the week workable" });
  const plan = {
    opening: "I want to talk about the four projects on my plate.",
    keyPoint: "I manage 3 projects and one new deadline.",
    approach: "Start from the week as it is.",
    objection: "Can you take 4?",
    response: "I can move the one deadline I added.",
    nextStep: "Can we meet Friday at 3pm?",
  };
  const issues = faithfulnessIssues(plan, source, PLAN_FACT_FIELDS);
  const fields = Object.fromEntries(issues.map((issue) => [issue.field, issue.spans]));
  assert.ok(fields.opening.includes("four"));
  assert.equal(fields.keyPoint, undefined);
  assert.deepEqual(fields.objection, ["4"]);
  assert.ok(fields.nextStep.includes("friday"));
  assert.ok(fields.nextStep.some((span) => span.includes("3")));
  const kept = withholdUngrounded(plan, issues);
  assert.equal(kept.opening, "");
  assert.equal(kept.keyPoint, plan.keyPoint);
  assert.equal(kept.objection, NEUTRAL_OBJECTION);
  assert.equal(kept.nextStep, "");
  const message = faithfulnessMessage(issues);
  assert.match(message, /Opening added a count/);
  assert.match(message, /Next step added a weekday and a time/);
  assert.deepEqual(groundedSpans(plan.keyPoint, source), ["one", "3"]);
  assert.equal(scheduleQuestion(source), SCHEDULE_QUESTION);
  assert.equal(scheduleQuestion("Deadline ask\nTwo more weeks"), null);
  assert.equal(scheduleQuestion(`${REVIEW_SOURCE}\nFriday`), null);
});

test("three matches a digit 3, and one-on-one is not a count", () => {
  const source = "I manage 3 projects.";
  assert.deepEqual(faithfulnessIssues({ opening: "I manage three projects." }, source, ["opening"]), []);
  assert.deepEqual(faithfulnessIssues({ opening: "Let's have a one-on-one." }, source, ["opening"]), []);
});

test("reviewer case: an invented name is withheld like an invented count", () => {
  const source = preparationSource({ event: REVIEW_SOURCE, goal: "Keep the week workable" });
  const plan = {
    opening: "Tell Priya the extra project can move.",
    keyPoint: "I manage 3 projects and one new deadline.",
    approach: "Start from the week as it is.",
    objection: "What makes this hard?",
    response: "I can move the one deadline I added.",
    nextStep: "Can we look at it this week?",
  };
  const issues = faithfulnessIssues(plan, source, PLAN_FACT_FIELDS);
  assert.deepEqual(issues, [{ field: "opening", spans: ["Priya", "extra project"] }]);
  const kept = withholdUngrounded(plan, issues);
  assert.equal(kept.opening, "");
  assert.equal(kept.keyPoint, plan.keyPoint);
  assert.match(faithfulnessMessage(issues), /Opening added a name and a motive you didn't write/);
});

test("a name the person wrote is grounded; openers and I are not names", () => {
  const named = preparationSource({ event: "I told Priya about the deadline." });
  assert.deepEqual(faithfulnessIssues({ opening: "Tell Priya the plan." }, named, ["opening"]), []);
  assert.deepEqual(faithfulnessIssues({ opening: "Priya needs the update." }, named, ["opening"]), []);
  const plain = preparationSource({ event: "I have a review coming up." });
  assert.deepEqual(faithfulnessIssues({ opening: "Can we talk about the review?" }, plain, ["opening"]), []);
  assert.deepEqual(faithfulnessIssues({ opening: "I'm ready to talk." }, plain, ["opening"]), []);
  assert.deepEqual(faithfulnessIssues({ opening: "Priya needs the update." }, plain, ["opening"]), [
    { field: "opening", spans: ["Priya"] },
  ]);
});

test("the closed FUNCTION_WORDS class opens a line without being a name", () => {
  // The grammatical core is finite and complete; a removed pronoun, modal,
  // question word or preposition would regress here.
  const closedClass = [
    "I", "Me", "My", "We", "Us", "Our", "You", "Your", "He", "Him", "His",
    "She", "Her", "It", "Its", "They", "Them", "Their", "This", "That", "These", "Those",
    "Can", "Could", "Will", "Would", "Shall", "Should", "May", "Might", "Must",
    "Is", "Are", "Was", "Were", "Am", "Be", "Been", "Being",
    "Have", "Has", "Had", "Having", "Do", "Does", "Did", "Done",
    "What", "When", "Where", "Which", "Who", "Whom", "Whose", "Why", "How",
    "And", "But", "Or", "Nor", "If", "Because", "Since", "While", "Although", "Unless",
    "To", "For", "With", "Without", "About", "On", "In", "At", "By", "From", "Of", "As",
    "The", "An", "Some", "Any", "Every", "Each", "Both", "All", "Many", "Much", "Several",
  ];
  for (const w of closedClass) {
    const names = scanEntities(`${w} we look at the plan.`).map((e) => e.token);
    assert.equal(names.includes(w), false, `function word "${w}" flagged as a name`);
  }
  for (const w of FUNCTION_WORDS) {
    const names = scanEntities(`${w} the rest of the line.`).map((e) => e.token);
    assert.equal(names.includes(w), false, `FUNCTION_WORDS entry "${w}" not exempt at start`);
  }
});

test("invented names are withheld at sentence start and mid-sentence", () => {
  const source = preparationSource({ event: "I have a review coming up." });
  const names = ["Priya", "Aisha", "Wei", "Yuki", "Marcus", "Jamal", "Sofia", "Mateo",
    "Sarah", "John", "David", "Michael", "Mary", "Anna", "Jessica", "Rachel", "Robert",
    "James", "Linda", "Patricia", "Jennifer", "Elizabeth", "Susan", "Karen", "Lisa"];
  for (const n of names) {
    assert.deepEqual(
      faithfulnessIssues({ opening: `${n} needs the update.` }, source, ["opening"]),
      [{ field: "opening", spans: [n] }], `${n} at sentence start`);
    assert.deepEqual(
      faithfulnessIssues({ opening: `Tell ${n} the plan.` }, source, ["opening"]),
      [{ field: "opening", spans: [n] }], `${n} mid-sentence`);
  }
});

test("the name-leak surface is exactly the documented openers Hope/May/Will", () => {
  // These three are frequent legitimate openers that double as given names:
  // exempt at sentence start, flagged mid-sentence. Every OTHER common given
  // name must be flagged even at sentence start — so accidentally adding a
  // name to the opener sets fails here. The comprehensive guard against the
  // corpus name set is scripts/audit-openers.mjs --check.
  const names = ["Hope", "May", "Will", "Priya", "Aisha", "Wei", "Marcus", "Sarah",
    "John", "David", "Michael", "Mary", "Anna", "Jessica", "Rachel", "Robert", "James",
    "Linda", "Patricia", "Jennifer", "Elizabeth", "Susan", "Karen", "Lisa", "Nancy",
    "Betty", "Margaret", "Sandra", "Ashley", "Kimberly", "Emily", "Donna", "Michelle",
    "Carol", "Amanda", "Dorothy", "Melissa", "Deborah", "Stephanie", "Rebecca", "Sharon",
    "Laura", "Cynthia", "Kathleen", "Amy", "Angela", "Shirley", "Brenda", "Pamela",
    "Emma", "Nicole", "Helen", "Samantha", "Katherine", "Christine", "Debra", "Carolyn",
    "Janet", "Catherine", "Maria", "Heather", "Diane", "Olivia", "Julie", "Joyce",
    "Victoria", "Ruth", "Virginia", "Lauren", "Kelly", "Christina", "Joan", "Evelyn",
    "Judith", "Andrea", "Hannah", "Megan", "Cheryl", "Jacqueline", "Martha", "Madison",
    "Teresa", "Gloria", "Sara", "Janice", "Ann", "Jean", "Abigail", "Alice", "Judy",
    "Sophia", "Grace", "Denise", "Amber", "Doris", "Marilyn", "Danielle", "Beverly",
    "Isabella", "Theresa", "Diana", "Natalie", "Brittany", "Charlotte", "Marie", "Kayla", "Alexis"];
  for (const n of names) {
    const mid = scanEntities(`Tell ${n} the plan.`).map((e) => e.token);
    assert.equal(mid.includes(n), true, `${n} mid-sentence must be a name candidate`);
    const start = scanEntities(`${n} needs the update.`).map((e) => e.token);
    assert.equal(start.includes(n), true, `${n} before "needs" is a name, including Hope/May/Will`);
  }
  assert.deepEqual(scanEntities("Will you move the deadline?").map((e) => e.token), []);
  assert.deepEqual(scanEntities("May I ask about the deadline?").map((e) => e.token), []);
  assert.deepEqual(scanEntities("Hope you're well.").map((e) => e.token), []);
  assert.ok(scanEntities("Hope can take the extra project.").some((e) => e.token === "Hope"));
  assert.ok(scanEntities("Will should hear this.").some((e) => e.token === "Will"));
  const allow = new Set([...FUNCTION_WORDS, ...CARD_OPENERS]);
  assert.deepEqual(names.filter((n) => allow.has(n)).sort(), ["Hope", "May", "Will"]);
});

test("reviewer case: an invented addressee role is withheld like a name", () => {
  // The critique's exact case: a lowercase "your manager" invents a specific
  // person the person never stated. The name gate cannot see it (not
  // capitalised); the role gate grounds it against the person's words and
  // withholds the field, exactly like an ungrounded count or name.
  const source = preparationSource({ event: REVIEW_SOURCE, goal: "Keep the week workable" });
  const opening = "Tell your manager the extra project can move.";
  const issues = faithfulnessIssues({ opening }, source, ["opening"]);
  assert.deepEqual(issues, [{ field: "opening", spans: ["manager", "extra project"] }]);
  assert.equal(withholdUngrounded({ opening }, issues).opening, "");
  assert.match(faithfulnessMessage(issues), /Opening added a role and a motive you didn't write/);
});

test("a role the person wrote is grounded; generic groups are not addressees", () => {
  const source = preparationSource({ event: REVIEW_SOURCE, goal: "Keep the week workable" });
  // The person named their manager, so "your manager" is grounded.
  const named = preparationSource({ event: "I need to tell my manager about the deadline." });
  assert.deepEqual(ungroundedSpans("Tell your manager the plan.", named), []);
  // A generic group ("the current team", "the same team") has no possessive
  // addressee signal and is kept — the blanket role tier that blanked these
  // was prototyped and rejected (~33% false positives).
  assert.deepEqual(ungroundedSpans("The current team cannot absorb it.", source), []);
  assert.deepEqual(ungroundedSpans("Here's what slips if we keep the same team.", source), []);
  // An imperative verb that doubles as a role noun ("Lead") opens the line
  // and is not an addressee.
  assert.deepEqual(ungroundedSpans("Lead with the shared goal.", source), []);
  // The same role, unstated, is withheld.
  assert.deepEqual(
    faithfulnessIssues({ opening: "Tell your manager the plan." }, source, ["opening"]),
    [{ field: "opening", spans: ["manager"] }]);
});

test("an article addressee and an ascribed motive are withheld", () => {
  const source = preparationSource({ event: REVIEW_SOURCE, goal: "Keep the week workable" });
  assert.deepEqual(ungroundedSpans("Delegate it to a colleague.", source), ["colleague"]);
  assert.deepEqual(ungroundedSpans("Tell the manager the plan.", source), ["manager"]);
  assert.deepEqual(ungroundedSpans("Tell the stakeholder it slips.", source), ["stakeholder"]);
  // A group without a possessive stays. "the team" is not an addressee.
  assert.deepEqual(ungroundedSpans("The current team cannot absorb it.", source), []);
  const named = preparationSource({ event: "I need to tell the manager about the deadline." });
  assert.deepEqual(ungroundedSpans("Tell the manager the plan.", named), []);
  assert.deepEqual(
    faithfulnessIssues({ opening: "Tell your manager, because they are behind schedule." }, source, ["opening"]),
    [{ field: "opening", spans: ["manager", "because they are behind schedule"] }]);
  assert.match(
    faithfulnessMessage(faithfulnessIssues(
      { opening: "Tell your manager, because they are behind schedule." }, source, ["opening"])),
    /role and a motive/);
});

test("scanRoles finds possessive addressees, tolerant of plural and possessive 's", () => {
  const tokens = (t) => scanRoles(t).map((r) => r.token);
  assert.deepEqual(tokens("Tell your manager the plan."), ["manager"]);
  assert.deepEqual(tokens("Ask your managers for help."), ["managers"]);
  assert.deepEqual(tokens("My manager's deadline can move."), ["manager's"]);
  assert.deepEqual(tokens("The current team cannot absorb it."), []);
  assert.deepEqual(tokens("Tell the manager the plan."), ["manager"]);
  assert.deepEqual(tokens("Delegate it to a colleague."), ["colleague"]);
  assert.deepEqual(tokens("Lead with the shared goal."), []);
  assert.equal(ROLE_NOUNS.has("manager"), true);
  assert.equal(ROLE_NOUNS.has("team"), true);
});

test("rehearsal checks the reply, not the earlier draft", () => {
  const input = {
    event: REVIEW_SOURCE,
    reply: "I can shift the one deadline.",
    plan: { opening: "Friday at 3pm", keyPoint: "4 projects" },
  };
  const source = rehearsalSource(input);
  assert.equal(source.includes("Friday"), false);
  assert.equal(source.includes("4 projects"), false);
  const issues = faithfulnessIssues(
    { adjustment: "You still have 4 projects.", response: "Let's talk Friday at 3pm.", nextStep: "Move the one deadline." },
    source,
    REHEARSAL_FACT_FIELDS,
  );
  const fields = new Set(issues.map((issue) => issue.field));
  assert.equal(fields.has("adjustment"), true);
  assert.equal(fields.has("response"), true);
  assert.equal(fields.has("nextStep"), false);
});

test("a rehearsal note has to quote the reply", () => {
  const reply = "I can shift the one deadline.";
  assert.equal(quotesReply("Keep saying I can shift the one deadline.", reply), true);
  assert.equal(quotesReply("Be specific about the deadline.", reply), false);
  assert.equal(quotesReply("ok sure", "ok sure"), true);
  assert.equal(
    sayableParagraph({
      opening: "I manage 3 projects.",
      keyPoint: "One deadline landed in the same week.",
      nextStep: "",
    }),
    "I manage 3 projects.\n\nOne deadline landed in the same week.",
  );
});

test("requestRehearsal timeout surfaces", async () => {
  const anna = { llm: { complete: () => new Promise(() => {}) } };
  await assert.rejects(
    () => requestRehearsal(anna, {}, { timeoutMs: 30 }),
    (e) => e.code === "timeout",
  );
});
