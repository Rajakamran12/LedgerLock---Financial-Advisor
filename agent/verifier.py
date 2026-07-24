"""Layer 4 — Programmatic verification (code, not a model).

Every citation returned by the generation step must reference a chunk that
was actually supplied in the request, and its quote must appear verbatim
(case-insensitive) inside that chunk's content. This is what prevents the
model from fabricating a number and attaching a plausible-looking citation.
"""
from __future__ import annotations

from schemas import ExtractionResult


def verify_extraction(
    result: ExtractionResult, chunks_by_id: dict[str, str]
) -> tuple[bool, str | None]:
    if result.status != "answered":
        return True, None

    if not result.citations:
        return False, "zero citations"

    for citation in result.citations:
        source = chunks_by_id.get(citation.chunkId)
        if not source:
            return False, f"unknown chunk {citation.chunkId}"
        if citation.quote.strip().lower() not in source.lower():
            return False, "quote not found verbatim"

    return True, None
