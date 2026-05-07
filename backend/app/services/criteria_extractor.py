"""Criteria extraction service — uses Azure GPT-4.1 to extract structured eligibility criteria from tender text."""

import json
import logging

from app.services import mocks
from app.services.llm_client import chat, extract_json_from_response

logger = logging.getLogger(__name__)

MAX_RETRIES = 2

SYSTEM_PROMPT = (
    "You are an expert in Indian government procurement (CRPF, GeM, CPP) tender analysis. "
    "Extract every eligibility, technical, and financial criterion from the document. "
    "Be exhaustive — missing a criterion can cause a wrongly qualified bidder."
)


def _build_extraction_prompt(tender_text: str) -> str:
    return f"""Extract ALL criteria a bidder must meet from this Indian government tender.

For each criterion, provide:
- category: "eligibility" (must-have qualification), "technical" (specs/scored), or "financial" (monetary)
- name: short label (e.g., "EMD Submission", "Annual Turnover", "ISO Certification")
- description: what the criterion requires
- requirement_text: exact text from the document (verbatim quote, ≤300 chars)
- data_type: "boolean" (yes/no), "numeric" (amounts/quantities), "text" (certificates/names), or "document" (specific doc required)
- threshold: the specific threshold (e.g., "> 5 crore", "must have", "ISO 9001:2015")
- page_reference: approximate location if discernible
- is_mandatory: true if failing this disqualifies the bidder; false if scored / desirable / informational
- evidence_documents: list of document types a bidder must submit to satisfy this (e.g., ["audited_balance_sheet", "ca_certificate"])

Return ONLY a JSON array, no markdown, no explanation.

TENDER DOCUMENT:
{tender_text}"""


def extract_criteria(parsed_document: dict, tender_id: str) -> list[dict]:
    """Extract eligibility criteria from parsed tender document using Azure GPT-4.1."""
    if mocks.is_mock_enabled():
        logger.info("USE_MOCK_AI=true — returning pre-baked criteria for tender %s", tender_id)
        return mocks.mock_extract_criteria(parsed_document, tender_id)

    tender_text = parsed_document.get("text") or ""
    if len(tender_text) > 50000:
        # Keep header (NIT/eligibility) + footer (schedules) — middle sections are usually
        # technical specifications which can be sampled.
        tender_text = tender_text[:30000] + "\n\n[...middle section truncated for context window...]\n\n" + tender_text[-20000:]

    user_prompt = _build_extraction_prompt(tender_text)

    last_error: str = ""
    for attempt in range(MAX_RETRIES + 1):
        try:
            response_text = chat(SYSTEM_PROMPT, user_prompt, max_tokens=4096, temperature=0.1)
            criteria = extract_json_from_response(response_text)
            if not isinstance(criteria, list):
                raise ValueError("Response is not a JSON array")
            # Defensive: ensure required keys present, default is_mandatory based on category
            normalised: list[dict] = []
            for c in criteria:
                if not isinstance(c, dict):
                    continue
                if "is_mandatory" not in c:
                    c["is_mandatory"] = c.get("category") == "eligibility"
                if "evidence_documents" not in c:
                    c["evidence_documents"] = []
                normalised.append(c)
            return normalised
        except (json.JSONDecodeError, ValueError) as e:
            last_error = str(e)
            logger.warning(f"Criteria extraction parse failed (attempt {attempt + 1}): {e}")
            user_prompt = (
                "Your previous response was not a valid JSON array. Return ONLY a JSON array. "
                "Each element must have keys: category, name, description, requirement_text, data_type, "
                "threshold, page_reference, is_mandatory, evidence_documents.\n\n"
                f"Original response (truncated):\n{response_text[:1500] if 'response_text' in dir() else ''}"
            )

    raise ValueError(f"Failed to parse criteria after {MAX_RETRIES + 1} attempts: {last_error}")
