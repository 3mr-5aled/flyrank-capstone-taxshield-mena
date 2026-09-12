import { Request, Response } from "express";
import { z } from "zod";
import { AuditInvoiceInputSchema } from "../invoices/invoice.schema.js";
import { BatchService } from "./batch.service.js";
import { PdfReportGenerator } from "../reports/pdf-report.generator.js";
import { GeminiTaxClassifier } from "../ai/gemini-tax.classifier.js";

const CreateBatchSchema = z.object({
  name: z.string().optional(),
  invoices: z
    .array(AuditInvoiceInputSchema)
    .min(1, "Batch must contain at least 1 invoice")
    .max(200, "Maximum 200 invoices per batch"),
});

export class BatchController {
  public static async createBatch(req: Request, res: Response): Promise<void> {
    const parseResult = CreateBatchSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed on batch payload",
        details: parseResult.error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      });
      return;
    }

    try {
      const batch = await BatchService.createAndQueueBatch(
        parseResult.data.name || "Pre-Filing Tax Batch Audit",
        parseResult.data.invoices
      );

      // Return HTTP 202 Accepted (Background job queued)
      res.status(202).json({
        success: true,
        message: "Invoice batch accepted for asynchronous auditing",
        data: {
          batchId: batch.id,
          name: batch.name,
          status: batch.status,
          totalInvoices: batch.totalInvoices,
          statusUrl: `/api/v1/batches/${batch.id}`,
          reportUrl: `/api/v1/batches/${batch.id}/report.pdf`,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: "Failed to queue batch",
        message: err.message,
      });
    }
  }

  public static async getBatchStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const batch = await BatchService.getBatchById(id);
      if (!batch) {
        res.status(404).json({
          success: false,
          error: `Batch with id '${id}' not found`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: batch,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: "Failed to fetch batch status",
        message: err.message,
      });
    }
  }

  public static async downloadPdfReport(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const pdfBuffer = await PdfReportGenerator.generateBatchReport(id);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="taxshield-audit-${id.slice(0, 8)}.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (err: any) {
      res.status(err.message.includes("not found") ? 404 : 500).json({
        success: false,
        error: "Failed to generate PDF audit report",
        message: err.message,
      });
    }
  }

  public static async getCostAudit(req: Request, res: Response): Promise<void> {
    try {
      const costSummary = await GeminiTaxClassifier.getCostSummary();
      res.status(200).json({
        success: true,
        data: costSummary,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: "Failed to fetch AI cost log",
        message: err.message,
      });
    }
  }
}
