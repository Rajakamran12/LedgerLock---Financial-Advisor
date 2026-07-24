from rate_limit import TokenBucketLimiter


def test_allows_up_to_capacity_then_blocks() -> None:
    limiter = TokenBucketLimiter(capacity=3, refill_per_minute=60)
    key = "test-key"
    assert limiter.allow(key) is True
    assert limiter.allow(key) is True
    assert limiter.allow(key) is True
    assert limiter.allow(key) is False


def test_separate_keys_have_separate_buckets() -> None:
    limiter = TokenBucketLimiter(capacity=1, refill_per_minute=60)
    assert limiter.allow("key-a") is True
    assert limiter.allow("key-b") is True
    assert limiter.allow("key-a") is False
