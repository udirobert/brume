#!/usr/bin/env python3
"""Brume Reset — Anna Executa plugin (stdio JSON-RPC 2.0, stdlib only).

Chat-native guided breathing break for `#brume reset`.

  brume_reset     Takes the agent's plan args and returns the pacing
                  script as verbatim `_display` blocks plus the plan
                  fields (pattern, seconds, title, opening, cues, why,
                  planSource). Optional `context` summarizes the moment;
                  optional `pattern` skips the model. A mid-break pace
                  change re-invokes with `pace` + `remaining_seconds`
                  and continues the same pattern unless `pattern` is
                  given.
  brume_complete  On the user's "done": writes a factual session record
                  via `storage/set` (scope "user") and updates the
                  rolling `reset/summary`, then asks the host for a
                  short agent-written reflection. Optional
                  `felt` (calmer|same|wired) records their check-in. Any
                  reverse-RPC failure degrades gracefully; abandoned runs
                  write nothing.

Wire notes (anna.partners/developers/tools/*): `initialize` is answered
with protocolVersion "2.0" + {"storage": {}}; the
describe manifest declares host_capabilities ["aps.kv", ...] — the
CALLING model writes the plan/reflection as tool arguments, so no
sampling capability is needed (and none is declared). Reverse RPCs
echo params.context.invoke_id back in their own params.context and are
sent optimistically under a bounded wait — the dev harness answers them
without `initialize`; a strict v1 host ignores them and the wait times
out into the same fallback.

The plan contract (prompt, parsing, fallback, summary shape) is a 1:1
port of anna/bundle/plan.js — keep them in sync via
anna/test/plan-cases.json, which both this file's tests and the node
smoke test consume.
"""

from __future__ import annotations

import json
import queue
import re
import signal
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any

VERSION = "0.4.3"
TOOL_ID = "tool-papa-brume-htcxvfcr"

# --- Pattern library (mirror of bundle/plan.js PATTERNS) -----------------
# Phases are seconds. topup sits between inhale and hold; hold between
# topup and exhale; hold_after closes the cycle.

PATTERNS: dict[str, dict[str, Any]] = {
    "cyclic-sigh": {
        "id": "cyclic-sigh",
        "name": "Cyclic sigh",
        "rhythm": "2s in · 1s top-up · 6s out",
        "inhale": 2.0, "topup": 1.0, "hold": 0.0, "exhale": 6.0, "hold_after": 0.0,
    },
    "long-exhale": {
        "id": "long-exhale",
        "name": "Long exhale",
        "rhythm": "4s in · 6s out",
        "inhale": 4.0, "topup": 0.0, "hold": 0.0, "exhale": 6.0, "hold_after": 0.0,
    },
    "box": {
        "id": "box",
        "name": "Box",
        "rhythm": "4s in · 4s hold · 4s out · 4s hold",
        "inhale": 4.0, "topup": 0.0, "hold": 4.0, "exhale": 4.0, "hold_after": 4.0,
    },
    "steady": {
        "id": "steady",
        "name": "Steady",
        "rhythm": "5.5s in · 5.5s out",
        "inhale": 5.5, "topup": 0.0, "hold": 0.0, "exhale": 5.5, "hold_after": 0.0,
    },
}
PATTERN_IDS = list(PATTERNS)
ALLOWED_LENGTHS = [60, 90, 120, 180]
QUICK_PLAN = {"pattern": "long-exhale", "seconds": 90}

CANNED: dict[str, dict[str, Any]] = {
    "cyclic-sigh": {
        "title": "A steadying pause",
        "opening": "Two short sips of air, then one long out-breath — a way to settle before what's next.",
        "cues": ["Shoulders soft", "Unclench your jaw", "Let your gaze rest"],
        "why": "The double inhale and long exhale suits the minutes before something tense.",
    },
    "long-exhale": {
        "title": "A quiet reset",
        "opening": "A gentle rhythm — four counts in, six counts out — between one thing and the next.",
        "cues": ["Let your gaze rest", "Relax your hands"],
        "why": "A simple longer exhale makes a gentle break between tasks.",
    },
    "box": {
        "title": "A square breath",
        "opening": "Four even sides — in, hold, out, hold — to gather your attention.",
        "cues": ["Notice your feet on the floor", "Sit tall, stay easy"],
        "why": "Its even structure suits getting ready for focused work.",
    },
    "steady": {
        "title": "An easy rhythm",
        "opening": "An unhurried five and a half counts in, the same back out.",
        "cues": ["Let your shoulders drop", "Settle into the chair"],
        "why": "An even, slow rhythm suits winding down.",
    },
}

# Pace = tempo factor applied to every phase (slow stretches, fast
# compresses); "normal" is identity. Matches the bundle's PACE_TEMPO.
PACE_TEMPO = {"slow": 1.25, "normal": 1.0, "fast": 0.8}
DEFAULT_PACE = "normal"

FALLBACK_REFLECTION = "Take a moment before you begin again."

# Record mirrors bundle/session.js buildCompletionRecord so chat and
# iframe sessions share the same user-scope "reset/..." namespace.
RECORD_PREFIX = "reset/sessions/"
RECORD_LAST_KEY = "reset/last"
SUMMARY_KEY = "reset/summary"
RECENT_MAX = 10

PLAN_MAX_TOKENS = 300
REFLECTION_MAX_TOKENS = 120

MANIFEST: dict[str, Any] = {
    "name": TOOL_ID,
    "display_name": "Brume Reset",
    "version": VERSION,
    "description": (
        "An AI-planned guided breathing break, delivered inline in chat. "
        "brume_reset picks a pattern and length for the user's moment "
        "(or honours an explicit `pattern`), renders the pacing script "
        "verbatim, and remembers the plan; brume_complete records the "
        "finished break — including an optional `felt` check-in — and "
        "writes a short session reflection. If the user asks to adjust "
        "pace mid-break, invoke brume_reset again with `pace` and "
        "`remaining_seconds` rather than restarting."
    ),
    "author": "Brume",
    "category": "productivity",
    "license": "MIT",
    "host_capabilities": ["aps.kv", "aps.scope.user.read", "aps.scope.user.write"],
    "tools": [
        {
            "name": "brume_reset",
            "description": (
                "Start (or continue) a short guided breathing break, rendered verbatim to the user. "
                "Before calling, plan it yourself from what the user said: choose `pattern` "
                "(cyclic-sigh: 2s in, 1s top-up, 6s out — right before something tense or when keyed up; "
                "long-exhale: 4s in, 6s out — a gentle reset between tasks; "
                "box: 4s in, 4s hold, 4s out, 4s hold — getting ready for focused work; "
                "steady: 5.5s in, 5.5s out — winding down) and `seconds` (60, 90, 120 or 180; "
                "60 if they have little time), and write `title`, `opening`, `cues` and `why`. "
                "Describe only the rhythm and how it fits their moment — never effects on the body, "
                "brain, stress, sleep or health. The returned script is shown verbatim; do not restate "
                "it. If the user asks to change pace mid-break, call again with `pace` and "
                "`remaining_seconds` (the plan is kept). When the user says they are done, call "
                "brume_complete."
            ),
            "timeout": 30,
            "parameters": [
                {"name": "context", "type": "string", "required": False,
                 "description": "What the user said they are doing or about to do, as a short phrase. Never invent one."},
                {"name": "pattern", "type": "string", "enum": PATTERN_IDS, "required": False,
                 "description": "Breathing pattern you chose."},
                {"name": "seconds", "type": "integer", "enum": ALLOWED_LENGTHS, "required": False,
                 "description": "Length you chose."},
                {"name": "title", "type": "string", "required": False,
                 "description": "Up to 6 words naming this break."},
                {"name": "opening", "type": "string", "required": False,
                 "description": "One or two calm sentences (max 30 words) responding to what they said."},
                {"name": "cues", "type": "array", "items_type": "string", "required": False,
                 "description": "2–3 short phrases (max 8 words each) about posture or attention, shown during the break. Never counts, timings, or the words in, out, hold, inhale, exhale."},
                {"name": "why", "type": "string", "required": False,
                 "description": "One sentence (max 20 words): which part of their note this rhythm fits, describing only the rhythm."},
                {"name": "pace", "type": "string", "enum": ["slow", "normal", "fast"],
                 "required": False, "default": DEFAULT_PACE,
                 "description": "Tempo factor: slow = 1.25x phase length, normal = 1x, fast = 0.8x. Default normal."},
                {"name": "remaining_seconds", "type": "integer", "required": False,
                 "description": "Deliver only roughly this many more seconds — use when re-invoking to change pace mid-break so the script covers just the remainder (partial cycles allowed). Overrides the planned length."},
                {"name": "cycles", "type": "integer", "required": False,
                 "description": "Legacy override: exact breath cycles to deliver. Ignored when seconds is given."},
            ],
        },
        {
            "name": "brume_complete",
            "description": (
                "Close out a guided break after the user says they are done. Write `reflection` "
                "yourself: at most 2 sentences and 35 words — first acknowledge how it went in plain "
                "words (matter-of-fact if they ended early or still feel wired, never guilt), then one "
                "concrete next step tied to what they said they are doing next. No emoji, no health "
                "claims, and do not mention breathing science. Pass `felt` only if the user said how "
                "they feel. The reflection is shown verbatim; do not repeat it. Do not call for "
                "abandoned breaks."
            ),
            "timeout": 60,
            "parameters": [
                {"name": "felt", "type": "string", "enum": ["calmer", "same", "wired"],
                 "required": False,
                 "description": "Only if the user said how they feel."},
                {"name": "reflection", "type": "string", "required": False,
                 "description": "Your closing note, written as described above."},
            ],
        },
        {
            "name": "brume_get_ready",
            "description": (
                "Guide the user through a 3-minute get-ready routine before an interview, presentation, "
                "hard conversation or important meeting: about a minute of cyclic-sigh breathing, 30 "
                "seconds of opening up their posture, 30 seconds of humming as a voice warm-up, then "
                "rehearsing an opening line and key point. Write `opener`, `key_point` and `reminder` "
                "yourself from what they told you (ask what is coming up first if it is unclear; never "
                "invent facts about them). Everything is rendered verbatim; do not restate it. Make no "
                "claims about hormones, confidence effects or health."
            ),
            "timeout": 30,
            "parameters": [
                {"name": "event", "type": "string", "required": True,
                 "description": "What is coming up, as a short phrase."},
                {"name": "kind", "type": "string",
                 "enum": ["interview", "presentation", "hard-conversation", "meeting"],
                 "required": False, "description": "Kind of moment."},
                {"name": "opener", "type": "string", "required": False,
                 "description": "One natural opening sentence in the user's own voice, max 30 words."},
                {"name": "key_point", "type": "string", "required": False,
                 "description": "The one point they want remembered, clear and memorable, max 20 words."},
                {"name": "reminder", "type": "string", "required": False,
                 "description": "One short practical reminder for the moment itself, max 14 words (for example about pausing or listening)."},
            ],
        },
    ],

}

# stdin is drained by one reader thread into this queue so reverse-RPC
# waits can be bounded. None marks EOF — the host's shutdown signal.
_IN_Q: "queue.Queue[str | None]" = queue.Queue()
_STDIN_EOF = False

REVERSE_RPC_TIMEOUT_S = 20.0  # < the 60s invoke timeout
# Delivered reset segments, in order, for the completion record. A
# mid-break pace change is a re-invocation that appends a segment, so
# brume_complete can record what was actually delivered (seconds and
# cycles summed across paces), not just the last invocation.
_RESET_SEGMENTS: list[dict[str, Any]] = []


def _stdin_reader() -> None:
    global _STDIN_EOF
    for line in sys.stdin:
        _IN_Q.put(line)
    _STDIN_EOF = True
    _IN_Q.put(None)


def _next_line(timeout: float | None) -> str | None:
    try:
        return _IN_Q.get(timeout=timeout)
    except queue.Empty:
        return None


def _write(envelope: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(envelope) + "\n")
    sys.stdout.flush()


def _log(msg: str) -> None:
    print(f"[brume] {msg}", file=sys.stderr)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


# --- Reverse RPC (plugin -> host): emitted on stdout mid-invoke; the ----
# --- host answers on stdin. Interleaved requests are dispatched while ---
# --- we wait. -----------------------------------------------------------


def _reverse_rpc(
    method: str,
    params: dict[str, Any],
    invoke_id: str | None,
    timeout_s: float | None = None,
) -> dict[str, Any]:
    rid = str(uuid.uuid4())
    payload: dict[str, Any] = {"jsonrpc": "2.0", "id": rid, "method": method, "params": dict(params)}
    if invoke_id:
        payload["params"]["context"] = {"invoke_id": invoke_id}
    _write(payload)
    budget = timeout_s if timeout_s is not None else REVERSE_RPC_TIMEOUT_S
    deadline = time.monotonic() + budget
    while True:
        line = _next_line(max(0.05, min(1.0, deadline - time.monotonic())))
        if _STDIN_EOF:
            raise RuntimeError(f"{method}: stdin closed before host response")
        if line is None:
            if time.monotonic() >= deadline:
                raise RuntimeError(f"{method}: no host response within {budget:.0f}s")
            continue
        try:
            env = json.loads(line)
        except json.JSONDecodeError:
            continue
        if "method" not in env:
            # Response frame. Ours is the only reverse RPC in flight
            # (they are issued sequentially); anything else is dropped.
            if env.get("id") == rid:
                if "error" in env:
                    err = env["error"]
                    raise RuntimeError(f"{method} failed: [{err.get('code')}] {err.get('message')}")
                return env.get("result") or {}
            continue
        _dispatch(env)


def _storage_get(key: str, invoke_id: str | None, timeout_s: float | None = None) -> Any:
    """Best-effort user-scope read. None on any failure."""
    try:
        res = _reverse_rpc("storage/get", {"scope": "user", "key": key}, invoke_id,
                           timeout_s=timeout_s)
        if isinstance(res, dict) and "value" in res:
            return res["value"]
        return res
    except Exception as exc:  # noqa: BLE001
        _log(f"storage/get {key} failed: {exc}")
        return None


def _storage_set(key: str, value: Any, invoke_id: str | None) -> None:
    _reverse_rpc("storage/set", {"scope": "user", "key": key, "value": value}, invoke_id)


# --- Plan contract (1:1 port of bundle/plan.js — see plan-cases.json) -----
# Health-claim backstop — mirror of HEALTH_CLAIM_RE in bundle/plan.js.
CUE_FORBIDDEN_RE = re.compile(
    r"\b(in|out|hold|inhale|exhale|breathe|breath|count|counts|second|seconds|\d+)\b",
    re.IGNORECASE,
)


HEALTH_CLAIM_RE = re.compile(
    r"physiolog|arousal|nervous system|vagus|vagal|cortisol|hormon|testosterone|heart rate|\bhrv\b|blood pressure|relaxation response|parasympathetic|sympathetic nervous|fight.or.flight|your (body|system|brain|nervous system) (will|can|is going to)|\b(lowers?|reduces?|decreases?) (your )?(stress|anxiety|tension|cortisol|heart rate|blood pressure)|research (shows|suggests|finds|found)|studies (show|suggest|find|found)|study (shows|found|finds)|scientifically|clinically|proven to|\banxiety\b|insomnia|\b(cure|cures|heal|heals|healing|therapy|therapeutic|treatment)\b|\bhelps? (to |you |your )?(calm|relax|settle|soothe)\b|\bhelps? your (body|system|brain|mind|nerves|nervous system)\b|\byour (body|system|brain|mind) (will|can|is going to|to)\b",
    re.IGNORECASE,
)



_STRIP_RE = re.compile(
    "[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2060\\ufeff\\ufe0f"
    "\\U0001f000-\\U0001faff\\u2600-\\u27bf\\u2b00-\\u2bff]"
)


def _clean_text(s: Any, max_len: int) -> str:
    if not isinstance(s, str):
        return ""
    cleaned = re.sub(r"\s+", " ", _STRIP_RE.sub("", s)).strip()
    return cleaned[:max_len].strip() if len(cleaned) > max_len else cleaned


def clean_context(input_: Any) -> str:
    if not isinstance(input_, str):
        return ""
    return _clean_text(re.sub(r'["\'\r\n]+', " ", input_), 200)


_PLAN_LIBRARY_BLOCK = """You plan one short guided breathing break for a person at work. Choose from this fixed library only:
- cyclic-sigh: two inhales through the nose (2s, then a 1s top-up), then a long 6s exhale. Suits the moments right before something tense, or when they feel keyed up.
- long-exhale: 4s in, 6s out. A gentle general reset between tasks.
- box: 4s in, 4s hold, 4s out, 4s hold. Steady and structured; suits getting ready for focused work.
- steady: 5.5s in, 5.5s out. Even and unhurried; suits winding down.
Allowed lengths in seconds: 60, 90, 120, 180. Use 60 if they mention having little time."""

_PLAN_FORMAT_BLOCK = """Reply with ONLY a JSON object, no prose and no code fences:
{"pattern": one of the four ids, "seconds": one of the allowed lengths, "title": up to 6 words naming this break, "opening": one or two calm sentences (max 30 words) that respond to what they said, "cues": 2 or 3 short phrases (max 8 words each) about posture or attention to show during the break — never counts, timings, or the words in, out, hold, inhale or exhale, "why": one sentence (max 20 words) saying which part of their note this pattern fits, describing only the rhythm itself (for example: An even, unhurried rhythm to close out your workday.)}
Never describe effects on the body, brain, nerves, hormones, sleep quality, stress or anxiety; describe only the rhythm and how it fits their moment. Do not diagnose and do not use emoji."""



def update_summary(summary: Any, record: dict) -> dict:
    """reset/summary read-modify-write — mirror of updateSummary in plan.js."""
    s = dict(summary) if isinstance(summary, dict) else {}
    s["version"] = 1
    s["total"] = int(s.get("total") or 0) + 1
    byp = s.setdefault("byPattern", {})
    pid = record.get("pattern") or "long-exhale"
    ent = byp.setdefault(pid, {"sessions": 0, "calmer": 0, "same": 0, "wired": 0})
    ent["sessions"] = int(ent.get("sessions") or 0) + 1
    felt = record.get("felt")
    if felt in ("calmer", "same", "wired"):
        ent[felt] = int(ent.get(felt) or 0) + 1
    recent = s.setdefault("recent", [])
    recent.insert(0, {
        "completedAt": record.get("completedAt"),
        "pattern": record.get("pattern"),
        "activeSeconds": record.get("activeSeconds"),
        "felt": record.get("felt"),
        "interrupted": record.get("interrupted"),
    })
    s["recent"] = recent[:10]
    return s


def personalization_from_summary(summary: Any) -> str | None:
    if not isinstance(summary, dict):
        return None
    bp = summary.get("byPattern") or {}
    parts = []
    for pid in PATTERN_IDS:
        p = bp.get(pid)
        if not isinstance(p, dict):
            continue
        ratings = int(p.get("calmer") or 0) + int(p.get("same") or 0) + int(p.get("wired") or 0)
        if ratings < 2:
            continue
        if p.get("calmer", 0) >= p.get("same", 0) and p.get("calmer", 0) >= p.get("wired", 0):
            label, count = "calmer", p.get("calmer", 0)
        elif p.get("same", 0) >= p.get("wired", 0):
            label, count = "about the same", p.get("same", 0)
        else:
            label, count = "still wired", p.get("wired", 0)
        parts.append(f"{pid}: {label} {count} of {ratings}")
    return "; ".join(parts) if parts else None


def build_plan_prompt(context: Any, personalization: str | None) -> str:
    ctx = clean_context(context) or "nothing specific"
    parts = [
        _PLAN_LIBRARY_BLOCK,
        f'What the person said they are doing or about to do: "{ctx}"',
    ]
    if personalization:
        parts.append(
            f"What has worked for them before (their own after-session ratings): "
            f"{personalization}. Prefer a pattern they rated calmer, unless their "
            f"note clearly fits another one better."
        )
    parts.append(_PLAN_FORMAT_BLOCK)
    return "\n\n".join(parts)


def _first_json_object(text: Any) -> str:
    s = str(text or "")
    start = s.find("{")
    if start < 0:
        return ""
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(s)):
        c = s[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return s[start:i + 1]
    return ""


def _snap_seconds(v: Any) -> int:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return QUICK_PLAN["seconds"]
    return min(ALLOWED_LENGTHS, key=lambda length: abs(n - length))


def parse_model_plan(raw: Any) -> dict[str, Any] | None:
    """Raw model text -> validated plan, or None to fall back entirely."""
    obj = _first_json_object(raw)
    if not obj:
        return None
    try:
        parsed = json.loads(obj)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, dict):
        return None
    pattern = parsed.get("pattern")
    if pattern not in PATTERNS:
        return None
    canned = CANNED[pattern]

    def _safe(v: Any, max_len: int, canned_text: str) -> str:
        t = _clean_text(v, max_len)
        return canned_text if (not t or HEALTH_CLAIM_RE.search(t)) else t

    title = _safe(parsed.get("title"), 60, canned["title"])
    opening = _safe(parsed.get("opening"), 240, canned["opening"])
    why = _safe(parsed.get("why"), 160, canned["why"])
    canned_cues = list(canned["cues"])
    cues: list[str] = []
    if isinstance(parsed.get("cues"), list):
        for c in parsed["cues"]:
            t = _clean_text(c, 60)
            if not t or HEALTH_CLAIM_RE.search(t) or CUE_FORBIDDEN_RE.search(t):
                # offending cue -> an unused canned cue
                cues.append(canned_cues.pop(0)) if canned_cues else None
                continue
            if t in canned_cues:
                canned_cues.remove(t)
            cues.append(t)
        cues = cues[:3]
    for c in canned["cues"]:
        if len(cues) >= 2:
            break
        if c not in cues:
            cues.append(c)
    return {
        "pattern": pattern,
        "seconds": _snap_seconds(parsed.get("seconds")),
        "title": title,
        "opening": opening,
        "cues": cues,
        "why": why,
        "planSource": "ai",
    }


_FALLBACK_RULES = [
    (re.compile(r"call|meeting|present|interview|pitch|send|email|exam|nervous|anxious|tense|stress"),
     {"pattern": "cyclic-sigh", "seconds": 90}),
    (re.compile(r"focus|deep work|code|coding|write|writing|study|concentrat"),
     {"pattern": "box", "seconds": 120}),
    (re.compile(r"sleep|bed|wind down|winding down|evening|tired|done for the day"),
     {"pattern": "steady", "seconds": 180}),
]


def effective_length(pattern_id: str, seconds: int) -> dict[str, int]:
    """Whole-cycle snapping: effective = max(1, round(s/cycle)) * cycle —
    mirror of effectiveLengthSeconds in bundle/plan.js."""
    p = PATTERNS[pattern_id]
    cyc = p["inhale"] + p.get("topup", 0) + p.get("hold", 0) + p["exhale"] + p.get("hold_after", 0)
    cycles = max(1, round(seconds / cyc))
    return {"cycles": cycles, "seconds": int(round(cycles * cyc))}


def fallback_plan(context: Any, plan_source: str = "fallback") -> dict[str, Any]:
    ctx = clean_context(context).lower()
    pick = {"pattern": "long-exhale", "seconds": 90}
    for rule, p in _FALLBACK_RULES:
        if rule.search(ctx):
            pick = p
            break
    canned = CANNED[pick["pattern"]]
    return {
        "pattern": pick["pattern"],
        "seconds": pick["seconds"],
        "title": canned["title"],
        "opening": canned["opening"],
        "cues": list(canned["cues"][:3]),
        "why": canned["why"],
        "planSource": plan_source,
    }


def build_reflection_prompt(
    context: Any,
    pattern_name: str,
    active_seconds: int,
    planned_seconds: int,
    cycles: int,
    interrupted: bool,
    felt: str | None,
) -> str:
    ctx = clean_context(context) or "nothing specific"
    felt_word = (
        "calmer" if felt == "calmer"
        else "about the same" if felt == "same"
        else "still wired" if felt == "wired"
        else "not given"
    )
    return (
        "You write the short note shown after a guided breathing break.\n"
        "Facts:\n"
        f'- What they said they are doing or about to do: "{ctx}"\n'
        f"- Pattern: {pattern_name}\n"
        f"- Active time: {active_seconds} seconds of a planned {planned_seconds}; "
        f"cycles completed: {cycles}; ended early: {'yes' if interrupted else 'no'}\n"
        f"- How they say they feel now: {felt_word}\n"
        "Write at most 2 sentences and 35 words in total. First, acknowledge how "
        "it went in plain words (if they are still wired or ended early, be "
        "matter-of-fact and never guilt them). Second, give one concrete next "
        "step tied to what they said they are doing next. Plain text only, no "
        "emoji, no medical or health claims, and do not mention breathing science."
    )


def clean_reflection(raw: Any) -> str:
    if not isinstance(raw, str):
        return FALLBACK_REFLECTION
    text = raw
    # (a) first non-empty paragraph only
    para = next((p for p in re.split(r"\n\s*\n", text) if p.strip()), "")
    text = para
    # (b) remove meta parentheticals: "(19 words)", "(word count ...)",
    # "(alternative ...)", "(note: ...)"
    text = re.sub(
        r"\s*\((?:\s*\d+\s*words?\s*|word count[^)]*|alternative[^)]*|note:[^)]*)\)",
        "",
        text,
        flags=re.IGNORECASE,
    )
    # (c) drop a trailing "Word count: N" / "(N words)" remnant
    text = re.sub(r"\s*\(?\bword count:?\s*\d+\)?\s*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*\(\s*\d+\s*words?\s*\)\s*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > 1 and text.startswith('"') and text.endswith('"'):
        text = text[1:-1].strip()
    if not text or text.startswith("{") or HEALTH_CLAIM_RE.search(text):
        return FALLBACK_REFLECTION
    return text[:300].strip()


def validate_agent_plan(args: dict) -> dict | None:
    """Agent-supplied plan fields through the same caps/filters as model
    output. None when pattern is missing/unknown (caller falls back)."""
    pattern = args.get("pattern")
    if pattern not in PATTERNS:
        return None
    canned = CANNED[pattern]

    def _safe(v: Any, max_len: int, canned_text: str) -> str:
        t = _clean_text(v, max_len)
        return canned_text if (not t or HEALTH_CLAIM_RE.search(t)) else t

    canned_cues = list(canned["cues"])
    cues: list[str] = []
    if isinstance(args.get("cues"), list):
        for c in args["cues"]:
            t = _clean_text(c, 60)
            if not t or HEALTH_CLAIM_RE.search(t) or CUE_FORBIDDEN_RE.search(t):
                if canned_cues:
                    cues.append(canned_cues.pop(0))
                continue
            if t in canned_cues:
                canned_cues.remove(t)
            cues.append(t)
        cues = cues[:3]
    for c in canned["cues"]:
        if len(cues) >= 2:
            break
        if c not in cues:
            cues.append(c)
    seconds = args.get("seconds")
    return {
        "pattern": pattern,
        "seconds": seconds if seconds in ALLOWED_LENGTHS else _snap_seconds(seconds),
        "title": _safe(args.get("title"), 60, canned["title"]),
        "opening": _safe(args.get("opening"), 240, canned["opening"]),
        "cues": cues,
        "why": _safe(args.get("why"), 160, canned["why"]),
        "planSource": "agent",
    }


READY_KINDS = {"interview", "presentation", "hard-conversation", "meeting"}


def _ready_blocks(event: str, kind: str | None, opener: str, key_point: str,
                  reminder: str) -> list[dict]:
    pat = PATTERNS["cyclic-sigh"]
    cycle_line = f"in · {int(pat['inhale'])} · 1 — top up · {int(pat['topup'])} — out · 6 · 5 · 4 · 3 · 2 · 1"
    cycle_lines = "\n".join(f"**{i}** — {cycle_line}" for i in range(1, 8))
    blocks = [
        {"type": "markdown", "text": (
            "**Breathe** — Two short sips of air through the nose, then one long, "
            "slow breath out. About a minute.\n\n" + cycle_lines)},
        {"type": "markdown", "text": (
            "**Open up** — Sit or stand tall and roll your shoulders back. If you "
            "have room, raise your arms overhead in a wide V and hold for a few "
            "breaths, then let them float down.")},
        {"type": "markdown", "text": (
            "**Warm up your voice** — With your lips closed, hum gently on a "
            "comfortable note. Then glide the hum up and down like a slow siren, "
            "a few times.")},
    ]
    rehearse = "**Rehearse** — Say your opening line out loud, twice, at an easy pace:"
    if opener:
        rehearse += f"\n\n> {opener}"
    if key_point:
        rehearse += f"\n\n**The one thing to land:** {key_point}"
    if reminder:
        rehearse += f"\n\n_{reminder}_"
    blocks.append({"type": "markdown", "text": rehearse})
    blocks.append({"type": "markdown", "text": "You're ready. Go well."})
    return blocks


def invoke_get_ready(args: dict, context: dict) -> dict:
    invoke_id = context.get("invoke_id")
    event = clean_context(args.get("event"))
    if not event:
        return {"success": False, "data": {"error": "event is required — ask what is coming up first"}}
    kind = args.get("kind")
    kind = kind if kind in READY_KINDS else None
    opener = _clean_text(args.get("opener"), 220)
    key_point = _clean_text(args.get("key_point"), 160)
    reminder = _clean_text(args.get("reminder"), 110)
    if HEALTH_CLAIM_RE.search(opener):
        opener = ""
    if HEALTH_CLAIM_RE.search(key_point):
        key_point = ""
    if HEALTH_CLAIM_RE.search(reminder):
        reminder = "Pause before you answer."
    if not reminder:
        reminder = "Pause before you answer."
    record = {
        "completedAt": _utc_now_iso(),
        "event": event, "kind": kind,
        "opener": opener, "key_point": key_point, "reminder": reminder,
        "source": "executa.chat",
    }
    key, err = None, None
    try:
        k = f"ready/sessions/{record['completedAt']}"
        _storage_set(k, record, invoke_id)
        key = k
    except Exception as exc:  # noqa: BLE001
        err = str(exc)
    return {
        "success": True,
        "data": {
            "event": event, "kind": kind,
            "opener": opener, "key_point": key_point, "reminder": reminder,
            "record_written": key is not None, "storage_error": err,
            "record": record,
            "_display": {"blocks": _ready_blocks(event, kind, opener, key_point, reminder)},
        },
    }


# --- Tools ---------------------------------------------------------------


def _count_line(n: int) -> str:
    return " · ".join(str(i) for i in range(n, 0, -1))


# Phase -> script label used in the count lines. hold_after shows as
# "rest" between cycles.
_PHASE_LABELS = [
    ("inhale", "in"),
    ("topup", "top up"),
    ("hold", "hold"),
    ("exhale", "out"),
    ("hold_after", "rest"),
]


def _scaled_phase_seconds(pattern_id: str, tempo: float) -> list[tuple[str, float]]:
    pat = PATTERNS[pattern_id]
    return [
        (label, pat[key] * tempo)
        for key, label in _PHASE_LABELS
        if pat[key] > 0
    ]


def invoke_reset(args: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    invoke_id = context.get("invoke_id")
    pace = str(args.get("pace") or DEFAULT_PACE).strip().lower()
    if pace not in PACE_TEMPO:
        pace = DEFAULT_PACE
    tempo = PACE_TEMPO[pace]
    ctx = clean_context(args.get("context"))

    continuation = bool(_RESET_SEGMENTS)

    if continuation and args.get("pattern") not in PATTERNS:
        # A mid-break re-invocation continues the first segment's pattern
        # and plan; only the tempo changes.
        plan = dict(_RESET_SEGMENTS[0]["plan"])
    else:
        plan = validate_agent_plan(args) or fallback_plan(ctx)

    pattern_id = plan["pattern"]
    pat = PATTERNS[pattern_id]
    phases = _scaled_phase_seconds(pattern_id, tempo)
    cycle_s = sum(sec for _, sec in phases)

    # remaining_seconds (a mid-break pace change's remainder) takes
    # precedence and may resolve to a partial short run. Otherwise the
    # plan's length drives the cycle count; `cycles` stays a legacy
    # override.
    try:
        remaining = float(args.get("remaining_seconds"))
    except (TypeError, ValueError):
        remaining = None
    if remaining is not None:
        cycles = max(1, round(remaining / cycle_s))
        planned = int(round(remaining))
    elif args.get("cycles") is not None:
        try:
            cycles = int(args.get("cycles"))
        except (TypeError, ValueError):
            cycles = max(1, round(plan["seconds"] / cycle_s))
        cycles = max(1, min(24, cycles))
        planned = int(round(cycles * cycle_s))
    else:
        cycles = max(1, round(plan["seconds"] / cycle_s))
        planned = plan["seconds"]
    seconds = int(round(cycles * cycle_s))

    _RESET_SEGMENTS.append({
        "pace": pace,
        "pattern": pattern_id,
        "plan": plan,
        "cycles": cycles,
        "seconds": seconds,
        "planned_seconds": planned,
        "context": ctx,
        "issued_at": _utc_now_iso(),
    })

    # Count lines: per-phase seconds scaled by tempo, rounded to the
    # nearest int (min 1), counted down.
    def _phase_line() -> str:
        segs = []
        for label, sec in phases:
            n = max(1, round(sec))
            segs.append(f"{label} · {_count_line(n)}")
        return " — ".join(segs)

    cycle_line = _phase_line()
    cycle_lines = "\n".join(
        f"**{i}** — {cycle_line}" for i in range(1, cycles + 1)
    )

    rhythm = pat["rhythm"]
    if pace != "normal":
        rhythm += f" · {pace} pace"
    length_note = f"about {seconds} seconds"
    if planned != seconds:
        length_note = f"about {seconds} of a planned {planned} seconds"

    if continuation:
        intro = (
            f"**{plan['title']}** — continuing "
            f"at a {'slower' if pace == 'slow' else 'faster' if pace == 'fast' else 'normal'} pace.\n\n"
            f"{pat['name']} ({rhythm}) — {length_note}, "
            f"{cycles} cycle{'s' if cycles != 1 else ''}."
        )
    else:
        intro = (
            f"**{plan['title']}**\n\n{plan['opening']}\n\n"
            f"{pat['name']} — {rhythm} — {length_note}, "
            f"{cycles} cycle{'s' if cycles != 1 else ''}."
        )
    blocks = [
        {"type": "markdown", "text": intro},
        {"type": "markdown", "text": cycle_lines},
        {"type": "markdown", "text": (
            "After the last cycle, take one natural breath — then "
            "reply **done** when you're back.\n\n"
            "_Stop whenever you like; stopping early is fine too. "
            "Say **slower** or **faster** anytime to adjust the pace._"
        )},
    ]
    return {
        "success": True,
        "data": {
            "routine": pat["name"],
            "pattern": pattern_id,
            "pace": pace,
            "tempo": tempo,
            "cycles": cycles,
            "cycle_seconds": round(cycle_s, 2),
            "guided_seconds": seconds,
            "planned_seconds": planned,
            "context": ctx,
            "continuation": continuation,
            "plan": {
                "title": plan["title"],
                "opening": plan["opening"],
                "cues": plan["cues"],
                "why": plan["why"],
            },
            "planSource": plan["planSource"],
            "note": "The guided script was rendered verbatim to the user — do not restate it.",
            "pace_changes": (
                "If the user asks to adjust pace mid-break, invoke "
                "brume_reset again with the new pace and "
                "remaining_seconds set to the un-delivered remainder."
            ),
            "when_the_user_is_done": (
                "When the user signals completion (e.g. 'done', 'finished', "
                "'back'), call brume_complete. Do not call it for an "
                "abandoned or interrupted break."
            ),
            "_display": {"blocks": blocks},
        },
    }


def _write_record(invoke_id: str | None, record: dict[str, Any]) -> tuple[str | None, str | None]:
    """Persist the session record + rolling summary under user scope."""
    key = f"{RECORD_PREFIX}{record['completedAt']}"
    try:
        for k in (key, RECORD_LAST_KEY):
            _storage_set(k, record, invoke_id)
        summary = update_summary(_storage_get(SUMMARY_KEY, invoke_id), record)
        _storage_set(SUMMARY_KEY, summary, invoke_id)
        return key, None
    except Exception as exc:  # noqa: BLE001
        _log(f"storage write failed: {exc}")
        return None, str(exc)


def invoke_complete(args: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    invoke_id = context.get("invoke_id")
    felt = args.get("felt")
    felt = felt if felt in ("calmer", "same", "wired") else None

    if _RESET_SEGMENTS:
        segments = list(_RESET_SEGMENTS)
    else:
        # complete without a reset this session — record the default run
        plan = fallback_plan("")
        segments = [{
            "pace": DEFAULT_PACE,
            "pattern": plan["pattern"],
            "plan": plan,
            "cycles": max(1, round(plan["seconds"] / sum(
                sec for _, sec in _scaled_phase_seconds(plan["pattern"], 1.0)))),
            "seconds": plan["seconds"],
            "planned_seconds": plan["seconds"],
            "context": "",
            "issued_at": None,
        }]
    first = segments[0]
    plan = first["plan"]
    pattern_id = first["pattern"]
    pat = PATTERNS[pattern_id]
    cycles = sum(s["cycles"] for s in segments)
    seconds = sum(s["seconds"] for s in segments)
    planned_seconds = first.get("planned_seconds") or seconds
    ctx = next((s["context"] for s in segments if s.get("context")), "")
    paces = sorted({s["pace"] for s in segments})

    reflection_raw = args.get("reflection")
    reflection = clean_reflection(reflection_raw)

    record = {
        "completedAt": _utc_now_iso(),
        "context": ctx[:200],
        "pattern": pattern_id,
        "plannedSeconds": planned_seconds,
        "activeSeconds": seconds,
        "cycles": cycles,
        "interrupted": False,
        "felt": felt,
        "planSource": plan.get("planSource"),
        "reflection": reflection,
        "reflectionSource": "agent" if reflection != FALLBACK_REFLECTION else "fallback",
        "source": "executa.chat",
        "user_reported": "done",
    }
    if len(paces) > 1:
        record["paces"] = paces
        record["segments"] = [
            {"pace": s["pace"], "cycles": s["cycles"], "seconds": s["seconds"]}
            for s in segments
        ]
    record_key, storage_error = _write_record(invoke_id, record)
    return {
        "success": True,
        "data": {
            "closing": reflection,
            "closing_source": "agent" if reflection != FALLBACK_REFLECTION else "fallback",
            "reflection": reflection,
            "felt": felt,
            "planSource": plan.get("planSource"),
            "record_written": record_key is not None,
            "record_scope": "user",
            "record_key": record_key,
            "storage_error": storage_error,
            "record": record,
            "_display": {"blocks": [{"type": "markdown", "text": reflection}]},
        },
    }


def invoke(tool: str, args: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    if tool == "brume_reset":
        return invoke_reset(args, context)
    if tool == "brume_complete":
        return invoke_complete(args, context)
    if tool == "brume_get_ready":
        return invoke_get_ready(args, context)
    raise LookupError(f"unknown tool: {tool}")


# --- Dispatch + main loop --------------------------------------------------


def _dispatch(env: dict[str, Any]) -> None:
    rid = env.get("id")
    method = env.get("method")
    try:
        if method == "initialize":
            result = {
                "protocolVersion": "2.0",
                "server_info": {"name": TOOL_ID, "version": VERSION},
                "capabilities": {"storage": {}},
            }
        elif method == "describe":
            result = MANIFEST
        elif method == "health":
            result = {"status": "ready"}
        elif method == "invoke":
            params = env.get("params") or {}
            result = invoke(
                params.get("tool", ""),
                params.get("arguments") or {},
                params.get("context") or {},
            )
        else:
            _write({"jsonrpc": "2.0", "id": rid,
                    "error": {"code": -32601, "message": f"unknown method: {method}"}})
            return
        _write({"jsonrpc": "2.0", "id": rid, "result": result})
    except LookupError as exc:
        _write({"jsonrpc": "2.0", "id": rid,
                "error": {"code": -32601, "message": str(exc)}})
    except Exception as exc:  # noqa: BLE001
        _write({"jsonrpc": "2.0", "id": rid,
                "error": {"code": -32603, "message": str(exc)}})


def main() -> None:
    # Host closes stdin to ask for shutdown, then SIGTERMs. Exit 0 on
    # both — non-zero counts against the restart budget.
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    threading.Thread(target=_stdin_reader, daemon=True).start()
    while True:
        line = _next_line(timeout=None)
        if line is None:
            return  # EOF
        line = line.strip()
        if not line:
            continue
        try:
            env = json.loads(line)
        except json.JSONDecodeError as exc:
            _write({"jsonrpc": "2.0", "id": None,
                    "error": {"code": -32700, "message": str(exc)}})
            continue
        _dispatch(env)


if __name__ == "__main__":
    main()
