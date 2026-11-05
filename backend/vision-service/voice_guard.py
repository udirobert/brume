"""
The voice routes are the only part of this service a stranger can make us pay
for: every call spends our AssemblyAI quota, and an attacker does not need a
key — the key is ours, server-side. nginx already limits bursts
(`limit_req` 10 r/s on the API location), which stops a flood and nothing else:
ten requests a second is eight hundred thousand a day.

So this is the ceiling, in two layers:

  * a per-visitor minute window, so one tab, one page or one house cannot take
    the whole budget;
  * a per-day budget across the process, so a leaked or absent key costs us a
    known number of lines rather than an unknown one.

And one gate that is ours to close: `VOICE_SHARED_SECRET`. Unset, the voice
stays open and only the limits apply — which is what a deploy must survive,
because a half-configured site degrades to the browser's own voice instead of
failing. Set it and every voice request must carry `X-Brume-Voice-Key`
matching it. That key ends up in the published bundle: it is a speed bump that
stops a script, not a person with DevTools. What actually protects the account
is the budget above.
"""

import hmac
import os
import time

from fastapi import HTTPException, Request

VOICE_KEY_HEADER = "x-brume-voice-key"

DEFAULT_PER_MIN = 8
DEFAULT_DAILY_MAX = 1500


def shared_secret() -> str:
    return os.getenv("VOICE_SHARED_SECRET", "").strip()


def per_minute() -> int:
    try:
        return max(1, int(os.getenv("VOICE_PER_MIN", DEFAULT_PER_MIN)))
    except ValueError:
        return DEFAULT_PER_MIN


def daily_max() -> int:
    try:
        return max(1, int(os.getenv("VOICE_DAILY_MAX", DEFAULT_DAILY_MAX)))
    except ValueError:
        return DEFAULT_DAILY_MAX


def client_ip(request: Request) -> str:
    """Who to meter. nginx proxies, and uvicorn runs without --proxy-headers,
    so request.client.host is the proxy for every visitor on earth."""
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    client = getattr(request, "client", None)
    return client.host if client else "unknown"


class Bucket:
    """Token bucket: full at `capacity`, refilled at `capacity / 60` per
    second, so a burst of one minute's worth is allowed and then it is one
    request per that many seconds."""

    def __init__(self, capacity: int):
        self.capacity = capacity
        self.tokens = float(capacity)
        self.updated = time.monotonic()
        self.hits = 0

    def take(self, now: float) -> bool:
        self.tokens = min(
            self.capacity, self.tokens + (now - self.updated) * (self.capacity / 60.0)
        )
        self.updated = now
        if self.tokens < 1:
            return False
        self.tokens -= 1
        self.hits += 1
        return True


class Day:
    """A counter that resets itself at midnight UTC — the shape of a blob we
    would otherwise have to keep on disk for one number."""

    def __init__(self):
        self.day = ""
        self.used = 0

    def spend(self, limit: int) -> bool:
        today = time.strftime("%Y-%m-%d", time.gmtime())
        if today != self.day:
            self.day = today
            self.used = 0
        if self.used >= limit:
            return False
        self.used += 1
        return True


_buckets: dict = {}
_day = Day()

# A visitor list that grows forever is its own leak. Past the cap, drop anyone
# silent for a full minute — by then their bucket would have refilled anyway, so
# forgetting them costs nothing they will notice.
_MAX_TRACKED = 20000
_IDLE_SECONDS = 60.0


def _bucket_for(key: str, capacity: int, now: float) -> Bucket:
    bucket = _buckets.get(key)
    if bucket is None:
        if len(_buckets) >= _MAX_TRACKED:
            stale = [
                k for k, b in _buckets.items() if now - b.updated > _IDLE_SECONDS
            ]
            for k in stale:
                del _buckets[k]
        bucket = _buckets[key] = Bucket(capacity)
    return bucket


def reset() -> None:
    """For the test, and for whoever restarts this service to clear a day."""
    _buckets.clear()
    _day.day = ""
    _day.used = 0


def voice_guard(request: Request) -> None:
    """A dependency on the three routes that spend money."""
    secret = shared_secret()
    if secret:
        given = request.headers.get(VOICE_KEY_HEADER, "")
        if not hmac.compare_digest(given, secret):
            raise HTTPException(status_code=401, detail="voice_key_required")

    now = time.monotonic()
    capacity = per_minute()
    if not _bucket_for(client_ip(request), capacity, now).take(now):
        raise HTTPException(status_code=429, detail="voice_rate_limited")

    if not _day.spend(daily_max()):
        raise HTTPException(status_code=503, detail="voice_budget_exhausted")
