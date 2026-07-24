"""Smoke tests for the FastAPI app wiring: auth guard, rate limiting, and the
advice-refusal path (which never calls the real Gemini API, since the
keyword filter short-circuits before any model call).
"""
import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("AGENT_API_KEY", "test-key")
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "3")

    import config
    import main

    importlib.reload(config)
    importlib.reload(main)
    return TestClient(main.app)


def test_health_check_requires_no_auth(client: TestClient) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_query_without_api_key_is_rejected(client: TestClient) -> None:
    res = client.post("/query", json={"question": "What was revenue?", "chunks": []})
    assert res.status_code == 401


def test_query_with_wrong_api_key_is_rejected(client: TestClient) -> None:
    res = client.post(
        "/query",
        json={"question": "What was revenue?", "chunks": []},
        headers={"X-Api-Key": "wrong-key"},
    )
    assert res.status_code == 401


def test_query_with_advice_question_refuses_without_calling_model(client: TestClient) -> None:
    res = client.post(
        "/query",
        json={"question": "Should I buy this stock?", "chunks": []},
        headers={"X-Api-Key": "test-key"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "refused_advice_request"
    assert body["answer"] is None


def test_rate_limit_kicks_in_after_capacity(client: TestClient) -> None:
    headers = {"X-Api-Key": "test-key"}
    payload = {"question": "Should I buy this stock?", "chunks": []}

    # capacity is 3 (see RATE_LIMIT_PER_MINUTE fixture env var)
    for _ in range(3):
        res = client.post("/query", json=payload, headers=headers)
        assert res.status_code == 200

    res = client.post("/query", json=payload, headers=headers)
    assert res.status_code == 429
