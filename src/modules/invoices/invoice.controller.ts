import { Request, Response } from "express";
import { AuditInvoiceInputSchema } from "./invoice.schema.js";
import { InvoiceService } from "./invoice.service.js";

export class InvoiceController {
  public static async auditSingle(req: Request, res: Response): Promise<void> {
    const parseResult = AuditInvoiceInputSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed at boundary",
        details: parseResult.error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      });
      return;
    }

    try {
      const result = await InvoiceService.auditAndPersist(parseResult.data);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error("Error auditing invoice:", err);
      res.status(500).json({
        success: false,
        error: "Internal server error during invoice audit",
        message: err.message,
      });
    }
  }

  public static async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const invoice = await InvoiceService.getInvoiceById(id);
      if (!invoice) {
        res.status(404).json({
          success: false,
          error: `Invoice with id '${id}' not found`,
        });
        return;
      }
      res.status(200).json({
        success: true,
        data: invoice,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: "Failed to retrieve invoice",
        message: err.message,
      });
    }
  }

  public static async listAll(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const invoices = await InvoiceService.listInvoices(limit);
      res.status(200).json({
        success: true,
        count: invoices.length,
        data: invoices,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: "Failed to list invoices",
        message: err.message,
      });
    }
  }
}
