"""Layer 3 — Grounded, structured generation.

Builds a system prompt that forbids the model from using outside knowledge
and forces Gemini's controlled generation (response_schema) to guarantee the
output matches ExtractionResult exactly.
"""
from __future__ import annotations

import logging

from google import genai
from google.genai import types

from config import settings
from schemas import ChunkInput, ExtractionResult

logger = logging.getLogger(__name__)

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.google_generative_ai_api_key)
    return _client


SYSTEM_PROMPT = """You are LedgerLock, a strict financial-document Q&A engine.

Rules you must never break:
1. Answer ONLY using facts literally present in the provided document excerpts below.
2. Never use outside knowledge, general financial reasoning, or your own training data.
3. Every factual claim in your answer must be backed by at least one citation: the exact
   chunkId it came from, its page number, and a verbatim quote (max 240 chars) copied
   character-for-character from that chunk's content.
4. If the excerpts do not contain enough information to answer the question, respond with
   status="insufficient_context" and answer=null and citations=[].
5. Never give investment advice, a recommendation, a prediction, or an opinion — you only
   ever restate facts that are already written in the document.
6. Set confidence to "high" only if the excerpts state the answer directly and unambiguously;
   "medium" if minor interpretation was needed; "low" if it's a stretch.

Return strict JSON matching the required schema. Do not include any text outside the JSON.
"""


def _build_context(chunks: list[ChunkInput]) -> str:
    parts = []
    for chunk in chunks:
        parts.append(
            f"[chunkId={chunk.chunkId} page={chunk.pageNumber}]\n{chunk.content}"
        )
    return "\n\n---\n\n".join(parts)


async def generate_grounded_answer(
    question: str, chunks: list[ChunkInput]
) -> ExtractionResult:
    client = _get_client()
    context = _build_context(chunks)
    prompt = f"{SYSTEM_PROMPT}\n\nDocument excerpts:\n{context}\n\nQuestion: {question}"

    try:
        response = client.models.generate_content(
            model=settings.chat_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ExtractionResult,
            ),
        )
        parsed = response.parsed
        if isinstance(parsed, ExtractionResult):
            return parsed
        return ExtractionResult.model_validate_json(response.text)
    except Exception:  # noqa: BLE001 - any generation failure is treated as insufficient context
        logger.exception("grounded generation failed")
        return ExtractionResult(status="insufficient_context", answer=None, citations=[])
