"""FastAPI entrypoint for the LedgerLock Python agent.

This service is an internal microservice: it is only ever called by the
Next.js server (never the browser). It exposes exactly two endpoints,
`/embed` and `/query`, both guarded by a shared API key and a per-key
token-bucket rate limit.
"""
from __future__ import annotations

import logging
import time

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import ValidationError

from classifier import classify_advice_request
from config import settings
from embedder import embed_text
from generator import generate_grounded_answer
from rate_limit import TokenBucketLimiter
from schemas import EmbedRequest, EmbedResponse, QueryRequest, QueryResponse
from verifier import verify_extraction

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ledgerlock-agent")

app = FastAPI(title="LedgerLock Agent", version="1.0.0")

limiter = TokenBucketLimiter(
    capacity=settings.rate_limit_per_minute,
    refill_per_minute=settings.rate_limit_per_minute,
)


async def require_api_key(x_api_key: str | None = Header(default=None)) -> str:
    if not settings.agent_api_key or x_api_key != settings.agent_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid api key")
    if not limiter.allow(x_api_key):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="rate limit exceeded")
    return x_api_key


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest, _: str = Depends(require_api_key)) -> EmbedResponse:
    try:
        vector = await embed_text(req.text)
    except Exception as exc:  # noqa: BLE001
        logger.exception("embedding failed")
        raise HTTPException(status_code=500, detail="embedding failed") from exc
    return EmbedResponse(embedding=vector)


@app.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest, _: str = Depends(require_api_key)) -> QueryResponse:
    start = time.monotonic()
    try:
        classification = await classify_advice_request(req.question)
        if classification.isAdviceRequest:
            return QueryResponse(status="refused_advice_request", answer=None, citations=[])

        extraction = await generate_grounded_answer(req.question, req.chunks)
        chunks_by_id = {c.chunkId: c.content for c in req.chunks}
        ok, reason = verify_extraction(extraction, chunks_by_id)
        if not ok:
            logger.info("verification failed: %s", reason)
            return QueryResponse(status="refused_out_of_scope", answer=None, citations=[])

        return QueryResponse(
            status=extraction.status,
            answer=extraction.answer,
            citations=extraction.citations,
            confidence=extraction.confidence,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("query failed")
        raise HTTPException(status_code=500, detail="internal error") from exc
    finally:
        logger.info("query handled in %.0fms", (time.monotonic() - start) * 1000)
