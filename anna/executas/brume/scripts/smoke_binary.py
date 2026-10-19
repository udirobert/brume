#!/usr/bin/env python3
"""Smoke-test a built brume executa binary over stdio JSON-RPC.

Usage: smoke_binary.py <path-to-binary> <expected-version>

Sends `describe`, `health`, and `invoke calls (reset, get_ready, complete) on ONE process
(proving it keeps reading after each response), then closes stdin and
asserts a clean exit 0. Any stderr output is ignored. Exits non-zero on
the first failed assertion.
"""

import json
import subprocess
import sys
import threading
import time


def fail(msg: str) -> "None":
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def read_line(proc: subprocess.Popen, timeout: float = 40.0) -> dict:
    """Read one stdout line with a timeout; return parsed JSON."""
    box = {}

    def _read():
        box["line"] = proc.stdout.readline()

    t = threading.Thread(target=_read, daemon=True)
    t.start()
    t.join(timeout)
    if t.is_alive():
        fail("timed out waiting for a response line")
    line = box.get("line")
    if not line:
        fail("binary closed stdout before responding")
    try:
        return json.loads(line)
    except json.JSONDecodeError as exc:
        fail(f"response line is not JSON: {line!r} ({exc})")


def request(proc: subprocess.Popen, rid: int, method: str, params: dict | None = None) -> dict:
    env = {"jsonrpc": "2.0", "id": rid, "method": method}
    if params is not None:
        env["params"] = params
    proc.stdin.write(json.dumps(env) + "\n")
    proc.stdin.flush()
    deadline = time.monotonic() + 45.0
    while True:
        resp = read_line(proc, max(0.1, deadline - time.monotonic()))
        # Skip reverse-RPC request frames the plugin may emit mid-invoke.
        if "method" in resp:
            continue
        if resp.get("id") != rid:
            continue
        if "error" in resp:
            fail(f"{method}: error response {resp['error']}")
        if resp.get("jsonrpc") != "2.0":
            fail(f"{method}: jsonrpc != 2.0 in {resp}")
        return resp


def main() -> None:
    if len(sys.argv) != 3:
        print("usage: smoke_binary.py <binary> <expected-version>", file=sys.stderr)
        sys.exit(2)
    binary, expected = sys.argv[1], sys.argv[2]

    proc = subprocess.Popen(
        [binary],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    try:
        # describe
        r = request(proc, 1, "describe")
        result = r.get("result")
        if not isinstance(result, dict):
            fail("describe: result is not an object")
        if result.get("version") != expected:
            fail(f"describe: version {result.get('version')!r} != {expected!r}")
        tools = {t.get("name"): t for t in (result.get("tools") or []) if isinstance(t, dict)}
        for name in ("brume_reset", "brume_complete"):
            if name not in tools:
                fail(f"describe: missing tool {name!r} (got {sorted(tools)})")
            if not isinstance(tools[name].get("parameters"), list):
                fail(f"describe: {name}.parameters is not a list")

        # health on the SAME process — proves it kept reading after describe
        r = request(proc, 2, "health")
        if not isinstance(r.get("result"), dict):
            fail("health: result is not an object")

        # invoke brume_reset with the calling model's plan args — no
        # reverse RPC needed for the plan, should be fast.
        started = time.monotonic()
        r = request(proc, 3, "invoke", {
            "tool": "brume_reset",
            "arguments": {
                "context": "big call soon",
                "pattern": "cyclic-sigh",
                "seconds": 90,
                "title": "Before the call",
                "opening": "A short settle before you dial in.",
                "cues": ["Shoulders soft", "Unclench your jaw"],
                "why": "A double sip then a long out-breath fits the minutes before something tense.",
            },
        })
        elapsed = time.monotonic() - started
        result = r.get("result")
        if not isinstance(result, dict) or result.get("success") is not True:
            fail(f"invoke brume_reset: expected result.success true, got {result!r}")
        data = result.get("data") or {}
        if data.get("pattern") != "cyclic-sigh":
            fail(f"invoke brume_reset: unexpected pattern {data.get('pattern')!r}")
        if data.get("planSource") != "agent":
            fail(f"invoke brume_reset: unexpected planSource {data.get('planSource')!r}")
        print(f"  (brume_reset took {elapsed:.1f}s)")

        # invoke brume_get_ready — expect 5 verbatim display blocks.
        started = time.monotonic()
        r = request(proc, 4, "invoke", {
            "tool": "brume_get_ready",
            "arguments": {
                "event": "job interview at 3pm",
                "kind": "interview",
                "opener": "Hi, great to meet you.",
                "key_point": "I turn messy research into clear decisions.",
                "reminder": "Pause before you answer.",
            },
        })
        elapsed = time.monotonic() - started
        result = r.get("result")
        if not isinstance(result, dict) or result.get("success") is not True:
            fail(f"invoke brume_get_ready: expected success true, got {result!r}")
        blocks = (result.get("data") or {}).get("_display", {}).get("blocks", [])
        if len(blocks) != 5:
            fail(f"invoke brume_get_ready: expected 5 display blocks, got {len(blocks)}")
        print(f"  (brume_get_ready took {elapsed:.1f}s)")

        # invoke brume_complete with an agent-written reflection.
        started = time.monotonic()
        r = request(proc, 5, "invoke", {
            "tool": "brume_complete",
            "arguments": {
                "felt": "calmer",
                "reflection": "That was a minute well used. Head into the call with the same easy pace.",
            },
        })
        elapsed = time.monotonic() - started
        result = r.get("result")
        if not isinstance(result, dict) or result.get("success") is not True:
            fail(f"invoke brume_complete: expected success true, got {result!r}")
        data = result.get("data") or {}
        if data.get("closing_source") != "agent":
            fail(f"invoke brume_complete: expected closing_source agent, got {data.get('closing_source')!r}")
        print(f"  (brume_complete took {elapsed:.1f}s)")

        # close stdin -> process must exit 0
        proc.stdin.close()
        try:
            rc = proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            fail("binary did not exit within 5s of stdin close")
        if rc != 0:
            fail(f"binary exited {rc} after stdin close, expected 0")
    finally:
        if proc.poll() is None:
            proc.kill()

    print(f"OK: {binary} v{expected} passed describe/health/invoke smoke")


if __name__ == "__main__":
    main()
