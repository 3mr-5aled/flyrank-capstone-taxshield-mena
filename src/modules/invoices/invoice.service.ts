import { prisma } from "../../db/prisma.js";
import { AuditInvoiceInput } from "./invoice.schema.js";
import { TaxRulesEngine, RuleAuditResult } from "../rules/tax-rules.engine.js";

export class InvoiceService {
  public static async auditAndPersist(
    input: AuditInvoiceInput,
    tenantId?: string
  ): Promise<{
    invoiceId: string;
    invoiceNumber: string;
    country: string;
    currency: string;
    status: string;
    isCompliant: boolean;
    hasErrors: boolean;
    findingsCount: number;
    findings: RuleAuditResult["findings"];
    summary: {
      subtotal: number;
      totalVat: number;
      totalAmount: number;
    };
  }> {
    // 1. Run deterministic Layer 1 Tax Rule Engine
    const auditResult = TaxRulesEngine.audit(input);
    const invoiceStatus = auditResult.isCompliant
      ? "COMPLIANT"
      : auditResult.hasErrors
      ? "FLAGGED"
      : "WARNING";

    const currency = input.currency || (input.country === "KSA" ? "SAR" : "EGP");

    // 2. Ensure default tenant exists if no tenantId provided
    let effectiveTenantId = tenantId;
    if (!effectiveTenantId) {
      const defaultTenant = await prisma.tenant.upsert({
        where: { taxId: "DEFAULT_DEMO_TENANT" },
        update: {},
        create: {
          name: "Demo Enterprise LLC",
          taxId: "DEFAULT_DEMO_TENANT",
          country: input.country,
        },
      });
      effectiveTenantId = defaultTenant.id;
    }

    // 3. Persist Invoice, LineItems, and Findings in a transaction
    const savedInvoice = await prisma.invoice.create({
      data: {
        tenantId: effectiveTenantId,
        invoiceNumber: input.invoiceNumber,
        issueDate: new Date(input.issueDate),
        country: input.country,
        supplierName: input.supplierName,
        supplierTaxId: input.supplierTaxId,
        subtotal: input.subtotal,
        totalVat: input.totalVat,
        totalAmount: input.totalAmount,
        currency,
        status: invoiceStatus,
        hasErrors: auditResult.hasErrors,
        lineItems: {
          create: input.lineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
            vatRate: item.vatRate,
            vatAmount: item.vatAmount,
            total: item.total,
          })),
        },
        findings: {
          create: auditResult.findings.map((f) => ({
            ruleCode: f.ruleCode,
            layer: f.layer,
            severity: f.severity,
            messageEn: f.messageEn,
            messageAr: f.messageAr,
            expectedValue: f.expectedValue,
            actualValue: f.actualValue,
          })),
        },
      },
      include: {
        findings: true,
      },
    });

    return {
      invoiceId: savedInvoice.id,
      invoiceNumber: savedInvoice.invoiceNumber,
      country: savedInvoice.country,
      currency: savedInvoice.currency,
      status: savedInvoice.status,
      isCompliant: auditResult.isCompliant,
      hasErrors: auditResult.hasErrors,
      findingsCount: auditResult.findings.length,
      findings: auditResult.findings,
      summary: {
        subtotal: savedInvoice.subtotal,
        totalVat: savedInvoice.totalVat,
        totalAmount: savedInvoice.totalAmount,
      },
    };
  }

  public static async getInvoiceById(id: string) {
    return prisma.invoice.findUnique({
      where: { id },
      include: {
        lineItems: true,
        findings: true,
      },
    });
  }

  public static async listInvoices(limit = 20) {
    return prisma.invoice.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        findings: true,
        lineItems: true,
      },
    });
  }
}
