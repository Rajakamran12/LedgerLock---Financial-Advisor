"""Embedding generation via Gemini's embedding model.

Vectors are L2-normalized in app code (not guaranteed by the API), since
`document_chunks.embedding` uses cosine distance and pgvector's HNSW index
assumes normalized input for consistent similarity scores.
"""
from __future__ import annotations

import asyncio
import math

from google import genai
from google.genai import types

from config import settings

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.google_generative_ai_api_key)
    return _client


def _normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0:
        return vector
    return [v / norm for v in vector]


async def embed_text(text: str) -> list[float]:
    """Returns a normalized 1536-dim embedding for the given text.

    The google-genai SDK's embed_content() is synchronous and blocks the
    calling thread. We offload it to a thread-pool worker via
    asyncio.to_thread so the FastAPI event loop stays responsive while
    processing large documents with multiple concurrent chunks.
    """
    client = _get_client()

    def _call() -> list[float]:
        result = client.models.embed_content(
            model=settings.embedding_model,
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=1536),
        )
        raw = result.embeddings[0].values
        return _normalize(list(raw))

    return await asyncio.to_thread(_call)
