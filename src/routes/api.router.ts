import { Router } from "express";
import { InvoiceController } from "../modules/invoices/invoice.controller.js";
import { BatchController } from "../modules/batches/batch.controller.js";

export const apiRouter = Router();

// Single invoice audit (Milestone 2)
apiRouter.post("/invoices/audit-single", InvoiceController.auditSingle);
apiRouter.get("/invoices", InvoiceController.listAll);
apiRouter.get("/invoices/:id", InvoiceController.getById);

// Batch audit & asynchronous queue (Milestone 3)
apiRouter.post("/batches", BatchController.createBatch);
apiRouter.get("/batches/:id", BatchController.getBatchStatus);
apiRouter.get("/batches/:id/report.pdf", BatchController.downloadPdfReport);

// AI token and cost monitoring (Milestone 3)
apiRouter.get("/audit/costs", BatchController.getCostAudit);
