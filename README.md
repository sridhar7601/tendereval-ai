# TenderEval AI — AI-Powered Tender Evaluation for Government Procurement

Automated tender evaluation platform that extracts eligibility criteria from government tender documents, parses bidder submissions across all formats (typed PDFs, scanned copies, Word files, photographs), and produces explainable per-criterion verdicts (Eligible / Not Eligible / Needs Review). Built for CRPF and Indian government procurement workflows — never silently disqualifies a bidder.

> **PanIIT AI for Bharat Hackathon** — Theme 3: AI-Based Tender Evaluation and Eligibility Analysis for Government Procurement (CRPF)

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Add your ANTHROPIC_API_KEY
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and the API at `http://localhost:8000`. API docs: `http://localhost:8000/docs`.

## Architecture

Three-stage pipeline:

1. **Extract** — Claude API extracts structured eligibility criteria (technical, financial, compliance) from tender documents.
2. **Parse** — Docling (97.9% table accuracy) for typed PDFs, PaddleOCR (F1=0.938) for scanned docs, with automatic fallback.
3. **Evaluate** — Per-criterion AI evaluation with traffic-light verdicts and chain-of-thought reasoning.

Every verdict is explainable: which criterion, which document, what value, why the decision. Ambiguous cases are flagged for human review.

## Tech Stack

- **Backend:** Python, FastAPI, SQLAlchemy, SQLite/PostgreSQL
- **Document parsing:** Docling (IBM), PaddleOCR
- **AI evaluation:** Claude API (Sonnet) with structured output and retry logic
- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Shared utilities:** `shared/` (common config and helpers)

## Documentation

See [docs/solution-document.md](docs/solution-document.md) for the full solution write-up.
