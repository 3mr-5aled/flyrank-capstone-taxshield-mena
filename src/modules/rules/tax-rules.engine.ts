import { AuditInvoiceInput } from "../invoices/invoice.schema.js";

export interface Finding {
  ruleCode: string;
  layer: "RULE_ENGINE" | "AI_SEMANTIC";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  messageEn: string;
  messageAr: string;
  expectedValue?: string;
  actualValue?: string;
}

export interface RuleAuditResult {
  isCompliant: boolean;
  hasErrors: boolean;
  findings: Finding[];
}

export class TaxRulesEngine {
  private static readonly EPSILON = 0.05; // 0.05 currency units tolerance for rounding

  public static audit(invoice: AuditInvoiceInput): RuleAuditResult {
    const findings: Finding[] = [];

    // 1. Tax Identification Number (TIN) Verification
    this.auditTaxId(invoice, findings);

    // 2. Standard VAT Rate Check per Country
    this.auditVatRates(invoice, findings);

    // 3. Line-Item Mathematics
    let calculatedLineSubtotalSum = 0;
    let calculatedLineVatSum = 0;
    let calculatedLineTotalSum = 0;

    invoice.lineItems.forEach((item, index) => {
      const lineNum = index + 1;
      const expectedSubtotal = Number((item.quantity * item.unitPrice).toFixed(2));
      const expectedVat = Number((item.subtotal * item.vatRate).toFixed(2));
      const expectedTotal = Number((item.subtotal + item.vatAmount).toFixed(2));

      // Line subtotal check
      if (Math.abs(item.subtotal - expectedSubtotal) > this.EPSILON) {
        findings.push({
          ruleCode: "LINE_ITEM_MATH_ERROR",
          layer: "RULE_ENGINE",
          severity: "HIGH",
          messageEn: `Line ${lineNum} (${item.description}): Subtotal (${item.subtotal}) does not match quantity * unit price (${expectedSubtotal})`,
          messageAr: `البند رقم ${lineNum} (${item.description}): المجموع الفرعي (${item.subtotal}) لا يطابق حاصل ضرب الكمية في سعر الوحدة (${expectedSubtotal})`,
          expectedValue: expectedSubtotal.toString(),
          actualValue: item.subtotal.toString(),
        });
      }

      // Line VAT check
      if (Math.abs(item.vatAmount - expectedVat) > this.EPSILON) {
        findings.push({
          ruleCode: "LINE_ITEM_VAT_MISMATCH",
          layer: "RULE_ENGINE",
          severity: "CRITICAL",
          messageEn: `Line ${lineNum} (${item.description}): Stated VAT (${item.vatAmount}) does not match subtotal * VAT rate (${expectedVat})`,
          messageAr: `البند رقم ${lineNum} (${item.description}): قيمة الضريبة المدخلة (${item.vatAmount}) لا تطابق حاصل ضرب الإجمالي في نسبة الضريبة (${expectedVat})`,
          expectedValue: expectedVat.toString(),
          actualValue: item.vatAmount.toString(),
        });
      }

      // Line total check
      if (Math.abs(item.total - expectedTotal) > this.EPSILON) {
        findings.push({
          ruleCode: "LINE_ITEM_TOTAL_MISMATCH",
          layer: "RULE_ENGINE",
          severity: "HIGH",
          messageEn: `Line ${lineNum}: Line total (${item.total}) does not match subtotal + VAT (${expectedTotal})`,
          messageAr: `البند رقم ${lineNum}: إجمالي البند (${item.total}) لا يطابق مجموع القيمة مع الضريبة (${expectedTotal})`,
          expectedValue: expectedTotal.toString(),
          actualValue: item.total.toString(),
        });
      }

      calculatedLineSubtotalSum += item.subtotal;
      calculatedLineVatSum += item.vatAmount;
      calculatedLineTotalSum += item.total;
    });

    // 4. Header Totals vs. Line-Items Aggregations
    if (Math.abs(invoice.subtotal - calculatedLineSubtotalSum) > this.EPSILON) {
      findings.push({
        ruleCode: "HEADER_SUBTOTAL_MISMATCH",
        layer: "RULE_ENGINE",
        severity: "CRITICAL",
        messageEn: `Invoice subtotal (${invoice.subtotal}) does not match sum of line item subtotals (${calculatedLineSubtotalSum.toFixed(2)})`,
        messageAr: `المجموع الفرعي للفاتورة (${invoice.subtotal}) لا يطابق مجموع البنود (${calculatedLineSubtotalSum.toFixed(2)})`,
        expectedValue: calculatedLineSubtotalSum.toFixed(2),
        actualValue: invoice.subtotal.toString(),
      });
    }

    if (Math.abs(invoice.totalVat - calculatedLineVatSum) > this.EPSILON) {
      findings.push({
        ruleCode: "HEADER_VAT_MISMATCH",
        layer: "RULE_ENGINE",
        severity: "CRITICAL",
        messageEn: `Invoice total VAT (${invoice.totalVat}) does not match sum of line item VAT (${calculatedLineVatSum.toFixed(2)})`,
        messageAr: `إجمالي ضريبة الفاتورة (${invoice.totalVat}) لا يطابق مجموع ضرائب البنود (${calculatedLineVatSum.toFixed(2)})`,
        expectedValue: calculatedLineVatSum.toFixed(2),
        actualValue: invoice.totalVat.toString(),
      });
    }

    const expectedInvoiceTotal = Number((invoice.subtotal + invoice.totalVat).toFixed(2));
    if (Math.abs(invoice.totalAmount - expectedInvoiceTotal) > this.EPSILON) {
      findings.push({
        ruleCode: "TOTAL_ARITHMETIC_MISMATCH",
        layer: "RULE_ENGINE",
        severity: "CRITICAL",
        messageEn: `Invoice total amount (${invoice.totalAmount}) does not equal subtotal + total VAT (${expectedInvoiceTotal})`,
        messageAr: `المبلغ الإجمالي للفاتورة (${invoice.totalAmount}) لا يساوي المجموع الفرعي + إجمالي الضريبة (${expectedInvoiceTotal})`,
        expectedValue: expectedInvoiceTotal.toString(),
        actualValue: invoice.totalAmount.toString(),
      });
    }

    // 5. Saudi ZATCA QR Code Structure (if provided)
    if (invoice.country === "KSA" && invoice.qrCode) {
      this.auditZatcaQr(invoice.qrCode, findings);
    }

    const hasCriticalOrHigh = findings.some(
      (f) => f.severity === "CRITICAL" || f.severity === "HIGH"
    );

    return {
      isCompliant: findings.length === 0,
      hasErrors: hasCriticalOrHigh,
      findings,
    };
  }

  private static auditTaxId(invoice: AuditInvoiceInput, findings: Finding[]): void {
    const cleanId = invoice.supplierTaxId.replace(/[\s-]/g, "");

    if (invoice.country === "KSA") {
      // Saudi ZATCA TIN format: exactly 15 digits, starts with 3 and ends with 3
      const ksaPattern = /^3\d{13}3$/;
      if (!ksaPattern.test(cleanId)) {
        findings.push({
          ruleCode: "INVALID_TAX_ID",
          layer: "RULE_ENGINE",
          severity: "CRITICAL",
          messageEn: `Invalid Saudi ZATCA Tax ID (${invoice.supplierTaxId}). Must be 15 digits starting and ending with '3'.`,
          messageAr: `الرقم الضريبي السعودي (${invoice.supplierTaxId}) غير صالح. يجب أن يتكون من 15 رقماً يبدأ وينتهي بالرقم 3.`,
          expectedValue: "15 digits (3xxxxxxxxxxxx3)",
          actualValue: invoice.supplierTaxId,
        });
      }
    } else if (invoice.country === "EGY") {
      // Egyptian ETA Tax Registration: 9 digits
      const egyPattern = /^\d{9}$/;
      if (!egyPattern.test(cleanId)) {
        findings.push({
          ruleCode: "INVALID_TAX_ID",
          layer: "RULE_ENGINE",
          severity: "CRITICAL",
          messageEn: `Invalid Egyptian ETA Tax ID (${invoice.supplierTaxId}). Must be a 9-digit registration number.`,
          messageAr: `رقم التسجيل الضريبي المصري (${invoice.supplierTaxId}) غير صالح. يجب أن يتكون من 9 أرقام.`,
          expectedValue: "9 digits (xxxxxxxxx)",
          actualValue: invoice.supplierTaxId,
        });
      }
    }
  }

  private static auditVatRates(invoice: AuditInvoiceInput, findings: Finding[]): void {
    const standardRate = invoice.country === "KSA" ? 0.15 : 0.14;

    invoice.lineItems.forEach((item, index) => {
      // Allowed rates: Standard rate (15% or 14%), Zero-rated (0%), or Exempt (0%)
      const isStandard = Math.abs(item.vatRate - standardRate) < 0.001;
      const isZeroOrExempt = Math.abs(item.vatRate - 0.0) < 0.001;

      if (!isStandard && !isZeroOrExempt) {
        findings.push({
          ruleCode: "UNEXPECTED_VAT_RATE",
          layer: "RULE_ENGINE",
          severity: "MEDIUM",
          messageEn: `Line ${index + 1}: Unexpected VAT rate ${(item.vatRate * 100).toFixed(1)}% for ${invoice.country}. Standard rate is ${(standardRate * 100)}%.`,
          messageAr: `البند رقم ${index + 1}: نسبة ضريبة غير متوقعة ${(item.vatRate * 100).toFixed(1)}% لـ ${invoice.country}. النسبة القياسية هي ${(standardRate * 100)}%.`,
          expectedValue: `${(standardRate * 100)}% or 0%`,
          actualValue: `${(item.vatRate * 100).toFixed(1)}%`,
        });
      }
    });
  }

  private static auditZatcaQr(qrBase64: string, findings: Finding[]): void {
    try {
      const buffer = Buffer.from(qrBase64, "base64");
      // Check minimal TLV structure: Tag 1 (Seller Name), Tag 2 (VAT Number), Tag 3 (Timestamp)
      if (buffer.length < 10) {
        throw new Error("QR buffer too short to contain mandatory TLV tags");
      }
      // First byte should be tag 1
      if (buffer[0] !== 1) {
        throw new Error("QR data does not follow ZATCA TLV format");
      }
    } catch {
      findings.push({
        ruleCode: "INVALID_ZATCA_QR",
        layer: "RULE_ENGINE",
        severity: "HIGH",
        messageEn: "The provided ZATCA QR code is not valid Base64 TLV format",
        messageAr: "رمز الاستجابة السريعة (QR) لا يطابق معايير ZATCA بتنسيق TLV المشفر بـ Base64",
      });
    }
  }
}
