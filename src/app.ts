import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerDocument } from "./docs/swagger.js";
import { apiRouter } from "./routes/api.router.js";

export const app = express();

// Security & Parsing Middlewares
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Interactive Swagger UI
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// System Health Route
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "taxshield-mena",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/v1", apiRouter);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled Application Error:", err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.name || "InternalServerError",
    message: err.message || "An unexpected error occurred",
  });
});
