import { TaxRulesEngine } from "./modules/rules/tax-rules.engine.js";
import { GeminiTaxClassifier } from "./modules/ai/gemini-tax.classifier.js";
import { AuditInvoiceInputSchema } from "./modules/invoices/invoice.schema.js";

async function runTestSuite() {
  console.log("==================================================");
  console.log("🧪 TaxShield MENA — Complete Automated Test Suite");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Layer 1: Deterministic Tax Rules
  console.log("1. Testing Layer 1: Deterministic Tax Rules...");

  // Valid KSA
  const validKsa = {
    invoiceNumber: "T-01",
    issueDate: "2026-09-01",
    country: "KSA" as const,
    supplierName: "Clean Supplier",
    supplierTaxId: "300123456789003",
    subtotal: 1000,
    totalVat: 150,
    totalAmount: 1150,
    lineItems: [
      {
        description: "IT Support",
        quantity: 1,
        unitPrice: 1000,
        subtotal: 1000,
        vatRate: 0.15,
        vatAmount: 150,
        total: 1150,
      },
    ],
  };
  const res1 = TaxRulesEngine.audit(validKsa);
  assert(res1.isCompliant && res1.findings.length === 0, "Valid KSA 15% invoice is 100% compliant");

  // Invalid Saudi TIN
  const badTinKsa = { ...validKsa, supplierTaxId: "123456" };
  const res2 = TaxRulesEngine.audit(badTinKsa);
  assert(
    res2.findings.some((f) => f.ruleCode === "INVALID_TAX_ID"),
    "Rejects invalid Saudi TIN (not 15 digits or not starting/ending with 3)"
  );

  // Line item math error
  const mathErrorInv = {
    ...validKsa,
    lineItems: [
      {
        description: "Servers",
        quantity: 2,
        unitPrice: 500,
        subtotal: 1000,
        vatRate: 0.15,
        vatAmount: 100, // Should be 150!
        total: 1100,
      },
    ],
    totalVat: 100,
    totalAmount: 1100,
  };
  const res3 = TaxRulesEngine.audit(mathErrorInv);
  assert(
    res3.findings.some((f) => f.ruleCode === "LINE_ITEM_VAT_MISMATCH"),
    "Catches line-item VAT rate calculation discrepancy"
  );

  // Egypt 14% VAT check
  const egyInv = {
    invoiceNumber: "T-02",
    issueDate: "2026-09-01",
    country: "EGY" as const,
    supplierName: "Cairo Hardware",
    supplierTaxId: "123-456-789",
    subtotal: 10000,
    totalVat: 1400,
    totalAmount: 11400,
    lineItems: [
      {
        description: "Cables",
        quantity: 10,
        unitPrice: 1000,
        subtotal: 10000,
        vatRate: 0.14,
        vatAmount: 1400,
        total: 11400,
      },
    ],
  };
  const res4 = TaxRulesEngine.audit(egyInv);
  assert(res4.isCompliant, "Valid Egyptian 14% VAT invoice passes");

  // 2. Layer 2: Gemini AI Semantic Anomaly Classifier
  console.log("\n2. Testing Layer 2: AI Semantic Arabic Risk Classifier...");

  // Luxury Rolex anomaly
  const aiRes1 = await GeminiTaxClassifier.analyzeInvoice("test-inv-01", "Al-Mamlaka", "KSA", [
    { description: "ساعة يد رولكس ذهبية فاخرة", subtotal: 50000 },
  ]);
  assert(
    aiRes1.hasSemanticAnomaly &&
      aiRes1.findings.some((f) => f.ruleCode === "EXPENSE_MISCLASSIFICATION"),
    "Flags personal luxury Rolex watch disguised as business expense"
  );
  assert(aiRes1.costUsd > 0 && aiRes1.inputTokens > 0, "Calculates AI tokens and USD cost");

  // CapEx as OpEx anomaly
  const aiRes2 = await GeminiTaxClassifier.analyzeInvoice("test-inv-02", "Auto Motors", "KSA", [
    { description: "شراء سيارة خاصة فارهة للإدارة", subtotal: 250000 },
  ]);
  assert(
    aiRes2.findings.some((f) => f.ruleCode === "CAPEX_AS_OPEX"),
    "Flags capital asset (Vehicle) improperly expensed as OpEx"
  );

  // Clean corporate OpEx
  const aiRes3 = await GeminiTaxClassifier.analyzeInvoice("test-inv-03", "AWS MENA", "KSA", [
    { description: "Monthly Cloud Hosting Services", subtotal: 3000 },
  ]);
  assert(!aiRes3.hasSemanticAnomaly, "Approves legitimate business IT hosting without false flags");

  // 3. Boundary Schema Guard
  console.log("\n3. Testing Boundary Schema Validation (Clean 4xx, Never 500)...");
  const badPayload = {
    invoiceNumber: "",
    issueDate: "invalid-date",
    country: "GERMANY",
    supplierName: "",
    supplierTaxId: "",
    subtotal: -50,
    totalVat: -10,
    totalAmount: 0,
    lineItems: [],
  };
  const schemaRes = AuditInvoiceInputSchema.safeParse(badPayload);
  assert(!schemaRes.success, "Schema boundary blocks invalid country, negative amounts, empty items");
  if (!schemaRes.success) {
    assert(schemaRes.error.errors.length >= 5, "Returns granular field-level validation errors");
  }

  // 4. Concept 3: User Authentication & JWT Flow
  console.log("\n4. Testing Concept 3: User Authentication & JWT Security...");
  const { AuthService } = await import("./modules/auth/auth.service.js");

  const testEmail = `auditor-${Date.now()}@testcorp.sa`;
  const regResult = await AuthService.register({
    name: "Tariq Al-Harbi",
    email: testEmail,
    password: "SecureTaxPassword123!",
    tenantName: "Harbi Financial Audit LLC",
    taxId: `300${Date.now()}003`.slice(0, 15),
    country: "KSA",
    role: "ACCOUNTANT",
  });
  assert(Boolean(regResult.token && regResult.user.id), "User registration creates user, tenant, and returns valid JWT");

  const loginResult = await AuthService.login({
    email: testEmail,
    password: "SecureTaxPassword123!",
  });
  assert(Boolean(loginResult.token && loginResult.user.email === testEmail), "Valid login returns authenticated JWT token");

  let wrongPassFailed = false;
  try {
    await AuthService.login({ email: testEmail, password: "WrongPassword!" });
  } catch {
    wrongPassFailed = true;
  }
  assert(wrongPassFailed, "Rejects login with invalid credentials");

  console.log("\n==================================================");
  console.log(`🏁 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
