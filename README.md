# TenderEval AI — AI-Based Tender Evaluation & Eligibility Analysis for CRPF

> **PanIIT AI for Bharat Hackathon — Theme 3**
> Automated tender criteria extraction + heterogeneous bidder document parsing (Docling + PaddleOCR) + criterion-level evaluation with **Azure GPT-4.1** grounded reasoning. Audit-ready, never silently disqualifies.

---

## What it solves

CRPF and other government bodies issue tenders with dozens of eligibility criteria spread across hundreds of pages. Bidders respond with mixed-format documents — typed PDFs, scanned certificates, photographs of physical seals, Word files, tables. **Today this is evaluated manually** — committees spend days cross-checking, two evaluators reach different conclusions on the same documents, and audit trails are weak.

TenderEval AI does three things:

1. **Understand the tender** — extracts every eligibility / technical / financial criterion from the tender PDF, distinguishes mandatory from scored, captures verbatim requirement text + threshold + page reference.
2. **Understand each bidder** — parses every submitted document (typed PDF → Docling, scanned/photo → PaddleOCR fallback) with confidence scoring per OCR result.
3. **Evaluate and explain** — per-criterion verdict (Eligible / Not Eligible / **Needs Review**) with the exact extracted value, the source document filename, the reasoning, and a confidence score. Ambiguous cases are *never silently disqualified* — they're flagged for human review with the reason.

**Brief non-negotiables met:** every verdict explainable at the criterion level · ambiguous cases surfaced (never silent reject) · scanned + photograph OCR support · audit-ready end-to-end · synthetic data only · no hosted-LLM on raw PII (synthetic demo only; on-prem swap path documented).

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| Node.js | 18+ |
| npm | 9+ |

---

## Setup

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env.local`:

```env
# Required for AI features (briefing + criteria extraction + evaluation reasoning)
AZURE_OPENAI_API_KEY=your_azure_openai_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2025-01-01-preview

# Toggle pre-baked demo responses on/off (default: true so demo runs without keys)
USE_MOCK_AI=true
```

> **Pre-baked demo mode (`USE_MOCK_AI=true`):** Criteria extraction + bidder evaluation use deterministic mock responses. The dashboard briefing still calls Azure GPT-4.1 for live narration. Set `USE_MOCK_AI=false` for full live AI on every step.
>
> **Without API keys at all:** Everything falls back to deterministic templates. All ingestion + Docling/PaddleOCR + audit trail still work.

```bash
uvicorn main:app --port 8000 --reload
```

Backend on **http://127.0.0.1:8000** · OpenAPI docs at `/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend on **http://localhost:5173** · proxies `/api` → port 8000

### Demo data

Pre-seeded in `backend/tender_eval.db`:
- 1 tender — *Construction of Border Outpost — CRPF Tender 2026-BOP-047*
- 8 criteria (EMD, turnover, GST, PAN, work experience, ISO, blacklisting, solvency)
- 3 bidders with diverse outcomes:
  - **Infra Build Solutions** — Eligible (all docs valid, high OCR confidence)
  - **QuickBuild Contractors** — Not Eligible (turnover below threshold + expired ISO)
  - **Bharat Nirman Enterprises** — Needs Review (scanned EMD + ambiguous third contract value)

To re-seed:
```bash
cd backend && source .venv/bin/activate
python ../demo/seed_demo.py
```

---

## Key features

| Feature | Where |
|---------|-------|
| **AI Procurement Briefing** (Azure GPT-4.1) | `/` Dashboard top card — verdict mix + officer action |
| **Tender criteria extraction** with mandatory/optional + evidence-doc list | Tender detail page · `POST /tenders/upload` |
| **Heterogeneous bidder document parser** — Docling + PaddleOCR fallback | Bidder management page |
| **Per-criterion evaluation** with verdict + extracted value + source doc + confidence | Results matrix |
| **Bulk Evaluate All Bidders** — one click, full panel | Bidders page · `POST /evaluation/{id}/evaluate-all` |
| **Audit-ready evaluation report export** (markdown, sign-off table) | Results page · `GET /evaluation/{id}/export` |
| **"Needs Review" flag** for ambiguous / low-OCR-confidence cases | Throughout — never silent disqualify |
| Smart nav (auto-resolves to first tender) | All pages |

---

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Service health |
| GET | `/api/dashboard/overview` | KPIs + AI briefing |
| POST | `/api/tenders/upload` | Upload tender PDF/DOCX → criteria extraction |
| GET | `/api/tenders/` · `/{id}` | List + tender detail with criteria |
| POST | `/api/bidders/{tender_id}/add` | Add bidder + upload mixed-format documents |
| GET | `/api/bidders/{tender_id}` | List bidders + doc count |
| POST | `/api/evaluation/{tender_id}/evaluate/{bidder_id}` | Evaluate one bidder against all criteria |
| POST | `/api/evaluation/{tender_id}/evaluate-all` | **Bulk evaluate every bidder** in one call |
| GET | `/api/evaluation/{tender_id}/results` | Per-criterion matrix with reasoning + confidence |
| GET | `/api/evaluation/{tender_id}/export` | **Audit-ready markdown report** with sign-off table |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + SQLAlchemy 2 + SQLite (PostgreSQL-portable) |
| Document parsing | **Docling** (typed PDF/DOCX) → **PaddleOCR** (scanned/photos) — automatic fallback |
| AI / LLM | Azure OpenAI GPT-4.1 (enterprise, OpenAI-compatible chat-completions) — fully optional |
| Frontend | React 19 + Vite + TypeScript + Tailwind + lucide-react |
| Data | Synthetic — 1 tender, 8 criteria, 3 bidders with mixed-format mock documents |

---

## Architecture

```
backend/
├── main.py                            FastAPI entry + 4 routers
├── app/
│   ├── database.py                    SQLAlchemy session + idempotent column-add migration
│   ├── models.py                      Tender · Criterion (with is_mandatory + evidence_documents) · Bidder · BidderDocument · EvaluationResult
│   ├── routers/
│   │   ├── tenders.py                 Upload + list + detail
│   │   ├── bidders.py                 Multi-file upload + parse
│   │   ├── evaluation.py              Single + bulk evaluate · audit report export
│   │   └── dashboard.py               KPI rollup + AI briefing
│   └── services/
│       ├── document_parser.py         Docling primary · PaddleOCR fallback · per-page confidence
│       ├── criteria_extractor.py      Azure GPT-4.1 → criteria with mandatory/optional + evidence list
│       ├── evaluator.py               Per-criterion Azure GPT-4.1 verdict + reasoning + confidence
│       ├── llm_client.py              Unified Azure OpenAI client · disk-cached · OpenAI fallback
│       └── mocks.py                   Pre-baked deterministic responses (USE_MOCK_AI=true)

frontend/
├── src/
│   ├── App.tsx                        Sticky nav · gradient logo · live pill · smart redirects
│   ├── api.ts                         Typed client (tenders + bidders + evaluation + dashboard)
│   └── pages/
│       ├── Dashboard.tsx              AI briefing + 5-card KPI strip + tender list
│       ├── TenderDetail.tsx           Criteria viewer (filter by category, mandatory/optional)
│       ├── BidderManagement.tsx       Add bidder · upload docs · Evaluate All · view results
│       └── EvaluationResults.tsx      Per-criterion matrix + Export Audit Report button
```

---

## How AI is used (Azure GPT-4.1 / OpenAI-compatible)

All AI outputs are **grounded** — GPT-4.1 only describes pre-computed scores, extracted values, OCR confidences, and document filenames. Never invents thresholds, criteria, or document contents. Responses cached to `data/llm_cache/` after first call → demo never breaks if network is down.

| Use case | What it does |
|----------|--------------|
| **Criteria extraction** | Reads the tender's full text (header + footer + truncated middle), returns a JSON array of criteria with category, threshold, page reference, mandatory flag, and required-evidence document types |
| **Per-criterion evaluation** | Given one criterion + all bidder documents → returns verdict (eligible/not_eligible/needs_review), extracted value, source document filename, reasoning, confidence (0–1) |
| **Dashboard briefing** | Reads the verdict-count rollup → 3-sentence summary in government-procurement language, calling out the priority for the officer |
| **(Round 2)** Schema mapping suggestion | When new bidder doc types appear, suggests which existing criterion they satisfy |

**Production note:** per the brief's non-negotiables, hosted-LLM use on raw PII is not permitted. Synthetic data only in this repo. The `llm_client.py` interface is OpenAI-compatible — production swaps the URL + auth header for an on-prem inference endpoint (Llama-3 / Mistral 7B). No application code changes.

---

## Methodology — Tender Understanding (Brief Part A)

```
1. Upload PDF / DOCX
2. Docling → markdown + page-level text + 0.95 confidence
   (Falls back to PaddleOCR if scanned tender, with confidence ~0.7)
3. Truncate to 50K chars (header + footer; middle sections sampled)
4. Azure GPT-4.1 with structured prompt → JSON array of criteria
   - category: eligibility | technical | financial
   - is_mandatory: true if failing → bidder ineligible
   - threshold: e.g., ">= 5 Crore", "ISO 9001:2015"
   - evidence_documents: list of doc types bidder must submit
5. Persist Criterion rows; reviewer can edit/override
```

## Methodology — Bidder Document Parsing (Brief Part B)

```
For each uploaded file:
1. Detect type by extension + magic bytes
2. PDF (typed) → Docling → markdown + per-page confidence
3. PDF (scanned) or image (JPG/PNG/TIFF) → PaddleOCR (angle correction, lang=en)
4. If Docling text < 100 chars → re-run with PaddleOCR fallback
5. Persist BidderDocument: filename, doc_type (pan_card / iso_cert / experience_cert / …),
   extracted_text, ocr_used (docling / paddleocr / mixed), confidence (avg per-line)
```

## Methodology — Evaluation + Explainability (Brief Part C)

```
For each (bidder, criterion) pair:
1. Concatenate all bidder docs (with OCR confidence labels)
2. Send to Azure GPT-4.1 with strict JSON-only prompt:
     - "Verdict: eligible | not_eligible | needs_review"
     - "If ambiguous, partial, or low-confidence OCR → needs_review"
     - "NEVER silently disqualify"
3. Parse JSON; on parse failure → 2 retries → fallback to needs_review (audit-safe)
4. Persist EvaluationResult: verdict, extracted_value, reasoning,
   confidence (0-1), source_document filename
5. Roll up to overall_verdict per bidder:
     any not_eligible → NOT_ELIGIBLE
     any needs_review → NEEDS_REVIEW
     else            → ELIGIBLE
```

---

## Model & architecture choices (and why)

| Choice | Reason |
|--------|--------|
| **Docling + PaddleOCR fallback** instead of single OCR | Typed PDFs (most CRPF tenders) extract perfectly with Docling at 0.95 confidence; scanned certificates need PaddleOCR. Two-engine fallback gets best of both. |
| **Per-criterion LLM call** (not one mega-prompt) | Bounded context per call, predictable token cost, isolated retry on parse failure, cleaner audit row per (bidder, criterion). |
| **JSON-only prompt with retry-on-parse-failure** | Eliminates free-text hallucination; verdict is always one of three values. After 2 retries, falls back to *needs_review* — never silent disqualify. |
| **OCR confidence persisted on every doc** | Surfaces low-confidence cases to reviewers; the brief specifically calls out "scanned figures that could not be read with confidence". |
| **Mandatory vs optional flag** | Brief explicitly distinguishes — we extract it from the tender + display it in the criteria view. Failure on optional ≠ disqualification. |
| **Markdown report (not PDF)** | Plain text → version-controllable + git-diffable + signs cleanly. PDF requires extra dependency (weasyprint / reportlab) for marginal demo value. Round 2 adds PDF export. |
| **Azure OpenAI GPT-4.1** for narration & extraction | Enterprise tool requirement of hackathon. Production swaps to on-prem Llama-3 by changing endpoint URL — code unchanged. |

---

## Risks & mitigation

| Risk | Mitigation |
|------|-----------|
| **OCR fails on poor-quality scans** | Two-engine fallback (Docling → PaddleOCR) · per-page confidence persisted · low-confidence flagged in UI · falls back to *needs_review* (never silent reject) |
| **LLM hallucination on extraction** | JSON-only prompt with strict schema · 2 retries with self-correction · field validation post-parse · all extracted values must cite a source document |
| **Wrong silent disqualification** | Three-state verdict (never just yes/no) · *needs_review* on any ambiguity · audit log per criterion · reviewer override allowed |
| **Tender language variation** | LLM trained on Indian govt procurement language · examples in prompt · category-aware prompt (eligibility / technical / financial) |
| **Hosted-LLM on real PII forbidden** | Synthetic-only in repo · `llm_client.py` is endpoint-swappable to on-prem Llama-3 |
| **Scaling beyond 1 tender × 3 bidders** | SQLite → PostgreSQL one-line swap · per-bidder evaluation already isolated (parallelisable in Round 2 with Celery) |
| **Audit gap — exporting the verdict trail** | New `/export` endpoint returns markdown with criteria table + per-bidder verdict matrix + reasoning per row + sign-off table for officers |

---

## Implementation roadmap (Round 2 sandbox)

**Phase 1 — Real CRPF tender ingestion (weeks 1–4)**
- Wire 5 redacted real CRPF tender PDFs · validate extraction precision/recall against manual gold labels
- Tune Docling/PaddleOCR thresholds per document type
- Build mandatory/optional ground-truth set

**Phase 2 — Multi-bidder pilot (weeks 5–8)**
- 1 tender × 20 bidders × 100 documents · Celery worker pool for parallel evaluation
- Reviewer team validates verdicts; precision/recall measured
- Active-learning loop: reviewer overrides feed back into prompt examples

**Phase 3 — On-prem LLM swap (weeks 9–12)**
- Azure OpenAI → Llama-3 70B on-prem (per non-negotiable)
- Benchmark verdict consistency vs Azure baseline
- KAU compliance audit-export with reviewer signing

**Phase 4 — Production hardening (post-pilot)**
- PostgreSQL · S3-backed document store · CDN for report PDFs
- Reviewer SSO via NIC eAuth · per-action signing
- PDF export with seals + page references · multi-language tender support

---

## Production optimisations (deferred for demo, planned for Round 2)

This is a hackathon demo running on a single laptop with SQLite. Real CRPF deployment at hundreds of tenders/year, thousands of bidder documents, multi-region procurement offices needs:

### Performance & scale

| Concern | Demo today | Production |
|---------|-----------|-----------|
| **Database** | SQLite (60 KB) | PostgreSQL on managed RDS · partitioned by tender_id |
| **Indexes** | Defaults | Composite: `(bidder_id, criterion_id)`, partial on `verdict='needs_review'` for fast queue scan |
| **Document storage** | Local disk | S3 / Azure Blob · server-side encryption · presigned URLs to reviewers |
| **OCR runtime** | Synchronous in-process | Celery worker pool · per-document task with progress tracking |
| **LLM evaluation** | Sequential per criterion | Parallel via asyncio gather (Round 2) · rate-limited token bucket |

### Caching

| Layer | Demo | Production |
|-------|------|-----------|
| **AI narration** | File cache (`data/llm_cache/*.txt`) | Redis · 24h TTL · invalidated on criterion edit |
| **Docling output** | Recomputed per upload | S3-backed cache keyed by document hash |
| **Dashboard KPIs** | Live SQL aggregate | Redis 60-second TTL · invalidated on evaluation completion |

### Concurrency & throughput

- **Per-tender lock** in Redis to prevent two reviewers from evaluating the same bidder simultaneously
- **Idempotent evaluation** — re-running on the same bidder is a no-op unless a document is added or a criterion changes
- **Batch evaluation** — `POST /evaluate-all` already exists; Round 2 parallelises with `asyncio.gather` (10× speedup)
- **OCR worker pool** — separate Celery queue for OCR (CPU-bound) vs LLM (network-bound)

### Observability

- **OpenTelemetry traces** on every (tender, bidder, criterion) evaluation — one trace spans OCR → LLM → DB write
- **Prometheus metrics**: `evaluation.duration`, `evaluation.needs_review_rate`, `ocr.confidence_avg`, `llm.token_cost_inr`
- **Grafana dashboard** for procurement HQ · per-tender SLA tracking · weekly *needs_review* clearance report

### Security & compliance

- **No hosted-LLM on real PII** in production · `llm_client.py` swappable to on-prem Llama-3 (one config change)
- **Reviewer signing** · every confirm/override signed with reviewer ID + timestamp + IP (KAU compliance)
- **Document encryption** · at rest (TDE) + in transit (TLS 1.3) · access audit log per document open
- **Reversibility** · every evaluation is append-only · reviewer override stored as new row, never updates the original

### Cost estimate (Round 2 sandbox, 1 tender / week)

- 1 × t3.large API VM + 1 × Redis + 1 × PG + Celery workers: **~₹35K/month**
- Azure OpenAI (cached, ~500 calls/day): **~₹3K/month**
- Document storage (S3): **~₹2K/month**
- Total infrastructure: **~₹40K/month** for the sandbox · scales to ~₹2 lakh/month at full CRPF scale (40+ tenders/month, 1000+ bidder documents).

---

## Submission

- **Hackathon:** PanIIT AI for Bharat
- **Theme:** 3 — AI-Based Tender Evaluation & Eligibility Analysis (CRPF)
- **Team:** Sridhar Suresh · Sruthi Krishnakumar
