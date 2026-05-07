"""Bidder evaluation service — matches bidder documents against tender criteria using Azure GPT-4.1."""

import json
import logging

from sqlalchemy.orm import Session

from app.models import Bidder, Criterion, EvalVerdict, EvaluationResult, Tender
from app.services import mocks
from app.services.llm_client import chat, extract_json_from_response

logger = logging.getLogger(__name__)

MAX_RETRIES = 2

EVAL_SYSTEM_PROMPT = (
    "You are a procurement officer at CRPF evaluating a tender bid. Be strict but fair. "
    "Never silently disqualify — when ambiguous, flag for human review with the reason."
)

# Default result when evaluation fails after retries
FALLBACK_RESULT = {
    "verdict": "needs_review",
    "extracted_value": "",
    "reasoning": "Automated evaluation could not be completed — flagged for manual review.",
    "confidence": 0.0,
    "source_document": "",
}


def evaluate_bidder(tender: Tender, bidder: Bidder, db: Session) -> list[dict]:
    """Evaluate a bidder against all tender criteria. Returns per-criterion results."""
    use_mock = mocks.is_mock_enabled()

    bidder_docs_text = ""
    if not use_mock:
        for doc in bidder.documents:
            bidder_docs_text += (
                f"\n--- Document: {doc.filename} "
                f"(OCR: {doc.ocr_used}, Confidence: {doc.confidence:.2f}) ---\n"
                f"{doc.extracted_text or '[No text extracted]'}\n"
            )

    results: list[dict] = []

    for criterion in tender.criteria:
        if use_mock:
            result = mocks.mock_evaluate_single_criterion(criterion.name, bidder.name)
        else:
            result = _evaluate_single_criterion(criterion, bidder_docs_text, bidder.name)

        eval_result = EvaluationResult(
            bidder_id=bidder.id,
            criterion_id=criterion.id,
            verdict=EvalVerdict(result["verdict"]),
            extracted_value=result.get("extracted_value", ""),
            reasoning=result["reasoning"],
            confidence=result.get("confidence", 0.0),
            source_document=result.get("source_document", ""),
        )
        db.add(eval_result)
        results.append(result)

    db.commit()
    return results


def _evaluate_single_criterion(criterion: Criterion, bidder_docs: str, bidder_name: str) -> dict:
    """Evaluate a single criterion against bidder documents."""
    user_prompt = f"""Determine if bidder "{bidder_name}" meets the following criterion.

CRITERION:
- Name: {criterion.name}
- Category: {criterion.category}
- Description: {criterion.description}
- Requirement: {criterion.threshold}
- Data type: {criterion.data_type}
- Mandatory: {getattr(criterion, "is_mandatory", True)}

BIDDER'S SUBMITTED DOCUMENTS:
{bidder_docs[:15000]}

Respond with ONLY a JSON object (no markdown, no explanation outside the JSON):
{{
    "verdict": "eligible" | "not_eligible" | "needs_review",
    "extracted_value": "what you found in the documents relevant to this criterion (concise)",
    "reasoning": "step-by-step explanation citing the specific document and value (2-3 sentences)",
    "confidence": 0.0-1.0,
    "source_document": "exact filename of the document that supplied the evidence"
}}

RULES:
- "eligible" only if the documents clearly satisfy the criterion
- "not_eligible" only if the documents clearly fail it
- "needs_review" when ambiguous, partial, low-confidence OCR, or numbers can't be read
- NEVER silently disqualify — when in doubt, return "needs_review"
- Cite the document filename and the exact value or phrase you used"""

    last_response = ""
    for attempt in range(MAX_RETRIES + 1):
        try:
            response_text = chat(EVAL_SYSTEM_PROMPT, user_prompt, max_tokens=600, temperature=0.1)
            last_response = response_text
            result = extract_json_from_response(response_text)
            if "verdict" in result and "reasoning" in result:
                return result
            raise ValueError("Missing required fields: verdict, reasoning")
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(
                f"Evaluation parse failed for criterion '{criterion.name}' "
                f"(attempt {attempt + 1}): {e}"
            )
            user_prompt = (
                "Your previous response was not a valid JSON object. Return ONLY a JSON object "
                "with keys: verdict, extracted_value, reasoning, confidence, source_document.\n\n"
                f"Original response (truncated):\n{last_response[:1000]}"
            )

    logger.error(f"All retries exhausted for criterion '{criterion.name}' — using fallback")
    return {
        **FALLBACK_RESULT,
        "reasoning": (
            f"Automated evaluation failed after {MAX_RETRIES + 1} attempts — flagged for manual review."
        ),
    }
