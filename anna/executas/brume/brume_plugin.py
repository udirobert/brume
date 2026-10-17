#!/usr/bin/env python3
"""Brume Reset — Anna Executa plugin (stdio JSON-RPC 2.0, stdlib only).

Chat-native guided ~90s breathing break for `#brume reset`.

  brume_reset     Returns the pacing script as verbatim `_display`
                  blocks (the model cannot paraphrase pacing text) plus
                  fields pointing the model at brume_complete.
  brume_complete  On the user's "done": writes a factual session record
                  via `storage/set` (scope "user" — the only cross-tool
                  scope a chat-invoked plugin may write; "app" needs an
                  App-context invoke, "tool" is invisible to the Brume
                  app), then asks the host for a closing line via
                  `sampling/createMessage`. Any reverse-RPC failure
                  degrades gracefully; abandoned runs write nothing.

Wire notes (anna.partners/developers/tools/*): `initialize` is answered
with protocolVersion "2.0" + {"sampling": {}, "storage": {}}; the
describe manifest declares host_capabilities ["llm.sample", "aps.kv"]
(without them the host rejects reverse RPCs -32008/-32021). Reverse RPCs
echo params.context.invoke_id back in their own params.context and are
sent optimistically under a bounded wait — the dev harness answers them
without `initialize`; a strict v1 host ignores them and the wait times
out into the same fallback.
"""

from __future__ import annotations

import json
import queue
import signal
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any

VERSION = "0.1.0"
TOOL_ID = "tool-dev-brume"

PATTERN_NAME = "Reset · 4s in, 6s out"
INHALE_S = 4
EXHALE_S = 6
DEFAULT_CYCLES, MIN_CYCLES, MAX_CYCLES = 9, 3, 12

FALLBACK_CLOSING_LINE = "Take a moment before you begin again."

# Record mirrors bundle/session.js buildCompletionRecord so chat and
# iframe sessions share the same user-scope "reset/..." namespace.
RECORD_PREFIX = "reset/sessions/"
RECORD_LAST_KEY = "reset/last"

MANIFEST: dict[str, Any] = {
    "name": TOOL_ID,
    "display_name": "Brume Reset",
    "version": VERSION,
    "description": (
        "A quiet ~90-second guided breathing break, delivered inline in "
        "chat. brume_reset renders the pacing script verbatim; "
        "brume_complete records the finished break and closes it out."
    ),
    "author": "Brume",
    "category": "productivity",
    "license": "MIT",
    "host_capabilities": ["llm.sample", "aps.kv"],
    "tools": [
        {
            "name": "brume_reset",
            "description": (
                "Start a guided breathing break (~90s, 4s in / 6s out). Returns the "
                "full pacing script as verbatim display blocks — do not restate or "
                "paraphrase them. When the user later signals they finished, call "
                "brume_complete."
            ),
            "timeout": 30,
            "parameters": [{
                "name": "cycles",
                "type": "integer",
                "description": "Breath cycles at 10s each. Default 9 (~90s); 3–12 accepted.",
                "required": False,
                "default": DEFAULT_CYCLES,
            }],
        },
        {
            "name": "brume_complete",
            "description": (
                "Close out a guided break after the user says they are done (e.g. "
                "'done', 'finished', 'back'). Writes a factual session record and "
                "returns a short closing line. Do not call for abandoned or "
                "interrupted breaks."
            ),
            "timeout": 60,
            "parameters": [],
        },
    ],
}

# stdin is drained by one reader thread into this queue so reverse-RPC
# waits can be bounded. None marks EOF — the host's shutdown signal.
_IN_Q: "queue.Queue[str | None]" = queue.Queue()
_STDIN_EOF = False
REVERSE_RPC_TIMEOUT_S = 20.0  # < the 60s invoke timeout
_LAST_RESET: dict[str, Any] = {}  # last issued reset, for the record


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


def _reverse_rpc(method: str, params: dict[str, Any], invoke_id: str | None) -> dict[str, Any]:
    rid = str(uuid.uuid4())
    payload: dict[str, Any] = {"jsonrpc": "2.0", "id": rid, "method": method, "params": dict(params)}
    if invoke_id:
        payload["params"]["context"] = {"invoke_id": invoke_id}
    _write(payload)
    deadline = time.monotonic() + REVERSE_RPC_TIMEOUT_S
    while True:
        line = _next_line(max(0.05, min(1.0, deadline - time.monotonic())))
        if _STDIN_EOF:
            raise RuntimeError(f"{method}: stdin closed before host response")
        if line is None:
            if time.monotonic() >= deadline:
                raise RuntimeError(f"{method}: no host response within {REVERSE_RPC_TIMEOUT_S:.0f}s")
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


def _sample_closing(invoke_id: str | None, cycles: int) -> str | None:
    """One closing line via host sampling. None on any failure."""
    prompt = "\n".join([
        "You are writing the closing line shown after a guided breathing break.",
        "Session facts:",
        f"- Routine: {PATTERN_NAME}",
        f"- Active practice time: {cycles * (INHALE_S + EXHALE_S)} seconds",
        f"- Breathing cycles completed: {cycles}",
        "- Ended early: no",
        "Write one calm closing line or next-action suggestion.",
        "15 words or fewer, plain sentence text, no emoji.",
    ])
    try:
        res = _reverse_rpc(
            "sampling/createMessage",
            {
                "messages": [{"role": "user", "content": {"type": "text", "text": prompt}}],
                "maxTokens": 64,
                "includeContext": "none",
                "metadata": {"executa_invoke_id": invoke_id} if invoke_id else {},
            },
            invoke_id,
        )
        text = ((res.get("content") or {}).get("text") or "").strip()
        return " ".join(text.split()) or None
    except Exception as exc:  # noqa: BLE001 — never fail the invoke over the LLM call
        _log(f"sampling unavailable, using fallback line: {exc}")
        return None


def _write_record(invoke_id: str | None, record: dict[str, Any]) -> tuple[str | None, str | None]:
    """Persist the session record under user scope. Returns (key, error)."""
    key = f"{RECORD_PREFIX}{record['completedAt']}"
    try:
        for k in (key, RECORD_LAST_KEY):
            _reverse_rpc("storage/set", {"scope": "user", "key": k, "value": record}, invoke_id)
        return key, None
    except Exception as exc:  # noqa: BLE001
        _log(f"storage write failed: {exc}")
        return None, str(exc)


# --- Tools ---------------------------------------------------------------


def _count_line(n: int) -> str:
    return " · ".join(str(i) for i in range(n, 0, -1))


def invoke_reset(args: dict[str, Any]) -> dict[str, Any]:
    try:
        cycles = int(args.get("cycles", DEFAULT_CYCLES) or DEFAULT_CYCLES)
    except (TypeError, ValueError):
        cycles = DEFAULT_CYCLES
    cycles = max(MIN_CYCLES, min(MAX_CYCLES, cycles))
    seconds = cycles * (INHALE_S + EXHALE_S)
    _LAST_RESET.clear()
    _LAST_RESET.update({"cycles": cycles, "issued_at": _utc_now_iso()})

    cycle_lines = "\n".join(
        f"**{i}** — in · {_count_line(INHALE_S)} — out · {_count_line(EXHALE_S)}"
        for i in range(1, cycles + 1)
    )
    blocks = [
        {"type": "markdown", "text": (
            "**Brume Reset** — take this minute for yourself.\n\n"
            "Sit comfortably, shoulders soft, jaw loose. Breathe **in** "
            "through the nose for 4 counts, then **out** slowly for 6. "
            f"Follow the lines below — about {seconds} seconds, {cycles} cycles."
        )},
        {"type": "markdown", "text": cycle_lines},
        {"type": "markdown", "text": (
            "After the last cycle, take one natural breath — then "
            "reply **done** when you're back.\n\n"
            "_Stop whenever you like; stopping early is fine too._"
        )},
    ]
    return {
        "success": True,
        "data": {
            "routine": PATTERN_NAME,
            "cycles": cycles,
            "guided_seconds": seconds,
            "note": "The guided script was rendered verbatim to the user — do not restate it.",
            "when_the_user_is_done": (
                "When the user signals completion (e.g. 'done', 'finished', "
                "'back'), call brume_complete. Do not call it for an "
                "abandoned or interrupted break."
            ),
            "_display": {"blocks": blocks},
        },
    }


def invoke_complete(context: dict[str, Any]) -> dict[str, Any]:
    invoke_id = context.get("invoke_id")
    cycles = int(_LAST_RESET.get("cycles") or DEFAULT_CYCLES)
    record = {
        "pattern": PATTERN_NAME,
        "activeSeconds": cycles * (INHALE_S + EXHALE_S),
        "cycles": cycles,
        "completedAt": _utc_now_iso(),
        "interrupted": False,
        "user_reported": "done",
        "source": "executa.chat",
    }
    record_key, storage_error = _write_record(invoke_id, record)
    closing = _sample_closing(invoke_id, cycles)
    line = closing or FALLBACK_CLOSING_LINE
    return {
        "success": True,
        "data": {
            "closing": line,
            "closing_source": "llm" if closing else "fallback",
            "record_written": record_key is not None,
            "record_scope": "user",
            "record_key": record_key,
            "storage_error": storage_error,
            "record": record,
            "_display": {"blocks": [{"type": "markdown", "text": line}]},
        },
    }


def invoke(tool: str, args: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    if tool == "brume_reset":
        return invoke_reset(args)
    if tool == "brume_complete":
        return invoke_complete(context)
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
                "capabilities": {"sampling": {}, "storage": {}},
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
