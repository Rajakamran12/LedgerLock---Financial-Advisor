"""In-memory token-bucket rate limiter, keyed by client identity.

Free-tier constraint: the agent runs as a single Render instance, so an
in-memory bucket is sufficient (it resets on redeploy/restart, which is
acceptable for a demo). Not shared across instances.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from threading import Lock


@dataclass
class _Bucket:
    tokens: float
    last_refill: float = field(default_factory=time.monotonic)


class TokenBucketLimiter:
    def __init__(self, capacity: int, refill_per_minute: int) -> None:
        self.capacity = capacity
        self.refill_rate = refill_per_minute / 60.0  # tokens per second
        self._buckets: dict[str, _Bucket] = {}
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = _Bucket(tokens=self.capacity, last_refill=now)
                self._buckets[key] = bucket

            elapsed = now - bucket.last_refill
            bucket.tokens = min(self.capacity, bucket.tokens + elapsed * self.refill_rate)
            bucket.last_refill = now

            if bucket.tokens >= 1:
                bucket.tokens -= 1
                return True
            return False
