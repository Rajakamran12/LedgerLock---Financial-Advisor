from schemas import Citation, ExtractionResult
from verifier import verify_extraction


def make_result(status="answered", citations=None) -> ExtractionResult:
    return ExtractionResult(
        status=status,
        answer="Net income was $97 billion." if status == "answered" else None,
        citations=citations or [],
        confidence="high" if status == "answered" else None,
    )


def test_insufficient_context_always_passes() -> None:
    result = make_result(status="insufficient_context")
    ok, reason = verify_extraction(result, {})
    assert ok is True
    assert reason is None


def test_answered_with_no_citations_fails() -> None:
    result = make_result(status="answered", citations=[])
    ok, reason = verify_extraction(result, {"chunk-1": "some content"})
    assert ok is False
    assert reason == "zero citations"


def test_answered_with_unknown_chunk_fails() -> None:
    citation = Citation(chunkId="missing-chunk", pageNumber=1, quote="Net income")
    result = make_result(citations=[citation])
    ok, reason = verify_extraction(result, {"chunk-1": "Net income increased to $97 billion"})
    assert ok is False
    assert "unknown chunk" in reason


def test_answered_with_quote_not_verbatim_fails() -> None:
    citation = Citation(chunkId="chunk-1", pageNumber=3, quote="Net income was ninety seven billion")
    result = make_result(citations=[citation])
    ok, reason = verify_extraction(result, {"chunk-1": "Net income increased to $97 billion"})
    assert ok is False
    assert reason == "quote not found verbatim"


def test_answered_with_verbatim_quote_passes() -> None:
    citation = Citation(chunkId="chunk-1", pageNumber=3, quote="Net income increased to $97 billion")
    result = make_result(citations=[citation])
    ok, reason = verify_extraction(result, {"chunk-1": "Net income increased to $97 billion in FY2023."})
    assert ok is True
    assert reason is None


def test_quote_verification_is_case_insensitive() -> None:
    citation = Citation(chunkId="chunk-1", pageNumber=3, quote="NET INCOME INCREASED")
    result = make_result(citations=[citation])
    ok, reason = verify_extraction(result, {"chunk-1": "net income increased to $97 billion"})
    assert ok is True
    assert reason is None
