#!/usr/bin/env python3
"""Smoke-test a built brume executa binary over stdio JSON-RPC.

Usage: smoke_binary.py <path-to-binary> <expected-version>

Sends `describe`, `health`, and `invoke brume_reset {}` on ONE process
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

        # invoke brume_reset with a context. The plan sampling call has
        # no host to answer it here, so the plugin waits out its ~12s
        # reverse-RPC timeout and falls back — tolerate the delay.
        started = time.monotonic()
        r = request(proc, 3, "invoke", {"tool": "brume_reset", "arguments": {"context": "big call soon"}})
        elapsed = time.monotonic() - started
        result = r.get("result")
        if not isinstance(result, dict) or result.get("success") is not True:
            fail(f"invoke brume_reset: expected result.success true, got {result!r}")
        data = result.get("data") or {}
        if data.get("pattern") not in ("cyclic-sigh", "long-exhale", "box", "steady"):
            fail(f"invoke brume_reset: unexpected pattern {data.get('pattern')!r}")
        # With no host answering sampling, the plan must be the fallback.
        if data.get("planSource") not in ("fallback", "ai"):
            fail(f"invoke brume_reset: unexpected planSource {data.get('planSource')!r}")
        print(f"  (brume_reset took {elapsed:.1f}s — plan RPC timeout path)")

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
