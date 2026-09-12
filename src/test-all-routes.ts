const BASE_URL = "http://localhost:3000";

interface RouteTestResult {
  route: string;
  method: string;
  expectedStatus: number;
  actualStatus: number;
  statusText: string;
  durationMs: number;
  passed: boolean;
  notes: string;
}

const results: RouteTestResult[] = [];

async function testRoute(
  method: string,
  path: string,
  expectedStatus: number,
  payload?: any,
  headers: Record<string, string> = {},
  isBinary = false
): Promise<{ status: number; data: any; headers: Headers }> {
  const start = Date.now();
  const url = `${BASE_URL}${path}`;

  const fetchOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (payload && method !== "GET") {
    fetchOptions.body = JSON.stringify(payload);
  }

  let status = 0;
  let data: any = null;
  let resHeaders: Headers = new Headers();

  try {
    const res = await fetch(url, fetchOptions);
    status = res.status;
    resHeaders = res.headers;

    if (isBinary) {
      const buffer = await res.arrayBuffer();
      data = { length: buffer.byteLength, isBuffer: true };
    } else {
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
  } catch (err: any) {
    status = 0;
    data = { error: err.message };
  }

  const durationMs = Date.now() - start;
  const passed = status === expectedStatus;

  results.push({
    method,
    route: path,
    expectedStatus,
    actualStatus: status,
    statusText: passed ? "PASS" : "FAIL",
    durationMs,
    passed,
    notes: passed
      ? isBinary
        ? `Binary stream received (${data?.length} bytes)`
        : typeof data === "object"
        ? (data?.message || data?.error || (data?.success ? "Success" : "OK"))
        : "HTML response"
      : `Expected ${expectedStatus}, got ${status}`,
  });

  return { status, data, headers: resHeaders };
}

async function runAllRouteTests() {
  console.log("==========================================================================");
  console.log("🚀 Testing All TaxShield MENA Endpoints End-to-End");
  console.log("==========================================================================\n");

  // 1. Health Check
  await testRoute("GET", "/health", 200);

  // 2. Swagger UI Docs
  await testRoute("GET", "/docs/", 200, undefined, {}, true);

  // 3. Auth: Register
  const uniqueEmail = `test.auditor.${Date.now()}@taxshield.sa`;
  const registerRes = await testRoute("POST", "/api/v1/auth/register", 201, {
    name: "Automated Test Auditor",
    email: uniqueEmail,
    password: "StrongPassword123!",
    tenantName: "Global Assurance Audit Corp",
    taxId: `300${Date.now()}003`.slice(0, 15),
    country: "KSA",
    role: "AUDITOR",
  });

  const authToken = registerRes.data?.data?.token;

  // 4. Auth: Login (Valid)
  const loginRes = await testRoute("POST", "/api/v1/auth/login", 200, {
    email: "accountant@riyadhtech.sa",
    password: "Password123!",
  });

  const seedUserToken = loginRes.data?.data?.token || authToken;

  // 5. Auth: Login (Invalid Password) -> 401
  await testRoute("POST", "/api/v1/auth/login", 401, {
    email: "accountant@riyadhtech.sa",
    password: "WrongPassword!",
  });

  // 6. Auth: GET /api/v1/auth/me (Unauthorized) -> 401
  await testRoute("GET", "/api/v1/auth/me", 401);

  // 7. Auth: GET /api/v1/auth/me (Authorized with Bearer Token) -> 200
  await testRoute("GET", "/api/v1/auth/me", 200, undefined, {
    Authorization: `Bearer ${seedUserToken}`,
  });

  // 8. Invoices: Audit Single (Compliant Saudi 15% VAT) -> 200
  const singleCompliantRes = await testRoute(
    "POST",
    "/api/v1/invoices/audit-single",
    200,
    {
      invoiceNumber: `INV-TEST-CLEAN-${Date.now()}`,
      issueDate: "2026-09-10",
      country: "KSA",
      supplierName: "Apex Cloud Services",
      supplierTaxId: "300123456789003",
      currency: "SAR",
      subtotal: 5000,
      totalVat: 750,
      totalAmount: 5750,
      lineItems: [
        {
          description: "Enterprise Database Maintenance",
          quantity: 1,
          unitPrice: 5000,
          subtotal: 5000,
          vatRate: 0.15,
          vatAmount: 750,
          total: 5750,
        },
      ],
    },
    { Authorization: `Bearer ${seedUserToken}` }
  );

  const createdInvoiceId = singleCompliantRes.data?.data?.invoiceId;

  // 9. Invoices: Audit Single (Tampered Egyptian 14% VAT Math Discrepancy) -> 200 with FLAGGED status
  await testRoute(
    "POST",
    "/api/v1/invoices/audit-single",
    200,
    {
      invoiceNumber: `INV-TEST-TAMPERED-${Date.now()}`,
      issueDate: "2026-09-12",
      country: "EGY",
      supplierName: "Delta Nile Trading S.A.E",
      supplierTaxId: "123-456-789",
      currency: "EGP",
      subtotal: 10000,
      totalVat: 500, // Should be 1400!
      totalAmount: 10500,
      lineItems: [
        {
          description: "Office Paper Supplies",
          quantity: 10,
          unitPrice: 1000,
          subtotal: 10000,
          vatRate: 0.14,
          vatAmount: 500, // Discrepancy!
          total: 10500,
        },
      ],
    }
  );

  // 10. Invoices: Audit Single (Boundary Validation Failure: Negative Subtotal) -> 400
  await testRoute("POST", "/api/v1/invoices/audit-single", 400, {
    invoiceNumber: "",
    issueDate: "invalid-date",
    country: "INVALID",
    supplierName: "",
    supplierTaxId: "",
    subtotal: -100,
    totalVat: 0,
    totalAmount: 0,
    lineItems: [],
  });

  // 11. Invoices: List All Invoices -> 200
  await testRoute("GET", "/api/v1/invoices?limit=5", 200);

  // 12. Invoices: Get Invoice By ID -> 200
  if (createdInvoiceId) {
    await testRoute("GET", `/api/v1/invoices/${createdInvoiceId}`, 200);
  }

  // 13. Invoices: Get Non-Existent Invoice -> 404
  await testRoute("GET", "/api/v1/invoices/non-existent-uuid-12345", 404);

  // 14. Batches: Queue Asynchronous Batch -> 202 Accepted
  const batchQueueRes = await testRoute(
    "POST",
    "/api/v1/batches",
    202,
    {
      name: "Automated E2E Audit Batch",
      invoices: [
        {
          invoiceNumber: `BATCH-KSA-01-${Date.now()}`,
          issueDate: "2026-09-01",
          country: "KSA",
          supplierName: "Riyadh Office Supplies",
          supplierTaxId: "300999888777003",
          currency: "SAR",
          subtotal: 3000,
          totalVat: 450,
          totalAmount: 3450,
          lineItems: [
            {
              description: "Ergonomic Chairs",
              quantity: 3,
              unitPrice: 1000,
              subtotal: 3000,
              vatRate: 0.15,
              vatAmount: 450,
              total: 3450,
            },
          ],
        },
        {
          invoiceNumber: `BATCH-KSA-ROLEX-${Date.now()}`,
          issueDate: "2026-09-05",
          country: "KSA",
          supplierName: "VIP Luxury Gifts",
          supplierTaxId: "300444555666003",
          currency: "SAR",
          subtotal: 40000,
          totalVat: 6000,
          totalAmount: 46000,
          lineItems: [
            {
              description: "ساعة يد رولكس ذهبية فاخرة للإدارة",
              quantity: 1,
              unitPrice: 40000,
              subtotal: 40000,
              vatRate: 0.15,
              vatAmount: 6000,
              total: 46000,
            },
          ],
        },
      ],
    },
    { Authorization: `Bearer ${seedUserToken}` }
  );

  const batchId = batchQueueRes.data?.data?.batchId;

  // Wait 1.5s for worker queue to finish
  await new Promise((r) => setTimeout(r, 1500));

  // 15. Batches: Get Batch Status -> 200
  if (batchId) {
    await testRoute("GET", `/api/v1/batches/${batchId}`, 200);

    // 16. Batches: Download Executive PDF Audit Report -> 200 (Binary application/pdf)
    await testRoute("GET", `/api/v1/batches/${batchId}/report.pdf`, 200, undefined, {}, true);
  }

  // 17. Batches: Get Non-Existent Batch -> 404
  await testRoute("GET", "/api/v1/batches/00000000-0000-0000-0000-000000000000", 404);

  // 18. Audit Costs: Query AI Cost Telemetry -> 200
  await testRoute("GET", "/api/v1/audit/costs", 200);

  // 19. Global 404 Handler -> 404
  await testRoute("GET", "/api/v1/non-existent-endpoint", 404);

  // Print Summary Table
  console.log("\n==========================================================================");
  console.log("📊 Route Testing Summary Table");
  console.log("==========================================================================");
  console.table(
    results.map((r) => ({
      Method: r.method,
      Route: r.route.length > 35 ? r.route.slice(0, 32) + "..." : r.route,
      "Expected Status": r.expectedStatus,
      "Actual Status": r.actualStatus,
      Result: r.passed ? "✅ PASS" : "❌ FAIL",
      "Time (ms)": r.durationMs,
      Notes: r.notes.length > 35 ? r.notes.slice(0, 32) + "..." : r.notes,
    }))
  );

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log(`\n🏁 Total Routes Tested: ${results.length}`);
  console.log(`✅ Passed: ${passedCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log("==========================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllRouteTests();
