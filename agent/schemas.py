"""Pydantic schemas shared across the LedgerLock Python agent."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# /embed
# ---------------------------------------------------------------------------
class EmbedRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)


class EmbedResponse(BaseModel):
    embedding: list[float]


# ---------------------------------------------------------------------------
# /query
# ---------------------------------------------------------------------------
class ChunkInput(BaseModel):
    chunkId: str
    pageNumber: int
    content: str


class QueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    chunks: list[ChunkInput] = Field(default_factory=list)


class Citation(BaseModel):
    chunkId: str
    pageNumber: int
    quote: str = Field(max_length=240)


QueryStatus = Literal[
    "answered",
    "refused_advice_request",
    "refused_out_of_scope",
    "insufficient_context",
    "error",
]


class ExtractionResult(BaseModel):
    """Structured output produced by the Gemini generation step."""

    status: Literal["answered", "insufficient_context"]
    answer: Optional[str] = None
    citations: list[Citation] = Field(default_factory=list)
    confidence: Optional[Literal["high", "medium", "low"]] = None


class QueryResponse(BaseModel):
    status: QueryStatus
    answer: Optional[str] = None
    citations: list[Citation] = Field(default_factory=list)
    confidence: Optional[Literal["high", "medium", "low"]] = None


# ---------------------------------------------------------------------------
# Advice classification
# ---------------------------------------------------------------------------
class AdviceClassification(BaseModel):
    isAdviceRequest: bool
    reasoning: str
