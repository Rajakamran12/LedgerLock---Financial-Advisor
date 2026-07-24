"""Layer 2 — Advice-request classifier.

Two-stage: a fast keyword filter catches the obvious cases without a model
call; anything else goes through a Gemini structured-output classification.
Fail-safe: any classifier error is treated as an advice request (refuse),
never as a pass-through.
"""
from __future__ import annotations

import logging

from google import genai
from google.genai import types

from config import settings
from schemas import AdviceClassification

logger = logging.getLogger(__name__)

ADVICE_KEYWORDS = [
    "should i buy",
    "should i sell",
    "should i invest",
    "good investment",
    "bad investment",
    "is it a good buy",
    "is it a good time to buy",
    "would you recommend",
    "do you recommend",
    "worth buying",
    "worth investing",
    "price target",
    "will the stock",
    "will this stock",
    "buy or sell",
    "buy rating",
    "sell rating",
    "should i hold",
]

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.google_generative_ai_api_key)
    return _client


def looks_like_advice_request(question: str) -> bool:
    lowered = question.lower()
    return any(kw in lowered for kw in ADVICE_KEYWORDS)


_CLASSIFIER_PROMPT = """You are a strict classifier. Determine whether the \
following user question is asking for investment advice, a recommendation, \
a prediction, or a personal opinion about whether to buy/sell/hold a \
security or make a financial decision — as opposed to a neutral request for \
a fact that is stated in a financial document (e.g. "what was revenue in \
FY2023?").

Question: {question}

Respond with strict JSON matching the schema."""


async def classify_advice_request(question: str) -> AdviceClassification:
    if looks_like_advice_request(question):
        return AdviceClassification(
            isAdviceRequest=True, reasoning="matched keyword filter"
        )

    try:
        client = _get_client()
        response = client.models.generate_content(
            model=settings.chat_model,
            contents=_CLASSIFIER_PROMPT.format(question=question),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AdviceClassification,
            ),
        )
        parsed = response.parsed
        if isinstance(parsed, AdviceClassification):
            return parsed
        return AdviceClassification.model_validate_json(response.text)
    except Exception:  # noqa: BLE001 - fail closed, never let a bad call slip through
        logger.exception("advice classifier failed; failing closed")
        return AdviceClassification(
            isAdviceRequest=True,
            reasoning="classifier error - failing closed to a refusal",
        )
