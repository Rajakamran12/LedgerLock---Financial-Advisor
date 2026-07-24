import pytest

from classifier import looks_like_advice_request, classify_advice_request


@pytest.mark.parametrize(
    "question",
    [
        "Should I buy this stock?",
        "Is this a good investment?",
        "Would you recommend investing in this company?",
        "Should I sell my shares now?",
        "What price target would you give this stock?",
    ],
)
def test_keyword_filter_catches_advice_requests(question: str) -> None:
    assert looks_like_advice_request(question) is True


@pytest.mark.parametrize(
    "question",
    [
        "What was net income in FY2023?",
        "How many employees does the company have?",
        "What was total revenue on page 12?",
    ],
)
def test_keyword_filter_passes_factual_questions(question: str) -> None:
    assert looks_like_advice_request(question) is False


@pytest.mark.asyncio
async def test_classify_advice_request_short_circuits_on_keyword() -> None:
    result = await classify_advice_request("Should I buy this stock?")
    assert result.isAdviceRequest is True
    assert result.reasoning == "matched keyword filter"
