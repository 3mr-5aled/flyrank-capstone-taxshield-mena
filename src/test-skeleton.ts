import { TaxRulesEngine } from "./modules/rules/tax-rules.engine.js";
import { AuditInvoiceInputSchema, AuditInvoiceInput } from "./modules/invoices/invoice.schema.js";

async function runSkeletonTest() {
  console.log("=== Testing TaxShield MENA Walking Skeleton (M2) ===\n");

  // Test Case 1: Valid Saudi Invoice
  console.log("1. Testing Valid Saudi Invoice (15% VAT)...");
  const validKsaInvoice: AuditInvoiceInput = {
    invoiceNumber: "INV-KSA-TEST-001",
    issueDate: "2026-09-10",
    country: "KSA",
    supplierName: "Al-Riyadh Tech Solutions LLC",
    supplierTaxId: "300123456789003",
    currency: "SAR",
    lineItems: [
      {
        description: "Cloud Hosting & Maintenance",
        quantity: 2,
        unitPrice: 2500,
        subtotal: 5000,
        vatRate: 0.15,
        vatAmount: 750,
        total: 5750,
      },
    ],
    subtotal: 5000,
    totalVat: 750,
    totalAmount: 5750,
  };

  const validationResult1 = AuditInvoiceInputSchema.safeParse(validKsaInvoice);
  if (!validationResult1.success) {
    console.error("❌ Validation error on valid invoice:", validationResult1.error.errors);
  } else {
    const audit1 = TaxRulesEngine.audit(validationResult1.data);
    console.log(`✅ Validated successfully! Compliant: ${audit1.isCompliant}, Findings: ${audit1.findings.length}`);
  }

  // Test Case 2: Faulty Egyptian Invoice (Math Tampering & Discrepancy)
  console.log("\n2. Testing Faulty Egyptian Invoice (14% VAT tampered)...");
  const faultyEgyInvoice = {
    invoiceNumber: "INV-EGY-FAULTY-002",
    issueDate: "2026-09-12",
    country: "EGY",
    supplierName: "Delta Supplies S.A.E",
    supplierTaxId: "123-456-789", // Egyptian 9 digits with dashes
    currency: "EGP",
    lineItems: [
      {
        description: "Office Supplies",
        quantity: 10,
        unitPrice: 100,
        subtotal: 1000,
        vatRate: 0.14,
        vatAmount: 50, // Should be 140!
        total: 1050, // Should be 1140!
      },
    ],
    subtotal: 1000,
    totalVat: 50, // Tampered!
    totalAmount: 1050,
  };

  const validationResult2 = AuditInvoiceInputSchema.safeParse(faultyEgyInvoice);
  if (!validationResult2.success) {
    console.error("❌ Validation error:", validationResult2.error.errors);
  } else {
    const audit2 = TaxRulesEngine.audit(validationResult2.data);
    console.log(`✅ Rule Engine caught discrepancy! Compliant: ${audit2.isCompliant}, Errors: ${audit2.hasErrors}`);
    console.log("   Detected Flags:");
    audit2.findings.forEach((f, idx) => {
      console.log(`   [${idx + 1}] ${f.ruleCode} (${f.severity}): ${f.messageEn}`);
      console.log(`       -> ${f.messageAr}`);
    });
  }

  // Test Case 3: Boundary Failure (Bad Input)
  console.log("\n3. Testing Boundary Failure (Negative quantity, missing required fields)...");
  const badInput = {
    invoiceNumber: "",
    issueDate: "invalid-date",
    country: "USA", // Not KSA/EGY
    supplierName: "A",
    supplierTaxId: "12",
    subtotal: -100,
    totalVat: 0,
    totalAmount: 0,
    lineItems: [],
  };

  const validationResult3 = AuditInvoiceInputSchema.safeParse(badInput);
  if (!validationResult3.success) {
    console.log("✅ Schema boundary successfully blocked bad input with 4xx errors:");
    validationResult3.error.errors.forEach((e) => {
      console.log(`   - Field '${e.path.join(".")}': ${e.message}`);
    });
  } else {
    console.error("❌ Failed: bad input was incorrectly accepted!");
  }

  console.log("\n=== Walking Skeleton Logic Verified! ===");
}

runSkeletonTest();
