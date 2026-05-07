"""Dashboard rollup + AI briefing — procurement officer's morning view."""

import json
import logging

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Bidder, Criterion, EvalVerdict, EvaluationResult, Tender
from app.services import mocks
from app.services.llm_client import chat, has_llm

logger = logging.getLogger(__name__)
router = APIRouter()


def _briefing(stats: dict) -> str:
    """Generate procurement-officer briefing. Uses Azure GPT-4.1; falls back to deterministic template."""
    if mocks.is_mock_enabled() or not has_llm():
        return (
            f"{stats.get('tender_count', 0)} tender{'s' if stats.get('tender_count', 0) != 1 else ''} "
            f"in flight · {stats.get('bidder_count', 0)} bidders submitted · "
            f"{stats.get('eligible', 0)} eligible · "
            f"{stats.get('not_eligible', 0)} ineligible · "
            f"{stats.get('needs_review', 0)} flagged for manual review. "
            f"Officer queue priority: clear the {stats.get('needs_review', 0)} review-flagged bidders first."
        )

    system = (
        "You are the AI assistant to a CRPF procurement officer. Write a 3-sentence morning "
        "briefing for the evaluation committee. Structure:\n"
        "1. Volume: tenders + bidders processed today.\n"
        "2. Verdict mix: eligible / not-eligible / needs-review counts; flag low-confidence cases.\n"
        "3. Action: which bidder or criterion to clear first; mention OCR confidence concerns.\n"
        "Use government-procurement language. Under 70 words."
    )
    user = json.dumps(stats)
    try:
        return chat(system, user, max_tokens=200, temperature=0.2, cache=True,
                    cache_key=f"t3_briefing_{stats.get('tender_count')}_{stats.get('eligible')}_"
                              f"{stats.get('not_eligible')}_{stats.get('needs_review')}")
    except Exception as e:
        logger.warning(f"Briefing LLM call failed: {e}")
        return (
            f"{stats.get('tender_count', 0)} tenders · {stats.get('bidder_count', 0)} bidders · "
            f"{stats.get('needs_review', 0)} need manual review."
        )


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    """KPI snapshot + AI briefing for the home page."""
    tender_count = db.query(Tender).count()
    bidder_count = db.query(Bidder).count()
    criteria_count = db.query(Criterion).count()
    mandatory_count = db.query(Criterion).filter(Criterion.is_mandatory.is_(True)).count()

    by_verdict_raw = (
        db.query(Bidder.overall_verdict, func.count(Bidder.id))
        .group_by(Bidder.overall_verdict)
        .all()
    )
    # Verdict can come back as enum or string — normalise to a string key
    counts: dict[str, int] = {}
    for verdict, n in by_verdict_raw:
        key = (verdict.value if hasattr(verdict, "value") else (verdict or "pending"))
        counts[key] = counts.get(key, 0) + n
    eligible = counts.get("eligible", 0)
    not_eligible = counts.get("not_eligible", 0)
    needs_review = counts.get("needs_review", 0)
    pending = max(0, bidder_count - eligible - not_eligible - needs_review)

    # OCR confidence distribution — surface low-confidence docs (brief edge case)
    low_conf_docs = (
        db.query(EvaluationResult)
        .filter(EvaluationResult.confidence < 0.7)
        .count()
    )

    avg_confidence = db.query(func.avg(EvaluationResult.confidence)).scalar() or 0.0

    stats = {
        "tender_count": tender_count,
        "bidder_count": bidder_count,
        "criteria_count": criteria_count,
        "mandatory_count": mandatory_count,
        "eligible": eligible,
        "not_eligible": not_eligible,
        "needs_review": needs_review,
        "pending": pending,
        "low_confidence_evaluations": low_conf_docs,
        "avg_confidence_pct": round(avg_confidence * 100, 1),
    }

    briefing = _briefing(stats)

    return {
        **stats,
        "briefing": briefing,
    }
