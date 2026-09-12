# My 10x Solution — Amr Morcy
### Capstone Overview: TaxShield MENA

**Public Repository:** [https://github.com/3mr-5aled/flyrank-capstone-taxshield-mena](https://github.com/3mr-5aled/flyrank-capstone-taxshield-mena)  
**Author:** Amr Morcy  
**Track:** FlyRank Backend Development  
**Submission:** "Your 10x Solution" Capstone  

---

## Question 1: What is the problem you are solving?

In Saudi Arabia and Egypt, tax authorities (**ZATCA** and **ETA**) have made electronic invoicing mandatory with strict compliance rules. When middle-market businesses receive hundreds of supplier invoices every month, finance teams must audit each one before filing quarterly VAT returns:
1. **Tax ID Verification**: Ensuring vendor tax numbers match official country formats (Saudi 15-digit IDs starting/ending with 3, or Egyptian 9-digit registration numbers).
2. **Arithmetic & Rate Accuracy**: Verifying that line items sum up precisely and apply the mandatory VAT rate (15% in Saudi Arabia, 14% in Egypt). A single rounded riyal or pound can trigger automatic audit penalties.
3. **Disguised Personal Expenses & CapEx Misclassifications**: Dishonest suppliers or employees frequently disguise personal luxury items (e.g. personal Rolex watches, gold jewelry) as "consulting supplies" or improperly write off capital equipment (vehicles, servers) as immediate operational expenses (OpEx) to unlawfully inflate input VAT deductions.

### The Real-World Friction
Auditing 200 supplier invoices by hand takes an internal accounting team **2 full business days (16 hours)** of tedious cross-referencing between PDF invoices, tax portal calculators, and internal spreadsheets. Mistakes lead to denied input tax deductions, severe late-audit fines, and reputational damage.

### The 10x Claim
> **"Manually auditing 200 supplier invoices takes an accounting team 2 full days; TaxShield MENA audits the entire batch, catches tax fraud & arithmetic anomalies with dual-layer AI, and exports an executive tax audit PDF in under 60 seconds."**

---

## Question 2: How did you implement your solution?

### Architectural Overview: The Dual-Layer Audit Engine
Financial systems cannot afford LLM hallucinations on math. TaxShield MENA uses a strict **dual-layer architecture**:
1. **Layer 1: Deterministic Rule Engine (Zero Hallucinations)**: Written in pure TypeScript (`src/modules/tax-engine/tax-rules.engine.ts`), this layer validates tax IDs, enforces arithmetic integrity down to the decimal cent, validates country-specific VAT rates, and checks line item sums.
2. **Layer 2: Gemini AI Semantic Arabic Classifier (`gemini-1.5-flash`)**: The line items and invoice descriptions are inspected by an LLM trained to understand Arabic and bilingual MENA business semantics (`src/modules/ai/gemini-tax.classifier.ts`). It flags personal luxury expenses, OpEx vs. CapEx mismatches, and logs input/output tokens along with exact USD API costs for every call. If offline or running without an API key, it seamlessly falls back to a deterministic semantic dictionary so tests never fail.

### Background Asynchronous Processing
Large invoice batches (`1` to `200` invoices) are submitted via `POST /api/v1/batches`. The system responds immediately with `HTTP 202 Accepted` and an asynchronous tracking URL. A background worker audits the invoices sequentially off the HTTP request thread, updating live percentage progress (`0%` $\rightarrow$ `100%`), compliant vs. flagged counters, and persisting each invoice and finding to the database.

### Executive PDF Audit Report Generation
Once a batch completes, accountants download a boardroom-ready PDF audit report (`GET /api/v1/batches/:id/report.pdf`). Built with `pdfkit`, the report contains:
* Visual KPI summary cards (Total Invoices, Compliance Rate %, Flagged Invoices, At-Risk Input VAT).
* Financial spend rollups (Total Subtotal, Deductible VAT, Total Disputed/At-Risk VAT).
* An itemized discrepancy breakdown table detailing invoice numbers, suppliers, severity badges (CRITICAL, WARNING), and bilingual error explanations.

---

### Program Concepts Implemented (5 Concepts + 1 Swap)

| # | Concept | Where It Lives in the Code | Details |
|---|---|---|---|
| **1** | **API Endpoints** | `src/routes/api.routes.ts`, `src/modules/invoices/invoice.schema.ts` | RESTful HTTP API with Zod schema validation boundaries, semantic HTTP status codes (`200`, `201`, `202`, `400`, `401`, `404`), and interactive Swagger UI at `/docs`. |
| **2** | **Database** | `prisma/schema.prisma`, `src/config/database.ts` | Relational SQLite persistence via Prisma ORM (`dev.db`). Tables for `tenants`, `users`, `batches`, `invoices`, `line_items`, `audit_findings`, and `ai_cost_logs`. Data survives restarts. |
| **3** | **Authentication** | `src/modules/auth/auth.routes.ts`, `src/modules/auth/auth.middleware.ts` | Multi-tenant auth with bcrypt password hashing, signed JWT tokens, and `requireAuth` middleware protecting sensitive routes with HTTP `401`. |
| **4** | **Background Jobs** | `src/modules/batches/batch-queue.service.ts` | Asynchronous batch auditor processing up to 200 invoices off the HTTP thread with real-time percentage progress tracking (`0%` $\rightarrow$ `100%`). |
| **5** | **Reporting (PDF)** | `src/modules/reports/pdf-report.generator.ts` | Boardroom-ready PDF reports generated with `pdfkit` featuring executive KPI cards, financial rollups, and discrepancy tables. |
| **7** | **LLM Integration** | `src/modules/ai/gemini-tax.classifier.ts` | Google Gemini 1.5 Flash integration classifying Arabic/English line items for tax fraud with per-call token and USD cost tracking in `ai_cost_logs`. |
| *Swap* | **Test Suite** *(in place of Caching Logic)* | `src/test-all.ts`, `src/test-all-routes.ts` | Caching was swapped for a comprehensive automated test suite (13 unit/integration tests + 19 end-to-end route tests) because tax auditing mandates fresh, deterministic evaluation on every batch without stale cached results. |

---

## Steps to Run on a Clean Machine

### Option A: Local Run (Node.js 18+)

```powershell
# 1. Clone the repository
git clone https://github.com/3mr-5aled/flyrank-capstone-taxshield-mena.git
cd flyrank-capstone-taxshield-mena

# 2. Install dependencies
npm install

# 3. Initialize database and seed demo data
npm run db:push
npm run seed

# 4. Run the automated test suites
npm test               # Runs 13 unit & integration tests
npm run test:routes    # Tests all 19 HTTP routes end-to-end

# 5. Start the development server
npm run dev
```

The server starts at `http://localhost:3000`.

### Option B: Docker Run (Zero Local Node.js Required)

```bash
docker compose up --build
```

---

## 5-Minute Evaluator Demo Path

1. **Check System Health**:
   Open `http://localhost:3000/health` in your browser. Notice the clean `HTTP 200 OK` status.
2. **Explore Swagger UI Documentation**:
   Navigate to `http://localhost:3000/docs` to see the full interactive OpenAPI specification.
3. **Log In as Pre-Seeded Auditor**:
   Execute `POST /api/v1/auth/login` with:
   ```json
   {
     "email": "accountant@riyadhtech.sa",
     "password": "Password123!"
   }
   ```
   Copy the returned JWT `token` and paste it into the **Authorize** button in Swagger (`Bearer <token>`).
4. **Audit a High-Risk Batch**:
   Execute `POST /api/v1/batches` with a batch containing compliant and fraudulent invoices (e.g. personal Rolex watch disguised as consulting supplies). Note the immediate `HTTP 202 Accepted` response with batch ID.
5. **Poll Real-Time Progress**:
   Poll `GET /api/v1/batches/:id` until `progress` reaches `100%` and `status` is `COMPLETED`.
6. **Download Executive PDF Audit Report**:
   Navigate to `http://localhost:3000/api/v1/batches/:id/report.pdf` in your browser. Review the generated executive PDF report with KPI cards and discrepancy tables.
7. **Inspect AI Cost Telemetry**:
   Call `GET /api/v1/audit/costs` to verify exact token consumption and USD expenses logged by Gemini AI.
