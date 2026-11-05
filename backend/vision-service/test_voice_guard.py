"""
    python3 -m unittest test_voice_guard

The guard is the only thing between a stranger with curl and our voice quota,
so the interesting cases are the ones where nobody should be let through.
"""

import os
import time
import unittest

from fastapi import HTTPException

import voice_guard


class Headers:
    def __init__(self, values):
        self._values = {k.lower(): v for k, v in values.items()}

    def get(self, key, default=None):
        return self._values.get(key.lower(), default)


class Client:
    def __init__(self, host):
        self.host = host


class FakeRequest:
    def __init__(self, headers=None, client="198.51.100.7"):
        self.headers = Headers(headers or {})
        self.client = Client(client)


class GuardTest(unittest.TestCase):
    def setUp(self):
        voice_guard.reset()
        for name in ("VOICE_SHARED_SECRET", "VOICE_PER_MIN", "VOICE_DAILY_MAX"):
            os.environ.pop(name, None)

    tearDown = setUp

    # ---- who we meter ------------------------------------------------------

    def test_the_proxy_is_not_the_visitor(self):
        # nginx sets X-Real-IP; uvicorn runs without --proxy-headers, so the
        # peer address is the proxy for every visitor on earth.
        behind = FakeRequest(headers={"X-Real-IP": "203.0.113.9"}, client="127.0.0.1")
        self.assertEqual(voice_guard.client_ip(behind), "203.0.113.9")

        chain = FakeRequest(headers={"X-Forwarded-For": "198.51.100.4, 10.0.0.1"})
        self.assertEqual(voice_guard.client_ip(chain), "198.51.100.4")

        direct = FakeRequest(client="192.0.2.5")
        self.assertEqual(voice_guard.client_ip(direct), "192.0.2.5")

    def test_two_visitors_do_not_share_a_bucket(self):
        os.environ["VOICE_PER_MIN"] = "2"
        voice_guard.voice_guard(FakeRequest(headers={"X-Real-IP": "1.1.1.1"}))
        voice_guard.voice_guard(FakeRequest(headers={"X-Real-IP": "1.1.1.1"}))
        with self.assertRaises(HTTPException) as refused:
            voice_guard.voice_guard(FakeRequest(headers={"X-Real-IP": "1.1.1.1"}))
        self.assertEqual(refused.exception.status_code, 429)
        voice_guard.voice_guard(FakeRequest(headers={"X-Real-IP": "2.2.2.2"}))

    def test_a_bucket_refills_instead_of_staying_shut(self):
        bucket = voice_guard.Bucket(2)
        now = time.monotonic()
        self.assertTrue(bucket.take(now))
        self.assertTrue(bucket.take(now))
        self.assertFalse(bucket.take(now))
        self.assertTrue(bucket.take(now + 31))  # two per minute -> one per 30s

    def test_silent_visitors_are_forgotten(self):
        voice_guard._MAX_TRACKED = 4
        now = time.monotonic()
        for i in range(4):
            voice_guard._bucket_for(f"10.0.0.{i}", 2, now).take(now)
        # Everyone from a minute ago is evicted, not the one who just arrived.
        voice_guard._bucket_for("10.0.0.9", 2, now + 61)
        self.assertIn("10.0.0.9", voice_guard._buckets)
        self.assertLessEqual(len(voice_guard._buckets), 1)

    # ---- the day -----------------------------------------------------------

    def test_the_day_caps_total_calls(self):
        os.environ["VOICE_PER_MIN"] = "1000"
        os.environ["VOICE_DAILY_MAX"] = "3"
        for _ in range(3):
            voice_guard.voice_guard(FakeRequest())
        with self.assertRaises(HTTPException) as exhausted:
            voice_guard.voice_guard(FakeRequest())
        self.assertEqual(exhausted.exception.status_code, 503)
        self.assertEqual(exhausted.exception.detail, "voice_budget_exhausted")

    def test_the_counter_rolls_over_at_midnight(self):
        day = voice_guard.Day()
        os.environ["VOICE_DAILY_MAX"] = "1"
        self.assertTrue(day.spend(1))
        self.assertFalse(day.spend(1))
        day.day = "2000-01-01"
        self.assertTrue(day.spend(1))

    # ---- the key -----------------------------------------------------------

    def test_no_secret_configured_means_no_header_required(self):
        # What a deploy must survive: the server gets the limits first, the key
        # whenever its owner sets both halves.
        voice_guard.voice_guard(FakeRequest())
        voice_guard.voice_guard(FakeRequest(headers={"X-Brume-Voice-Key": "garbage"}))

    def test_a_secret_means_every_request_carries_it(self):
        os.environ["VOICE_SHARED_SECRET"] = "sable"
        with self.assertRaises(HTTPException) as missing:
            voice_guard.voice_guard(FakeRequest())
        self.assertEqual(missing.exception.status_code, 401)
        with self.assertRaises(HTTPException) as wrong:
            voice_guard.voice_guard(FakeRequest(headers={"X-Brume-Voice-Key": "Sable"}))
        self.assertEqual(wrong.exception.status_code, 401)
        voice_guard.voice_guard(FakeRequest(headers={"X-Brume-Voice-Key": "sable"}))

    def test_junk_limits_do_not_open_the_door(self):
        os.environ["VOICE_PER_MIN"] = "not a number"
        os.environ["VOICE_DAILY_MAX"] = ""
        self.assertEqual(voice_guard.per_minute(), voice_guard.DEFAULT_PER_MIN)
        self.assertEqual(voice_guard.daily_max(), voice_guard.DEFAULT_DAILY_MAX)


if __name__ == "__main__":
    unittest.main()
