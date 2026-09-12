# BUILDLOG.md — AI-Usage & Engineering Log

### Milestone 1 & 2: Ideation, Spec & Walking Skeleton
* Defined the 10x Solution problem statement, scope boundaries, non-goals, and architecture for **TaxShield MENA**.
* Scaffolding the Node.js / TypeScript / Express application with Zod boundary validation, Prisma persistence, and Swagger UI at `/docs`.
* Implemented the deterministic Layer 1 `TaxRulesEngine` covering VAT math (15% KSA / 14% Egypt), line-item aggregations, and Saudi ZATCA / Egyptian Tax ID formats.

### Milestone 3 & 4: Core Concepts & User Authentication
#### What was built:
* **User Authentication & JWT Security (Concept 3)**:
  - Added `User` model linked to `Tenant` in Prisma schema.
  - Implemented bcrypt password hashing and JWT token issuance on `POST /api/v1/auth/register` and `POST /api/v1/auth/login`.
  - Built `requireAuth` and `optionalAuth` middleware verifying Bearer tokens and injecting `req.user`.
  - Secured `GET /api/v1/auth/me` and attached authenticated tenant ID to batch creation.
  - Added Swagger UI `bearerAuth` security scheme so evaluators can authorize and test protected endpoints in `/docs`.
* **Asynchronous Batch Processor (`POST /api/v1/batches`)**: Handles 1 to 200 invoices per batch off the HTTP request thread. Tracks real-time percentage progress (`0%` $\rightarrow$ `100%`), compliant vs. flagged counters, and error states.
* **Layer 2 Gemini AI Semantic Arabic Risk Classifier**: Analyzes Arabic/bilingual line items for disguised luxury expenses, unauthorized CapEx write-offs, and commercial registration mismatches. Includes automated prompt token and output token counting with per-call USD cost calculation stored in `ai_cost_logs`.
* **Executive PDF Audit Report Generator (`GET /api/v1/batches/:id/report.pdf`)**: Uses `pdfkit` to compile boardroom-ready audit reports featuring executive KPI cards (Total Invoices, Compliance Rate %, At-Risk Input VAT), financial spend rollups, and itemized discrepancy breakdown tables.
* **AI Cost & Telemetry API (`GET /api/v1/audit/costs`)**: Aggregates token consumption and financial spend.
* **Automated Test Suite (`npm test`)**: 13 comprehensive tests covering deterministic rules, AI semantic detection, boundary guards, and authentication.
* **Zero-Config Database Seed Script (`npm run seed`)**: Automatically creates sample tenants, demo user credentials (`accountant@riyadhtech.sa` / `Password123!`), and pre-audited invoice batches.

#### Where AI helped:
* Writing bilingual Arabic/English tax error explanations.
* Translating Saudi ZATCA regulatory compliance terminology into schema rule codes.
* Crafting realistic seed test cases representing real-world tax audit scenarios (e.g. luxury watches disguised as consulting supplies).

#### What was manually adjusted / engineered:
* Refined PDF font encoding: standard Helvetica fonts in PDFKit do not embed full Arabic Unicode ranges. Sanitized PDF text stream to avoid rendering corrupt glyphs while preserving full Arabic fidelity in the database and API responses.
* Enforced non-blocking background queue execution with immediate `HTTP 202 Accepted` returning tracking URLs.
