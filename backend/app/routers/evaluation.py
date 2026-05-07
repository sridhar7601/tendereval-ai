"""Evaluation endpoints — run AI evaluation and get results."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Tender, Bidder, EvaluationResult, EvalVerdict
from app.services.evaluator import evaluate_bidder

router = APIRouter()


@router.post("/{tender_id}/evaluate/{bidder_id}")
async def run_evaluation(tender_id: str, bidder_id: str, db: Session = Depends(get_db)):
    """Evaluate a single bidder against all tender criteria."""
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    bidder = db.query(Bidder).filter(Bidder.id == bidder_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found")

    results = evaluate_bidder(tender, bidder, db)

    # Compute overall verdict
    verdicts = [r["verdict"] for r in results]
    if any(v == EvalVerdict.NOT_ELIGIBLE for v in verdicts):
        bidder.overall_verdict = EvalVerdict.NOT_ELIGIBLE
    elif any(v == EvalVerdict.NEEDS_REVIEW for v in verdicts):
        bidder.overall_verdict = EvalVerdict.NEEDS_REVIEW
    else:
        bidder.overall_verdict = EvalVerdict.ELIGIBLE

    db.commit()

    return {
        "bidder_id": bidder.id,
        "bidder_name": bidder.name,
        "overall_verdict": bidder.overall_verdict,
        "criteria_results": results,
    }


@router.get("/{tender_id}/results")
def get_evaluation_results(tender_id: str, db: Session = Depends(get_db)):
    """Get evaluation results for all bidders of a tender."""
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    return {
        "tender_id": tender.id,
        "tender_title": tender.title,
        "bidders": [
            {
                "id": b.id,
                "name": b.name,
                "overall_verdict": b.overall_verdict,
                "results": [
                    {
                        "criterion": r.criterion.name,
                        "verdict": r.verdict,
                        "extracted_value": r.extracted_value,
                        "reasoning": r.reasoning,
                        "confidence": r.confidence,
                    }
                    for r in b.results
                ],
            }
            for b in tender.bidders
        ],
    }


@router.post("/{tender_id}/evaluate-all")
async def evaluate_all_bidders(tender_id: str, db: Session = Depends(get_db)):
    """Evaluate every bidder for a tender in one call.

    Brief: 'For each bidder, decide whether they are Eligible, Not Eligible, or Need Manual Review'.
    Procurement officers want one click for the whole panel.
    """
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    out: list[dict] = []
    for bidder in tender.bidders:
        # Skip already-evaluated bidders unless they have no results yet
        existing_count = db.query(EvaluationResult).filter(
            EvaluationResult.bidder_id == bidder.id
        ).count()
        if existing_count > 0:
            # Roll up existing
            verdicts = [r.verdict for r in bidder.results]
        else:
            criteria_results = evaluate_bidder(tender, bidder, db)
            verdicts = [r["verdict"] for r in criteria_results]

        if any(v == EvalVerdict.NOT_ELIGIBLE for v in verdicts):
            bidder.overall_verdict = EvalVerdict.NOT_ELIGIBLE
        elif any(v == EvalVerdict.NEEDS_REVIEW for v in verdicts):
            bidder.overall_verdict = EvalVerdict.NEEDS_REVIEW
        else:
            bidder.overall_verdict = EvalVerdict.ELIGIBLE

        out.append({
            "bidder_id": bidder.id,
            "bidder_name": bidder.name,
            "overall_verdict": bidder.overall_verdict,
            "criteria_evaluated": len(verdicts),
        })

    db.commit()

    summary = {
        "eligible": sum(1 for r in out if r["overall_verdict"] == EvalVerdict.ELIGIBLE),
        "not_eligible": sum(1 for r in out if r["overall_verdict"] == EvalVerdict.NOT_ELIGIBLE),
        "needs_review": sum(1 for r in out if r["overall_verdict"] == EvalVerdict.NEEDS_REVIEW),
    }

    return {
        "tender_id": tender_id,
        "bidders_evaluated": len(out),
        "summary": summary,
        "results": out,
    }


@router.get("/{tender_id}/export")
def export_evaluation_report(tender_id: str, db: Session = Depends(get_db)):
    """Audit-ready evaluation report (Markdown).

    Brief non-negotiable: 'audit-ready and suitable for use in a formal government
    procurement decision'. Returns text/markdown that an officer can save, print,
    sign and append to the procurement file.
    """
    from datetime import datetime, timezone
    from fastapi.responses import Response

    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines: list[str] = []
    lines.append(f"# Evaluation Report — {tender.title}")
    lines.append("")
    lines.append(f"**Tender No.:** {tender.tender_number or '—'}  ")
    lines.append(f"**Organisation:** {tender.organization or '—'}  ")
    lines.append(f"**Generated:** {now}  ")
    lines.append(f"**Source:** Automated AI evaluation (Azure GPT-4.1) · reviewer override available")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Criteria summary
    lines.append("## Eligibility criteria")
    lines.append("")
    lines.append("| # | Criterion | Category | Mandatory | Threshold |")
    lines.append("|---|-----------|----------|-----------|-----------|")
    for i, c in enumerate(tender.criteria, 1):
        mandatory = "Yes" if getattr(c, "is_mandatory", True) else "No"
        lines.append(f"| {i} | {c.name} | {c.category or ''} | {mandatory} | {c.threshold or ''} |")
    lines.append("")

    # Per-bidder details
    for b in tender.bidders:
        lines.append("---")
        lines.append("")
        lines.append(f"## Bidder: {b.name}")
        lines.append(f"**Overall verdict:** **{(b.overall_verdict or 'pending').upper()}**")
        lines.append("")
        lines.append("| Criterion | Verdict | Extracted Value | Confidence | Source Document |")
        lines.append("|-----------|---------|-----------------|------------|-----------------|")
        for r in b.results:
            verdict = (r.verdict or "pending").replace("_", " ").upper()
            value = (r.extracted_value or "—").replace("|", "\\|").replace("\n", " ")
            value = value[:80] + ("…" if len(value) > 80 else "")
            src = (r.source_document or "—").replace("|", "\\|")
            conf = f"{(r.confidence or 0) * 100:.0f}%"
            crit = r.criterion.name if r.criterion else "—"
            lines.append(f"| {crit} | {verdict} | {value} | {conf} | {src} |")
        lines.append("")
        # Reasoning details
        lines.append("### Reasoning per criterion")
        lines.append("")
        for r in b.results:
            crit = r.criterion.name if r.criterion else "(unknown)"
            verdict = (r.verdict or "pending").replace("_", " ").upper()
            lines.append(f"- **{crit}** — {verdict}: {r.reasoning or '—'}")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## Sign-off")
    lines.append("")
    lines.append("| Role | Name | Signature | Date |")
    lines.append("|------|------|-----------|------|")
    lines.append("| Procurement Officer |  |  |  |")
    lines.append("| Technical Member |  |  |  |")
    lines.append("| Finance Member |  |  |  |")
    lines.append("")
    lines.append("*Every verdict above is criterion-level traceable. Reviewer can override; "
                 "any override is appended to the audit log with reviewer ID + timestamp + reason.*")

    md = "\n".join(lines)
    filename = f"evaluation-report-{tender.tender_number or tender.id[:8]}.md"
    return Response(
        content=md,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
