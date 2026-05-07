"""Pre-baked responses used when USE_MOCK_AI=true.

Lets the demo run end-to-end without Docling, PaddleOCR, or the Claude API —
critical for judging environments where cold-start failures or missing keys
would otherwise kill the flow silently.

Shapes mirror the real services exactly so callers don't branch."""

import hashlib
import os


def is_mock_enabled() -> bool:
    return os.getenv("USE_MOCK_AI", "true").lower() in ("1", "true", "yes")


# ---------------------------------------------------------------------------
# Tender parsing — what the document_parser would return for a typical NIT.
# ---------------------------------------------------------------------------

_TENDER_TEXT = """NOTICE INVITING TENDER (NIT)
CRPF Procurement Wing — Tender No. CRPF/PROC/2026/043

Sealed bids are invited from eligible bidders for the supply of bullet-proof
jackets (Level III+, NIJ 0101.06 compliant) — quantity 5,000 units.

ELIGIBILITY CRITERIA:
1. Bidder must submit Earnest Money Deposit (EMD) of Rs. 5,00,000/- in the form
   of Demand Draft drawn in favour of "DDO, CRPF" payable at New Delhi.
2. Bidder must have minimum average annual turnover of Rs. 5 Crore over the
   last three financial years (2023-24, 2024-25, 2025-26).
3. Valid ISO 9001:2015 quality management certification is mandatory.
4. Valid PAN Card and GSTIN registration certificate must be enclosed.
5. Bidder must have successfully executed at least three similar contracts of
   value not less than Rs. 2 Crore each in the last five years.
6. Bid Security of Rs. 10,00,000/- via Bank Guarantee from a scheduled bank,
   valid for 180 days from bid opening date.

TECHNICAL CRITERIA:
- Conformance to NIJ 0101.06 Level III+ ballistic standard (test report from
  NABL accredited lab required).
- Material specification: UHMWPE / aramid composite, weight ≤ 3.2 kg.
- Warranty period: minimum 5 years from date of supply.

FINANCIAL CRITERIA:
- Quoted price must be inclusive of all taxes, duties, and freight charges.
- Payment terms: 80% on supply and acceptance, 20% on commissioning.

[...further sections covering technical specifications, schedules, and contractual
terms truncated for brevity...]
"""


def mock_parse_tender_document(file_path: str) -> dict:
    return {
        "text": _TENDER_TEXT,
        "pages": [{"page": i + 1, "text": _TENDER_TEXT[i * 800 : (i + 1) * 800]} for i in range(3)],
        "method": "mock",
        "confidence": 0.99,
    }


def mock_parse_bidder_document(file_path: str) -> dict:
    bidder_hint = os.path.basename(file_path).lower()
    if "scan" in bidder_hint or "image" in bidder_hint:
        text = _BIDDER_DOC_SCANNED
        method = "paddleocr"
        conf = 0.78
    else:
        text = _BIDDER_DOC_TYPED
        method = "docling"
        conf = 0.94
    return {"text": text, "ocr_method": method, "confidence": conf}


_BIDDER_DOC_TYPED = """COMPANY PROFILE — Submitted by ABC Defence Solutions Pvt. Ltd.

Registered Office: Plot 42, Sector 18, Gurugram, Haryana 122015
PAN: AABCT1234E    GSTIN: 06AABCT1234E1Z9
ISO 9001:2015 Certificate No. ISO/IND/9001/2024/4587 (valid till 2027-08-15)

Annual Turnover (audited):
  FY 2023-24: Rs. 6.42 Crore
  FY 2024-25: Rs. 7.18 Crore
  FY 2025-26: Rs. 8.05 Crore
  Three-year average: Rs. 7.22 Crore

EMD: Demand Draft No. 003421 drawn on State Bank of India, New Delhi,
amount Rs. 5,00,000/- in favour of DDO, CRPF — enclosed.

Bid Security: Bank Guarantee from HDFC Bank, BG No. HDFC/BG/2026/887,
amount Rs. 10,00,000/-, valid 180 days — enclosed as Annexure-C.

Past Performance (similar contracts in last 5 years):
  1. CISF — bullet-resistant vests, Rs. 3.4 Cr, completed 2024
  2. ITBP — body armour kits, Rs. 2.8 Cr, completed 2023
  3. BSF — protective gear, Rs. 4.1 Cr, completed 2025
"""


_BIDDER_DOC_SCANNED = """[OCR extraction — confidence 0.78]

PROFILE: XYZ Tactical Equipment Ltd.

PAN: AAJCT9988R
GSTIN: 27AAJCT9988R1Z2

[ISO certification — text partially illegible]

Turnover statement (last 3 years):
  2023-24: Rs. 4.2 Cr
  2024-25: Rs. 4.7 Cr
  2025-26: figure not legible

EMD: amount visible as Rs. 5,00,000 — issuer/instrument unclear from scan
Bid Security: page missing from submission

Past contracts:
  - One similar contract referenced: Rs. 1.5 Cr (below threshold)
"""


# ---------------------------------------------------------------------------
# Criteria extraction — deterministic, mirrors what Claude would return.
# ---------------------------------------------------------------------------

_MOCK_CRITERIA = [
    {
        "category": "eligibility",
        "name": "EMD Submission",
        "description": "Earnest Money Deposit must be submitted as a Demand Draft.",
        "requirement_text": "Bidder must submit Earnest Money Deposit (EMD) of Rs. 5,00,000/- in the form of Demand Draft drawn in favour of \"DDO, CRPF\" payable at New Delhi.",
        "data_type": "document",
        "threshold": "Rs. 5,00,000/- via DD",
        "page_reference": "Page 1, Section: Eligibility Criteria",
    },
    {
        "category": "financial",
        "name": "Annual Turnover",
        "description": "Three-year average annual turnover threshold.",
        "requirement_text": "Bidder must have minimum average annual turnover of Rs. 5 Crore over the last three financial years (2023-24, 2024-25, 2025-26).",
        "data_type": "numeric",
        "threshold": ">= Rs. 5 Crore (3-year average)",
        "page_reference": "Page 1, Section: Eligibility Criteria",
    },
    {
        "category": "technical",
        "name": "ISO 9001:2015 Certification",
        "description": "Valid quality management certification required.",
        "requirement_text": "Valid ISO 9001:2015 quality management certification is mandatory.",
        "data_type": "document",
        "threshold": "ISO 9001:2015 — valid certificate",
        "page_reference": "Page 1, Section: Eligibility Criteria",
    },
    {
        "category": "eligibility",
        "name": "PAN and GSTIN",
        "description": "Valid PAN card and GST registration required.",
        "requirement_text": "Valid PAN Card and GSTIN registration certificate must be enclosed.",
        "data_type": "document",
        "threshold": "Valid PAN + GSTIN",
        "page_reference": "Page 1, Section: Eligibility Criteria",
    },
    {
        "category": "technical",
        "name": "Past Performance",
        "description": "Successfully executed similar contracts in last 5 years.",
        "requirement_text": "Bidder must have successfully executed at least three similar contracts of value not less than Rs. 2 Crore each in the last five years.",
        "data_type": "text",
        "threshold": ">= 3 contracts, each >= Rs. 2 Crore (last 5 years)",
        "page_reference": "Page 1, Section: Eligibility Criteria",
    },
    {
        "category": "financial",
        "name": "Bid Security",
        "description": "Bank Guarantee for bid security amount.",
        "requirement_text": "Bid Security of Rs. 10,00,000/- via Bank Guarantee from a scheduled bank, valid for 180 days from bid opening date.",
        "data_type": "document",
        "threshold": "Rs. 10,00,000/- via BG, 180 days validity",
        "page_reference": "Page 1, Section: Eligibility Criteria",
    },
]


def mock_extract_criteria(parsed_document: dict, tender_id: str) -> list[dict]:
    return [dict(c) for c in _MOCK_CRITERIA]


# ---------------------------------------------------------------------------
# Bidder evaluation — deterministic per (criterion, bidder) pair.
# ---------------------------------------------------------------------------

_VERDICT_PROFILES = {
    # bidder-name keyword -> (eligible_pct, needs_review_pct, not_eligible_pct)
    "abc": (85, 10, 5),
    "xyz": (15, 25, 60),
    "default": (60, 25, 15),
}


def _profile_for(bidder_name: str) -> tuple[int, int, int]:
    name = bidder_name.lower()
    for key, profile in _VERDICT_PROFILES.items():
        if key != "default" and key in name:
            return profile
    return _VERDICT_PROFILES["default"]


def _stable_pct(criterion_name: str, bidder_name: str) -> int:
    digest = hashlib.md5(f"{criterion_name}|{bidder_name}".encode()).hexdigest()
    return int(digest[:4], 16) % 100


def _verdict_for(criterion_name: str, bidder_name: str) -> str:
    eligible, needs_review, _ = _profile_for(bidder_name)
    pct = _stable_pct(criterion_name, bidder_name)
    if pct < eligible:
        return "eligible"
    if pct < eligible + needs_review:
        return "needs_review"
    return "not_eligible"


_REASONING_TEMPLATES = {
    "eligible": {
        "EMD Submission": "Demand Draft No. 003421 for Rs. 5,00,000 drawn on SBI New Delhi, in favour of DDO CRPF — meets the requirement.",
        "Annual Turnover": "Audited turnover statement shows three-year average of Rs. 7.22 Crore, comfortably exceeding the Rs. 5 Crore threshold.",
        "ISO 9001:2015 Certification": "ISO 9001:2015 certificate (No. ISO/IND/9001/2024/4587) valid through 2027-08-15 enclosed.",
        "PAN and GSTIN": "PAN AABCT1234E and GSTIN 06AABCT1234E1Z9 both present and valid format.",
        "Past Performance": "Three qualifying contracts cited (CISF Rs. 3.4 Cr 2024, ITBP Rs. 2.8 Cr 2023, BSF Rs. 4.1 Cr 2025) — each above the Rs. 2 Crore threshold.",
        "Bid Security": "HDFC Bank BG No. HDFC/BG/2026/887 for Rs. 10,00,000 with 180-day validity enclosed as Annexure-C.",
    },
    "not_eligible": {
        "EMD Submission": "EMD instrument referenced but no DD details provided — cannot verify amount or drawee bank.",
        "Annual Turnover": "Three-year average computes to Rs. 4.45 Crore, falling below the Rs. 5 Crore threshold.",
        "ISO 9001:2015 Certification": "Certificate referenced but text is illegible in the scanned submission — cannot confirm validity dates.",
        "PAN and GSTIN": "PAN format appears non-standard; GSTIN check digit does not validate.",
        "Past Performance": "Only one similar contract referenced (Rs. 1.5 Cr) — falls short of the three-contract requirement.",
        "Bid Security": "Bid security page appears missing from the submission packet.",
    },
    "needs_review": {
        "EMD Submission": "DD details partially legible due to scan quality — manual verification of drawee bank recommended.",
        "Annual Turnover": "FY 2025-26 turnover figure not legible in submission — request fresh audited statement before final call.",
        "ISO 9001:2015 Certification": "Certificate body name does not match standard registrar list — verify accreditation.",
        "PAN and GSTIN": "Documents present but issued in a different legal entity name — confirm ownership chain.",
        "Past Performance": "Contracts cited but completion certificates not enclosed — request and verify.",
        "Bid Security": "BG validity period unclear from submitted copy — request original for verification.",
    },
}


def _reasoning_for(verdict: str, criterion_name: str) -> str:
    return _REASONING_TEMPLATES[verdict].get(
        criterion_name,
        f"Automated mock evaluation: verdict {verdict} for criterion '{criterion_name}'.",
    )


def mock_evaluate_single_criterion(criterion_name: str, bidder_name: str) -> dict:
    verdict = _verdict_for(criterion_name, bidder_name)
    confidence = 0.92 if verdict == "eligible" else 0.74 if verdict == "needs_review" else 0.88
    return {
        "verdict": verdict,
        "extracted_value": _extracted_value_for(verdict, criterion_name),
        "reasoning": _reasoning_for(verdict, criterion_name),
        "confidence": confidence,
        "source_document": "company_profile.pdf" if verdict != "not_eligible" else "scanned_submission.pdf",
    }


_EXTRACTED_VALUES = {
    "EMD Submission": {"eligible": "Rs. 5,00,000 via DD No. 003421 (SBI)", "not_eligible": "EMD reference present, instrument details missing", "needs_review": "DD No. partially legible"},
    "Annual Turnover": {"eligible": "Rs. 7.22 Crore (3-yr avg)", "not_eligible": "Rs. 4.45 Crore (3-yr avg)", "needs_review": "FY 2025-26 figure illegible"},
    "ISO 9001:2015 Certification": {"eligible": "ISO/IND/9001/2024/4587, valid 2027-08-15", "not_eligible": "Certificate referenced, illegible scan", "needs_review": "Registrar accreditation unclear"},
    "PAN and GSTIN": {"eligible": "PAN AABCT1234E, GSTIN 06AABCT1234E1Z9", "not_eligible": "PAN/GSTIN format invalid", "needs_review": "Different legal entity name"},
    "Past Performance": {"eligible": "3 contracts, total Rs. 10.3 Crore", "not_eligible": "1 contract, Rs. 1.5 Crore", "needs_review": "Contracts cited, completion certs missing"},
    "Bid Security": {"eligible": "Rs. 10,00,000 via HDFC BG, 180-day validity", "not_eligible": "Page missing from submission", "needs_review": "BG validity period unclear"},
}


def _extracted_value_for(verdict: str, criterion_name: str) -> str:
    return _EXTRACTED_VALUES.get(criterion_name, {}).get(verdict, "")
