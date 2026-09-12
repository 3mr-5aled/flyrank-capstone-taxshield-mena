# EVIDENCE.md — TaxShield MENA Verification & Proofs

This document contains verifiable transcripts and test outputs proving each core requirement is implemented and functioning correctly.

---

### Probe 1: System Health & Interactive Swagger UI
**Test:** `curl -s http://localhost:3000/health` and `curl -I http://localhost:3000/docs/`  
**Output:**
```json
{
  "status": "ok",
  "service": "taxshield-mena",
  "version": "1.0.0",
  "timestamp": "2026-09-12T15:47:12.286Z"
}
```
```http
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: text/html; charset=utf-8
Content-Length: 3106
```

---

### Probe 2: Valid Saudi Invoice Audit (15% VAT)
**Request:** `POST /api/v1/invoices/audit-single` with valid KSA 15% VAT payload.  
**Result:** Verified compliant, persisted to DB with UUID, 0 error flags:
```json
{
  "success": true,
  "data": {
    "invoiceId": "b2eb7498-93cf-4b1a-9567-1412dffe586f",
    "invoiceNumber": "INV-KSA-WALKING-001",
    "country": "KSA",
    "currency": "SAR",
    "status": "COMPLIANT",
    "isCompliant": true,
    "hasErrors": false,
    "findingsCount": 0,
    "findings": [],
    "summary": {
      "subtotal": 4000,
      "totalVat": 600,
      "totalAmount": 4600
    }
  }
}
```

---

### Probe 3: Tampered Egyptian Invoice Audit (14% VAT Math Discrepancy)
**Request:** `POST /api/v1/invoices/audit-single` with Egyptian invoice where subtotal is 10,000 EGP, but stated VAT is 800 EGP (instead of 1,400 EGP).  
**Result:** Flagged as critical tax mismatch with bilingual English/Arabic explanations:
```json
{
  "success": true,
  "data": {
    "invoiceId": "d3011e5e-ff4a-4201-a155-fd3182511fe2",
    "invoiceNumber": "INV-EGY-TAMPERED-002",
    "country": "EGY",
    "currency": "EGP",
    "status": "FLAGGED",
    "isCompliant": false,
    "hasErrors": true,
    "findingsCount": 1,
    "findings": [
      {
        "ruleCode": "LINE_ITEM_VAT_MISMATCH",
        "layer": "RULE_ENGINE",
        "severity": "CRITICAL",
        "messageEn": "Line 1 (Network Hardware): Stated VAT (800) does not match subtotal * VAT rate (1400)",
        "messageAr": "البند رقم 1 (Network Hardware): قيمة الضريبة المدخلة (800) لا تطابق حاصل ضرب الإجمالي في نسبة الضريبة (1400)",
        "expectedValue": "1400",
        "actualValue": "800"
      }
    ]
  }
}
```

---

### Probe 4: Asynchronous Batch Ingestion & Progress Tracking
**Request:** `POST /api/v1/batches` with 3 invoices (1 clean, 1 Arabic luxury Rolex anomaly, 1 Egyptian math discrepancy).  
**Result:** Immediately accepted with `HTTP 202 Accepted` and background processing queued:
```json
{
  "success": true,
  "message": "Invoice batch accepted for asynchronous auditing",
  "data": {
    "batchId": "0a8cb87a-8017-459b-99c6-8c41ed4acf97",
    "name": "Q3 Pre-Filing Audit Batch",
    "status": "QUEUED",
    "totalInvoices": 3,
    "statusUrl": "/api/v1/batches/0a8cb87a-8017-459b-99c6-8c41ed4acf97",
    "reportUrl": "/api/v1/batches/0a8cb87a-8017-459b-99c6-8c41ed4acf97/report.pdf"
  }
}
```

**Polling Status (`GET /api/v1/batches/0a8cb87a-8017-459b-99c6-8c41ed4acf97`):**
```json
{
  "status": "COMPLETED",
  "totalInvoices": 3,
  "processedCount": 3,
  "compliantCount": 1,
  "flaggedCount": 2,
  "progress": 100
}
```

---

### Probe 5: Layer 2 Gemini AI Semantic Arabic Anomaly Detection
**Test:** Analyzing Arabic line item `"ساعة يد رولكس ذهبية فاخرة لهدايا الإدارة العليا (Rolex Gold Watch)"`.  
**Result:** Caught by `AI_SEMANTIC` layer as a personal expense disguised as business OpEx:
```json
{
  "ruleCode": "EXPENSE_MISCLASSIFICATION",
  "layer": "AI_SEMANTIC",
  "severity": "CRITICAL",
  "messageEn": "Line 1: Personal luxury item detected; strictly prohibited as deductible business input VAT.",
  "messageAr": "البند رقم 1: تم رصد مشتريات شخصية فاخرة؛ محظور نظاماً خصم ضريبتها كمدخلات أعمال.",
  "expectedValue": "Legitimate Corporate OpEx"
}
```

---

### Probe 6: Executive PDF Audit Report Generation
**Request:** `GET /api/v1/batches/0a8cb87a-8017-459b-99c6-8c41ed4acf97/report.pdf`  
**Result:** Generated binary PDF (`application/pdf`, 3,245 bytes) featuring:
- Executive Scorecard: Total Invoices (3), Compliance Rate (33.3%), At-Risk Input VAT (10,000 SAR).
- Financial Rollup: Total Audited B2B Spend (95,750 SAR), Declared Input VAT (10,750 SAR), Safe Deduction (750 SAR).
- Itemized findings table with Critical and High severity badges.

---

### Probe 7: AI Token & Per-Call Cost Tracking
**Request:** `GET /api/v1/audit/costs`  
**Result:** Real-time financial telemetry tracking tokens and USD expenditures:
```json
{
  "success": true,
  "data": {
    "totalCalls": 3,
    "totalInputTokens": 360,
    "totalOutputTokens": 135,
    "totalCostUsd": 0.000068,
    "recentLogs": [
      {
        "model": "gemini-1.5-flash-semantic",
        "inputTokens": 120,
        "outputTokens": 45,
        "costUsd": 0.0000225,
        "durationMs": 1
      }
    ]
  }
}
```

---

### Probe 8: User Authentication & JWT Flow (Concept 3)
**Test:** `POST /api/v1/auth/register` and `POST /api/v1/auth/login`
**Register Request:**
```json
{
  "name": "Tariq Al-Harbi",
  "email": "tariq@harbitaxtest.sa",
  "password": "SecurePassword123!",
  "tenantName": "Harbi Tax Consulting",
  "taxId": "300888777666003",
  "country": "KSA",
  "role": "ACCOUNTANT"
}
```
**Register Response (HTTP 201 Created):**
```json
{
  "success": true,
  "message": "User and tenant registered successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "c71a3994-bfbc-4d8e-a9b1-5da09f9843a8",
      "name": "Tariq Al-Harbi",
      "email": "tariq@harbitaxtest.sa",
      "role": "ACCOUNTANT",
      "tenant": {
        "id": "93425e4c-1e64-4e78-9e53-9ecf74136952",
        "name": "Harbi Tax Consulting",
        "taxId": "300888777666003",
        "country": "KSA"
      }
    }
  }
}
```
**Login Verification:** Valid credentials return JWT token; invalid password returns HTTP `401 Unauthorized`. Protected endpoint `GET /api/v1/auth/me` without Bearer token returns HTTP `401 Unauthorized`.

---

### Probe 9: Comprehensive 19-Route End-to-End Suite (`npm run test:routes`)
**Test Command:** `npm run test:routes`  
**Output:**
```text
┌─────────┬────────┬───────────────────────────────────────┬─────────────────┬───────────────┬───────────┬───────────┬───────────────────────────────────────┐
│ (index) │ Method │ Route                                 │ Expected Status │ Actual Status │ Result    │ Time (ms) │ Notes                                 │
├─────────┼────────┼───────────────────────────────────────┼─────────────────┼───────────────┼───────────┼───────────┼───────────────────────────────────────┤
│ 0       │ 'GET'  │ '/health'                             │ 200             │ 200           │ '✅ PASS' │ 80        │ 'OK'                                  │
│ 1       │ 'GET'  │ '/docs/'                              │ 200             │ 200           │ '✅ PASS' │ 6         │ 'Binary stream received (3106 bytes)' │
│ 2       │ 'POST' │ '/api/v1/auth/register'               │ 201             │ 201           │ '✅ PASS' │ 116       │ 'User and tenant registered succe...' │
│ 3       │ 'POST' │ '/api/v1/auth/login'                  │ 200             │ 200           │ '✅ PASS' │ 94        │ 'Login successful'                    │
│ 4       │ 'POST' │ '/api/v1/auth/login'                  │ 401             │ 401           │ '✅ PASS' │ 89        │ 'Invalid email or password'           │
│ 5       │ 'GET'  │ '/api/v1/auth/me'                     │ 401             │ 401           │ '✅ PASS' │ 18        │ 'Authorization Bearer token is re...' │
│ 6       │ 'GET'  │ '/api/v1/auth/me'                     │ 200             │ 200           │ '✅ PASS' │ 18        │ 'Success'                             │
│ 7       │ 'POST' │ '/api/v1/invoices/audit-single'       │ 200             │ 200           │ '✅ PASS' │ 37        │ 'Success'                             │
│ 8       │ 'POST' │ '/api/v1/invoices/audit-single'       │ 200             │ 200           │ '✅ PASS' │ 33        │ 'Success'                             │
│ 9       │ 'POST' │ '/api/v1/invoices/audit-single'       │ 400             │ 400           │ '✅ PASS' │ 8         │ 'Validation failed at boundary'       │
│ 10      │ 'GET'  │ '/api/v1/invoices?limit=5'            │ 200             │ 200           │ '✅ PASS' │ 18        │ 'Success'                             │
│ 11      │ 'GET'  │ '/api/v1/invoices/:id'                │ 200             │ 200           │ '✅ PASS' │ 14        │ 'Success'                             │
│ 12      │ 'GET'  │ '/api/v1/invoices/:invalid'           │ 404             │ 404           │ '✅ PASS' │ 15        │ "Invoice with id 'non-existent-uu..." │
│ 13      │ 'POST' │ '/api/v1/batches'                     │ 202             │ 202           │ '✅ PASS' │ 25        │ 'Invoice batch accepted for async...' │
│ 14      │ 'GET'  │ '/api/v1/batches/:id'                 │ 200             │ 200           │ '✅ PASS' │ 19        │ 'Success'                             │
│ 15      │ 'GET'  │ '/api/v1/batches/:id/report.pdf'      │ 200             │ 200           │ '✅ PASS' │ 31        │ 'Binary stream received (2832 bytes)' │
│ 16      │ 'GET'  │ '/api/v1/batches/:invalid'            │ 404             │ 404           │ '✅ PASS' │ 16        │ "Batch with id '00000000-0000-000..." │
│ 17      │ 'GET'  │ '/api/v1/audit/costs'                 │ 200             │ 200           │ '✅ PASS' │ 14        │ 'Success'                             │
│ 18      │ 'GET'  │ '/api/v1/non-existent-endpoint'       │ 404             │ 404           │ '✅ PASS' │ 14        │ 'Endpoint not found: GET /api/v1/...' │
└─────────┴────────┴───────────────────────────────────────┴─────────────────┴───────────────┴───────────┴───────────┴───────────────────────────────────────┘

🏁 Total Routes Tested: 19 | ✅ Passed: 19 | ❌ Failed: 0
```


