import { prisma } from "../../db/prisma.js";
import { AuditInvoiceInput } from "../invoices/invoice.schema.js";
import { TaxRulesEngine } from "../rules/tax-rules.engine.js";
import { GeminiTaxClassifier } from "../ai/gemini-tax.classifier.js";

export class BatchService {
  public static async createAndQueueBatch(
    name: string,
    invoices: AuditInvoiceInput[],
    tenantId?: string
  ) {
    let effectiveTenantId = tenantId;
    if (!effectiveTenantId) {
      const defaultTenant = await prisma.tenant.upsert({
        where: { taxId: "DEFAULT_DEMO_TENANT" },
        update: {},
        create: {
          name: "Demo Enterprise LLC",
          taxId: "DEFAULT_DEMO_TENANT",
          country: invoices[0]?.country || "KSA",
        },
      });
      effectiveTenantId = defaultTenant.id;
    }

    // 1. Create the Batch record with QUEUED status
    const batch = await prisma.batch.create({
      data: {
        tenantId: effectiveTenantId,
        name: name || `Batch Audit ${new Date().toISOString()}`,
        status: "QUEUED",
        totalInvoices: invoices.length,
        processedCount: 0,
        compliantCount: 0,
        flaggedCount: 0,
        progress: 0.0,
      },
    });

    // 2. Launch background worker off the HTTP request thread
    setImmediate(() => {
      this.processBatchInBackground(batch.id, effectiveTenantId!, invoices);
    });

    return batch;
  }

  private static async processBatchInBackground(
    batchId: string,
    tenantId: string,
    invoices: AuditInvoiceInput[]
  ) {
    try {
      await prisma.batch.update({
        where: { id: batchId },
        data: { status: "PROCESSING" },
      });

      let compliantCount = 0;
      let flaggedCount = 0;

      for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i];

        // Layer 1: Deterministic Tax Rules
        const ruleResult = TaxRulesEngine.audit(inv);

        // Pre-create invoice record so we have an invoiceId for AI analysis
        const currency = inv.currency || (inv.country === "KSA" ? "SAR" : "EGP");
        const savedInvoice = await prisma.invoice.create({
          data: {
            tenantId,
            batchId,
            invoiceNumber: inv.invoiceNumber,
            issueDate: new Date(inv.issueDate),
            country: inv.country,
            supplierName: inv.supplierName,
            supplierTaxId: inv.supplierTaxId,
            subtotal: inv.subtotal,
            totalVat: inv.totalVat,
            totalAmount: inv.totalAmount,
            currency,
            status: "PENDING",
            hasErrors: false,
            lineItems: {
              create: inv.lineItems.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                subtotal: item.subtotal,
                vatRate: item.vatRate,
                vatAmount: item.vatAmount,
                total: item.total,
              })),
            },
          },
        });

        // Layer 2: Gemini AI Semantic Arabic & Expense Anomaly Classifier
        const aiResult = await GeminiTaxClassifier.analyzeInvoice(
          savedInvoice.id,
          inv.supplierName,
          inv.country,
          inv.lineItems.map((l) => ({ description: l.description, subtotal: l.subtotal }))
        );

        // Combine findings from both layers
        const allFindings = [...ruleResult.findings, ...aiResult.findings];
        const hasErrors =
          ruleResult.hasErrors ||
          aiResult.hasSemanticAnomaly ||
          allFindings.some((f) => f.severity === "CRITICAL" || f.severity === "HIGH");

        const finalStatus = allFindings.length === 0 ? "COMPLIANT" : hasErrors ? "FLAGGED" : "WARNING";

        if (finalStatus === "COMPLIANT") {
          compliantCount++;
        } else {
          flaggedCount++;
        }

        // Save findings and update invoice status
        if (allFindings.length > 0) {
          await prisma.auditFinding.createMany({
            data: allFindings.map((f) => ({
              invoiceId: savedInvoice.id,
              ruleCode: f.ruleCode,
              layer: f.layer,
              severity: f.severity,
              messageEn: f.messageEn,
              messageAr: f.messageAr,
              expectedValue: f.expectedValue,
              actualValue: f.actualValue,
            })),
          });
        }

        await prisma.invoice.update({
          where: { id: savedInvoice.id },
          data: {
            status: finalStatus,
            hasErrors,
          },
        });

        // Update batch progress percentage
        const processedCount = i + 1;
        const progress = Number(((processedCount / invoices.length) * 100).toFixed(1));

        await prisma.batch.update({
          where: { id: batchId },
          data: {
            processedCount,
            compliantCount,
            flaggedCount,
            progress,
          },
        });
      }

      // Mark batch completed
      await prisma.batch.update({
        where: { id: batchId },
        data: {
          status: "COMPLETED",
          progress: 100.0,
        },
      });
    } catch (err: any) {
      console.error(`Batch ${batchId} processing failed:`, err);
      await prisma.batch.update({
        where: { id: batchId },
        data: {
          status: "FAILED",
          error: err.message,
        },
      });
    }
  }

  public static async getBatchById(id: string) {
    return prisma.batch.findUnique({
      where: { id },
      include: {
        invoices: {
          include: {
            findings: true,
            lineItems: true,
          },
        },
      },
    });
  }

  public static async listBatches(limit = 20) {
    return prisma.batch.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { invoices: true } },
      },
    });
  }
}
