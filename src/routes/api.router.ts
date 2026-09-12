import { Router } from "express";
import { AuthController } from "../modules/auth/auth.controller.js";
import { requireAuth, optionalAuth } from "../modules/auth/auth.middleware.js";
import { InvoiceController } from "../modules/invoices/invoice.controller.js";
import { BatchController } from "../modules/batches/batch.controller.js";

export const apiRouter = Router();

// Authentication Endpoints (Concept 3: Auth & Tenant Isolation)
apiRouter.post("/auth/register", AuthController.register);
apiRouter.post("/auth/login", AuthController.login);
apiRouter.get("/auth/me", requireAuth, AuthController.getMe);

// Single Invoice Audit
apiRouter.post("/invoices/audit-single", optionalAuth, InvoiceController.auditSingle);
apiRouter.get("/invoices", InvoiceController.listAll);
apiRouter.get("/invoices/:id", InvoiceController.getById);

// Batch Audit & Asynchronous Queue
apiRouter.post("/batches", optionalAuth, BatchController.createBatch);
apiRouter.get("/batches/:id", BatchController.getBatchStatus);
apiRouter.get("/batches/:id/report.pdf", BatchController.downloadPdfReport);

// AI Token and Cost Monitoring
apiRouter.get("/audit/costs", BatchController.getCostAudit);
