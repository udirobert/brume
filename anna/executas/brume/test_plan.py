#!/usr/bin/env python3
"""Plan-contract tests for brume_plugin.py (stdlib unittest).

Consumes anna/test/plan-cases.json — the same fixture the node smoke
test runs against bundle/plan.js — so the Python port cannot drift.

Run: python3 -m unittest test_plan -v   (from executas/brume/)
"""

import json
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import brume_plugin as bp  # noqa: E402

FIXTURE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "test", "plan-cases.json"
)


class ModelPlanCases(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(FIXTURE, encoding="utf-8") as f:
            cls.cases = json.load(f)

    def test_model_outputs(self):
        for tc in self.cases["model_outputs"]:
            with self.subTest(tc["name"]):
                got = bp.parse_model_plan(tc["raw"])
                if tc["expect"] == "fallback":
                    self.assertIsNone(got)
                    continue
                self.assertIsNotNone(got)
                exp = tc["expect"]
                for k in ("pattern", "seconds", "planSource", "title", "opening", "why"):
                    if k in exp:
                        self.assertEqual(got[k], exp[k], k)
                if "cues" in exp:
                    self.assertEqual(got["cues"], exp["cues"])
                if "whyForbidden" in exp:
                    for f in exp["whyForbidden"]:
                        self.assertNotIn(f, got["why"])
                if "cuesForbidden" in exp:
                    for f in exp["cuesForbidden"]:
                        self.assertFalse(any(f in c for c in got["cues"]), f)
                min_cues = exp.get("minCues", 2)
                self.assertGreaterEqual(len(got["cues"]), min_cues)
                self.assertLessEqual(len(got["cues"]), 3)
                self.assertTrue(all(len(c) <= 60 for c in got["cues"]))

    def test_fallback_contexts(self):
        for tc in self.cases["fallback_contexts"]:
            with self.subTest(tc["context"]):
                fb = bp.fallback_plan(tc["context"])
                self.assertEqual(fb["pattern"], tc["pattern"])
                self.assertEqual(fb["seconds"], tc["seconds"])
                self.assertEqual(fb["planSource"], "fallback")


class PlanPrompt(unittest.TestCase):
    def test_library_and_context(self):
        p = bp.build_plan_prompt("big call soon", None)
        self.assertIn("cyclic-sigh", p)
        self.assertIn("box", p)
        self.assertIn('"big call soon"', p)
        self.assertNotIn("worked for them", p)

    def test_personalization_paragraph(self):
        p = bp.build_plan_prompt("x", "cyclic-sigh: calmer 3 of 4")
        self.assertIn("cyclic-sigh: calmer 3 of 4", p)


class Summary(unittest.TestCase):
    def test_aggregation_and_gate(self):
        s = bp.update_summary(None, {"pattern": "box", "felt": "calmer",
                                     "completedAt": "t1", "activeSeconds": 60})
        s = bp.update_summary(s, {"pattern": "box", "felt": "calmer",
                                  "completedAt": "t2", "activeSeconds": 90})
        s = bp.update_summary(s, {"pattern": "steady", "felt": "wired",
                                  "completedAt": "t3", "activeSeconds": 30})
        self.assertEqual(s["total"], 3)
        self.assertEqual(s["byPattern"]["box"]["sessions"], 2)
        self.assertEqual(s["byPattern"]["box"]["calmer"], 2)
        self.assertEqual(s["byPattern"]["steady"]["wired"], 1)
        self.assertEqual(len(s["recent"]), 3)
        self.assertEqual(s["recent"][0]["completedAt"], "t3")
        self.assertEqual(bp.personalization_from_summary(s), "box: calmer 2 of 2")
        self.assertIsNone(
            bp.personalization_from_summary(
                {"byPattern": {"box": {"calmer": 1, "same": 0, "wired": 0}}}
            )
        )


class Reflection(unittest.TestCase):
    def test_clean(self):
        self.assertEqual(
            bp.clean_reflection('"Head back in gently."'), "Head back in gently."
        )
        self.assertEqual(bp.clean_reflection('{"note":"x"}'), bp.FALLBACK_REFLECTION)
        self.assertEqual(bp.clean_reflection("   "), bp.FALLBACK_REFLECTION)

    def test_fixture_agent_args(self):
        import json as _json
        with open(FIXTURE, encoding="utf-8") as f:
            cases = _json.load(f).get("agent_args", [])
        for tc in cases:
            got = bp.validate_agent_plan(tc["args"])
            if tc["expect"] is None:
                self.assertIsNone(got, tc["name"])
                continue
            exp = tc["expect"]
            for k in ("pattern", "seconds", "planSource", "title"):
                if k in exp:
                    self.assertEqual(got[k], exp[k], f"{tc['name']}.{k}")
            if "cues" in exp:
                self.assertEqual(got["cues"], exp["cues"])
            for f2 in exp.get("cuesForbidden", []):
                self.assertFalse(any(f2 in c for c in got["cues"]), f2)
            for f3 in exp.get("titleForbidden", []):
                self.assertNotIn(f3, got["title"])
            self.assertGreaterEqual(len(got["cues"]), exp.get("minCues", 2))

    def test_fixture_cycle_snap(self):
        import json as _json
        with open(FIXTURE, encoding="utf-8") as f:
            cases = _json.load(f).get("cycle_snap", [])
        for tc in cases:
            got = bp.effective_length(tc["pattern"], tc["seconds"])
            self.assertEqual((got["cycles"], got["seconds"]),
                             (tc["cycles"], tc["effectiveSeconds"]), tc)

    def test_fixture_health_filter(self):
        import json as _json
        with open(FIXTURE, encoding="utf-8") as f:
            cases = _json.load(f).get("health_filter", [])
        for tc in cases:
            self.assertEqual(bool(bp.HEALTH_CLAIM_RE.search(tc["text"])),
                             tc["expect"] == "block", tc["text"])

    def test_fixture_reflections(self):
        import json as _json
        with open(FIXTURE, encoding="utf-8") as f:
            cases = _json.load(f).get("reflection_outputs", [])
        for tc in cases:
            want = bp.FALLBACK_REFLECTION if tc["expect"] == "FALLBACK" else tc["expect"]
            self.assertEqual(bp.clean_reflection(tc["raw"]), want, tc["name"])

    def test_outcome_claim_backstop(self):
        # "worked" alone is a fact ("worked through all ten cycles"); the
        # claim forms are what the mirror of OUTCOME_CLAIM_RE must catch.
        self.assertEqual(bp.clean_reflection("It helped you calm down."), bp.FALLBACK_REFLECTION)
        self.assertEqual(bp.clean_reflection("That worked well for you."), bp.FALLBACK_REFLECTION)
        self.assertEqual(
            bp.clean_reflection("You worked through all 10 cycles."),
            "You worked through all 10 cycles.",
        )

    def test_prompt_facts(self):
        p = bp.build_reflection_prompt("call", "Box", 30, 120, 2, True, "wired")
        self.assertIn("still wired", p)
        self.assertIn("ended early: yes", p)


class InvokeContract(unittest.TestCase):
    def setUp(self):
        # No host answers reverse RPCs in tests; mark stdin EOF so the
        # bounded wait fails fast instead of sleeping out the timeout.
        bp._STDIN_EOF = True
        bp._RESET_SEGMENTS.clear()

    def tearDown(self):
        bp._STDIN_EOF = False
        bp._RESET_SEGMENTS.clear()

    def test_reset_display_blocks_and_data(self):
        bp._RESET_SEGMENTS.clear()
        out = bp.invoke_reset({"context": "big call soon", "pattern": "cyclic-sigh"}, {})
        self.assertTrue(out["success"])
        data = out["data"]
        self.assertEqual(data["pattern"], "cyclic-sigh")
        self.assertEqual(data["planSource"], "agent")
        # cyclic sigh at normal tempo: 2 in, 1 top-up, 6 out -> 9s cycle
        self.assertEqual(data["cycle_seconds"], 9.0)
        # planned 90s -> 10 cycles
        self.assertEqual(data["cycles"], 10)
        blocks = data["_display"]["blocks"]
        self.assertTrue(any("top up" in b["text"] for b in blocks))
        self.assertIn("in · 2 · 1", blocks[1]["text"])
        self.assertIn("out · 6 · 5 · 4 · 3 · 2 · 1", blocks[1]["text"])

    def test_continuation_keeps_pattern(self):
        bp._RESET_SEGMENTS.clear()
        bp.invoke_reset({"context": "x", "pattern": "box"}, {})
        out = bp.invoke_reset({"pace": "slow", "remaining_seconds": 60}, {})
        self.assertEqual(out["data"]["pattern"], "box")
        self.assertTrue(out["data"]["continuation"])
        # box at slow tempo 1.25: 4*1.25=5s per phase, 20s cycle -> 3 cycles
        self.assertEqual(out["data"]["cycles"], 3)

    def test_complete_record_shape(self):
        bp._RESET_SEGMENTS.clear()
        bp.invoke_reset({"context": "winding down", "pattern": "steady"}, {})
        # complete without a host: reverse RPCs fail -> record_written False
        out = bp.invoke_complete({"felt": "calmer"}, {})
        self.assertTrue(out["success"])
        rec = out["data"]["record"]
        self.assertEqual(rec["pattern"], "steady")
        self.assertEqual(rec["felt"], "calmer")
        self.assertEqual(rec["source"], "executa.chat")
        self.assertEqual(rec["planSource"], "agent")
        self.assertEqual(rec["reflection"], bp.FALLBACK_REFLECTION)
        self.assertFalse(out["data"]["record_written"])



REVIEWER_SENTENCE = "I manage 3 projects and I added one deadline in the same week."


class FactScanner(unittest.TestCase):
    """The scanner is a 1:1 port of scanFacts in bundle/preparation.js —
    the same fixture the node smoke test runs against the JS side."""

    @classmethod
    def setUpClass(cls):
        with open(FIXTURE, encoding="utf-8") as f:
            cls.cases = json.load(f)

    def test_fact_scan_fixture_parity(self):
        for tc in self.cases["fact_scan"]:
            with self.subTest(tc["name"]):
                got = [
                    {"kind": f["kind"], "token": f["token"], "value": f["value"]}
                    for f in bp.scan_facts(tc["text"])
                ]
                self.assertEqual(got, tc["expect"])

    def test_ungrounded_spans_match_the_window(self):
        # The same rule the window applies to a draft: a fact the source
        # does not contain is ungrounded.
        self.assertEqual(
            bp.ungrounded_spans("I want to talk about the four projects on my plate.",
                                REVIEWER_SENTENCE),
            ["four"],
        )
        self.assertEqual(
            bp.ungrounded_spans("Can we meet Friday at 3pm?", REVIEWER_SENTENCE),
            ["friday", "3pm"],
        )
        self.assertEqual(bp.ungrounded_spans("A one-on-one.", "A one-on-one."), [])


class PrepareCard(unittest.TestCase):
    """brume_prepare produces the card. Every fact the draft asserts is
    asked back — the value is masked — so the model can never be the
    oracle for the card's facts."""

    @classmethod
    def setUpClass(cls):
        with open(FIXTURE, encoding="utf-8") as f:
            cls.cases = json.load(f)

    def setUp(self):
        bp._STDIN_EOF = True
        bp._PREPARE_REQUESTS.clear()

    def tearDown(self):
        bp._STDIN_EOF = False
        bp._PREPARE_REQUESTS.clear()

    def _draft(self, **over):
        args = {
            "situation": REVIEWER_SENTENCE,
            "draft_opening": "You are juggling four projects and a new deadline in the same week.",
            "draft_key_point": "The new deadline needs two more people.",
            "draft_approach": "Open with what the deadline changed for your team.",
            "draft_objection": "We cannot take on another project right now.",
            "draft_response": "Then agree what slips and by when.",
            "draft_next_step": "Name the day you will flag the new deadline.",
        }
        args.update(over)
        return args

    def _finish(self, first, answers):
        return bp.invoke_prepare(
            {"request_id": first["data"]["request_id"], "answers": answers}, {})

    def test_first_call_asks_and_saves_nothing(self):
        out = bp.invoke_prepare(self._draft(), {})
        self.assertTrue(out["success"])
        data = out["data"]
        self.assertEqual(data["status"], "needs_input")
        self.assertTrue(data["request_id"])
        self.assertTrue(data["questions"])
        # no card fields come back before the person answers
        for banned in ("card", "opening", "nextStep"):
            self.assertNotIn(banned, data)

    def test_the_model_cannot_supply_the_day_up_front(self):
        # There is no deadline_day parameter: the day can only arrive as
        # an answer to the question the tool asked.
        names = {p["name"] for t in bp.MANIFEST["tools"]
                 if t["name"] == "brume_prepare" for p in t["parameters"]}
        self.assertNotIn("deadline_day", names)
        self.assertNotIn("schedule_unspecified", names)

    def test_the_deadline_question_is_asked(self):
        out = bp.invoke_prepare(self._draft(), {})
        questions = out["data"]["questions"]
        kinds = [q["kind"] for q in questions]
        self.assertIn("schedule", kinds)
        schedule = next(q for q in questions if q["kind"] == "schedule")
        self.assertIn("which day", schedule["question"].lower())

    def test_the_questions_mask_the_values(self):
        out = bp.invoke_prepare(self._draft(), {})
        for question in out["data"]["questions"]:
            if question["kind"] == "schedule":
                continue
            self.assertNotIn("four", question["question"])
            self.assertNotIn("two", question["question"])
            self.assertIn("…", question["question"])

    def test_the_answers_replace_the_models_values(self):
        first = bp.invoke_prepare(self._draft(), {})
        ids = [q["id"] for q in first["data"]["questions"]]
        replies = {"fact_1": "three projects", "fact_2": "the same week",
                   "fact_3": "none", "schedule": "Thursday"}
        answers = [f"{qid} = {replies.get(qid, 'none')}" for qid in ids]
        out = self._finish(first, answers)
        card = out["data"]["card"]
        self.assertEqual(out["data"]["status"], "not_saved")  # no host in tests
        self.assertEqual(card["opening"], "You are juggling three projects and a new deadline in the same week.")
        # the model's "two more people" was never confirmed -> blanked
        self.assertEqual(card["preparedKeyPoint"], "")
        self.assertIn("keyPoint", card["blanked"])
        self.assertEqual(card["deadlineDay"], "Thursday")
        self.assertEqual(card["sourceProvenance"], "answered")
        # the source is the person's words, not the model's prose
        self.assertNotIn("four", card["sourceText"])

    def test_a_declined_fact_leaves_its_field_blank(self):
        first = bp.invoke_prepare(self._draft(), {})
        ids = [q["id"] for q in first["data"]["questions"]]
        answers = [f"{qid} = none" for qid in ids]
        out = self._finish(first, answers)
        card = out["data"]["card"]
        self.assertEqual(card["opening"], "")
        self.assertEqual(card["preparedKeyPoint"], "")

    def test_the_card_is_shown_verbatim(self):
        first = bp.invoke_prepare(self._draft(), {})
        ids = [q["id"] for q in first["data"]["questions"]]
        answers = [f"{qid} = 3" if qid == "fact_1" else "none" for qid in ids]
        out = self._finish(first, answers)
        blocks = out["data"]["_display"]["blocks"]
        self.assertTrue(blocks)
        self.assertIn("preparation card", blocks[0]["text"].lower())

    def test_a_vague_count_is_answered_with_a_number(self):
        # "several" is a count the person answers with a number; the
        # card then carries their number, not the model's word.
        first = bp.invoke_prepare({
            "situation": "I am juggling several projects.",
            "draft_opening": "You are juggling several projects at once.",
        }, {})
        question = first["data"]["questions"][0]
        self.assertEqual(question["kind"], "phrase")
        self.assertIn("How many?", question["question"])
        self.assertNotIn("several", question["question"])
        out = bp.invoke_prepare({
            "request_id": first["data"]["request_id"],
            "answers": [f"{question['id']} = 3 projects"],
        }, {})
        self.assertEqual(out["data"]["card"]["opening"],
                         "You are juggling 3 projects at once.")

    def test_an_unknown_request_is_refused(self):
        with self.assertRaises(LookupError):
            bp.invoke_prepare({"request_id": "nope"}, {})

    def test_situation_required(self):
        with self.assertRaises(LookupError):
            bp.invoke_prepare({}, {})



class ProtocolManifest(unittest.TestCase):
    def test_manifest_json_matches_describe(self):
        here = os.path.dirname(os.path.abspath(__file__))
        with open(os.path.join(here, "manifest.json"), encoding="utf-8") as f:
            self.assertEqual(json.load(f), json.loads(json.dumps(bp.MANIFEST)))

if __name__ == "__main__":
    unittest.main()
