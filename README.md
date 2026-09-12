# TaxShield MENA 🛡️
### AI-Powered Pre-Filing Tax Compliance & Supplier Invoice Risk Auditor

> **FlyRank Backend Track Capstone — Your 10x Solution**  
> **Target Jurisdiction:** Middle East (Saudi Arabia ZATCA Phase 2 & Egypt ETA compliance)  
> **Stack:** Node.js / TypeScript · Express · SQLite / PostgreSQL · Gemini Flash 1.5 · PDFKit · Zod · Swagger UI  
> **Difficulty:** Medium–Hard | **Total Budget:** ~35–50 hours | **Cost:** $0 (Free tiers & zero-credit-card stack)

---

## 1. The 10x Solution Pitch

### The Problem
In the Middle East, enterprises face strict government e-invoicing mandates (Saudi Arabia ZATCA Phase 2 and Egypt ETA) where declaring non-compliant supplier invoices or claiming ineligible input VAT leads to crippling tax audits and heavy penalties. Finance teams manually review hundreds of incoming invoices every month to check mathematical accuracy, verify supplier tax IDs, and catch misclassified personal expenses. Manual audits take days and routinely miss fraudulent deductions and arithmetic discrepancies before quarterly filing deadlines.

### The 10x Claim
> **"Manually auditing 200 supplier invoices takes an accounting team 2 full days; TaxShield MENA audits the entire batch, catches tax fraud & arithmetic anomalies with dual-layer AI, and exports an executive tax audit PDF in under 60 seconds."**

### Explicit Non-Goals (Scope Guard)
* **No Live Tax Authority Submission:** TaxShield MENA is strictly a **pre-filing audit & risk-detection engine**. It does not transmit live invoices to ZATCA or ETA government servers.
* **No Full ERP / General Ledger:** It does not do payroll or double-entry bookkeeping.
* **No Payments:** No real banking or card processing.

---

## 2. System Architecture & Dual-Layer Audit Model

TaxShield MENA uses a dual-layer architecture so arithmetic is 100% deterministic, while semantic expense anomalies are understood by Gemini AI:

```
                          [Client / Accountant]
                                    │
                    POST /api/v1/batches (Invoices JSON)
                                    │
                                    ▼
                       [Express REST API + Zod]
                       ├── Tenant-Isolated Auth Guard
                       └── Strict Boundary Schema Validation (Clean 4xx)
                                    │
                                    ▼
                         [Background Worker Queue]
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
  ┌─────────────────────────────┐               ┌─────────────────────────────┐
  │    LAYER 1: RULE ENGINE     │               │     LAYER 2: GEMINI AI      │
  │    (Deterministic Code)     │               │    (Semantic Understanding) │
  ├─────────────────────────────┤               ├─────────────────────────────┤
  │ • Subtotal + VAT = Total    │               │ • Arabic expense parsing    │
  │ • 15% KSA / 14% Egypt VAT   │               │ • Disguised personal luxury │
  │ • Line vs Header math check │               │ • CapEx as OpEx write-offs  │
  │ • Saudi 15-digit TIN pattern│               │ • Commercial activity match │
  │ • Egyptian 9-digit Tax ID   │               │ • Bilingual risk notes      │
  │ • ZATCA QR Base64 TLV format│               │ • Per-call token cost log   │
  └──────────────┬──────────────┘               └──────────────┬──────────────┘
                 │                                             │
                 └──────────────────────┬──────────────────────┘
                                        │
                                        ▼
                             [Relational Database]
                         (Invoices, Findings, Costs)
                                        │
                                        ▼
                          [PDFKit Executive Reporter]
                           (Downloadable Tax Audit)
```

---

## 3. The 5+ Program Concepts

| Concept | Implementation in TaxShield MENA | Proven in Code |
|---|---|---|
| **1. API Endpoints & Validation** | REST HTTP API with Zod validation. Bad input strictly yields clean 400 JSON errors, never 500. | `src/modules/invoices/invoice.schema.ts` |
| **2. Database & Persistence** | Relational schema with SQLite/PostgreSQL, migrations, and tenant isolation. | `prisma/schema.prisma` |
| **3. Authentication & JWT Security** | User registration, bcrypt password hashing, and JWT token issuance protecting tenant data. | `src/modules/auth/auth.service.ts` |
| **4. Background Jobs & Queues** | Asynchronous batch worker (`POST /api/v1/batches`) with live percentage tracking (`0%` $\rightarrow$ `100%`). | `src/modules/batches/batch.service.ts` |
| **5. Reporting (Executive PDF)** | PDFKit generator building an executive audit scorecard with KPI badges and discrepancy tables. | `src/modules/reports/pdf-report.generator.ts` |
| **6. Caching & Fast Lookup** | Deduplication and vendor registration caching. | `src/modules/rules/tax-rules.engine.ts` |
| **7. LLM Integration & Cost Log** | Gemini Flash 1.5 Arabic semantic audit with per-call token counting and USD telemetry. | `src/modules/ai/gemini-tax.classifier.ts` |

---

## 4. Quick Start (Clean Machine in 1 Minute)

### Prerequisites
* Node.js v18+ (tested on Node v20 & v26)
* npm

### Setup & Run
```bash
# 1. Install dependencies
npm install

# 2. Initialize database schema
npm run db:push

# 3. Seed demo data (creates tenants, sample users, batches, and invoices)
npm run seed

# 4. Start the application
npm run dev
```

The system will start on:
* **Interactive Swagger UI:** `http://localhost:3000/docs`
* **Health Check:** `http://localhost:3000/health`

### Seeded Credentials for Testing:
* **Saudi Tenant Accountant:** `accountant@riyadhtech.sa` / `Password123!`
* **Egyptian Tenant Auditor:** `auditor@cairodigital.eg` / `Password123!`

---

## 5. The 5-Minute Demo Walkthrough ("Open X, Click Y, See Z")

Follow these steps to demonstrate the full end-to-end 10x value in under 5 minutes:

### Step 1: Open Swagger UI
1. In your browser, open **`http://localhost:3000/docs`**.
2. Notice the interactive documentation with all routes documented and pre-filled with sample payloads.

### Step 2: Queue a Mixed Batch of Invoices
1. Expand **`POST /api/v1/batches`**.
2. Click **"Try it out"**. The default JSON payload contains 3 real-world test invoices:
   * **Invoice 1:** A clean, 100% compliant Saudi IT consulting invoice (15% VAT).
   * **Invoice 2:** A fraudulent invoice where an accountant hid a **luxury Rolex Gold Watch** (`ساعة يد رولكس ذهبية فاخرة`) under general office supplies.
   * **Invoice 3:** A tampered Egyptian invoice where the stated VAT is 1,000 EGP instead of the required 14% (2,800 EGP).
3. Click **"Execute"**.
4. **See:** Immediate `202 Accepted` response with `status: "QUEUED"` and your unique `batchId`.

### Step 3: Inspect Live Batch Audit Results
1. Copy the `batchId` from the previous step.
2. Expand **`GET /api/v1/batches/{id}`**, paste the `batchId`, and hit **"Execute"**.
3. **See:** `status: "COMPLETED"`, `progress: 100`, `compliantCount: 1`, and `flaggedCount: 2`:
   * The Rolex watch is caught by **`[AI_SEMANTIC]`** with an Arabic and English explanation.
   * The Egyptian invoice is caught by **`[RULE_ENGINE]`** with exact expected vs. actual VAT numbers.

### Step 4: Download the Executive Pre-Filing Tax Audit PDF
1. In your browser address bar or Swagger, visit:
   ```
   http://localhost:3000/api/v1/batches/{batchId}/report.pdf
   ```
2. **See:** A PDF downloads immediately featuring:
   * Executive Scorecards: Total Invoices, Compliance Rate %, and At-Risk Input VAT (highlighted in red).
   * Financial Rollup: Total Spend vs. Safe Claimable VAT Deduction.
   * Itemized discrepancy table with severity badges (`[CRITICAL]`, `[HIGH]`).

### Step 5: Check the AI Cost & Token Telemetry
1. Expand **`GET /api/v1/audit/costs`** and click **"Execute"**.
2. **See:** Real-time financial telemetry showing total AI calls, total prompt/candidate tokens, and calculated USD expenditure.

---

## 6. Automated Test Suite

Run all deterministic rule checks, AI semantic anomaly assertions, and boundary schema tests with one command:

```bash
npm test
```

Expected output:
```
==================================================
🧪 TaxShield MENA — Complete Automated Test Suite
==================================================
1. Testing Layer 1: Deterministic Tax Rules...
  ✅ PASS: Valid KSA 15% invoice is 100% compliant
  ✅ PASS: Rejects invalid Saudi TIN (not 15 digits or not starting/ending with 3)
  ✅ PASS: Catches line-item VAT rate calculation discrepancy
  ✅ PASS: Valid Egyptian 14% VAT invoice passes

2. Testing Layer 2: AI Semantic Arabic Risk Classifier...
  ✅ PASS: Flags personal luxury Rolex watch disguised as business expense
  ✅ PASS: Calculates AI tokens and USD cost
  ✅ PASS: Flags capital asset (Vehicle) improperly expensed as OpEx
  ✅ PASS: Approves legitimate business IT hosting without false flags

3. Testing Boundary Schema Validation (Clean 4xx, Never 500)...
  ✅ PASS: Schema boundary blocks invalid country, negative amounts, empty items
  ✅ PASS: Returns granular field-level validation errors

==================================================
🏁 Test Results: 10 Passed, 0 Failed
==================================================
```

---

## 7. Submission Pack Files

* **`README.md`**: This overview, architecture diagram, setup steps, and 5-minute demo walkthrough.
* **`capstone.yaml`**: Machine-readable evaluator manifest with `run`, `seed`, `test`, and `endpoints`.
* **`EVIDENCE.md`**: Verifiable proof for every acceptance probe.
* **`BUILDLOG.md`**: Honest AI usage log and engineering decision history.
* **`.env.example`**: Safe placeholder environment variables.
* **`docker-compose.yml`**: One-command containerized deployment configuration.

---

## 8. Honest Limitations & Future Work

* **Font Encoding in Local PDF Engine:** Standard PDFKit Helvetica does not bundle Arabic Unicode glyphs natively without external TTF font files; the PDF generator cleans non-ASCII characters in English-facing reports while preserving full Arabic fidelity in the database and API responses.
* **Government Portal Integration:** Currently functions as a pre-filing audit firewall. Direct live submission to the Saudi ZATCA Fatoora API or Egyptian ETA e-invoicing API using cryptographic CSIDs is designed for future production releases.
