export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "TaxShield MENA API 🛡️",
    version: "1.0.0",
    description:
      "AI-Powered Pre-Filing Tax Compliance & Supplier Invoice Risk Auditor for Saudi Arabia (ZATCA Phase 2) and Egypt (ETA).",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local Development Server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter your JWT token obtained from /api/v1/auth/login",
      },
    },
  },
  tags: [
    {
      name: "Authentication",
      description: "User registration, authentication, and tenant management",
    },
    {
      name: "Batches",
      description: "Asynchronous batch invoice auditing and PDF report generation",
    },
    {
      name: "Invoices",
      description: "Single invoice ingestion and compliance auditing",
    },
    {
      name: "Audit Costs",
      description: "AI token consumption and cost monitoring",
    },
    {
      name: "System",
      description: "Health checks and service status",
    },
  ],
  paths: {
    "/health": {
      get: {
        summary: "System Health Check",
        tags: ["System"],
        responses: {
          "200": {
            description: "Service is operational",
          },
        },
      },
    },
    "/api/v1/auth/register": {
      post: {
        summary: "Register a new enterprise user and tenant",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                name: "Ahmed Al-Mansoor",
                email: "ahmed@riyadhtech.sa",
                password: "StrongPassword123!",
                tenantName: "Riyadh Digital Enterprise Ltd",
                taxId: "300998877665003",
                country: "KSA",
                role: "ACCOUNTANT",
              },
            },
          },
        },
        responses: {
          "201": { description: "User registered with JWT token" },
          "400": { description: "Validation error or user already exists" },
        },
      },
    },
    "/api/v1/auth/login": {
      post: {
        summary: "Authenticate user and obtain JWT token",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                email: "ahmed@riyadhtech.sa",
                password: "StrongPassword123!",
              },
            },
          },
        },
        responses: {
          "200": { description: "Login successful with JWT token" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/api/v1/auth/me": {
      get: {
        summary: "Get current authenticated user profile",
        tags: ["Authentication"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Current user profile and tenant data" },
          "401": { description: "Unauthorized / missing token" },
        },
      },
    },
    "/api/v1/batches": {
      post: {
        summary: "Queue an asynchronous batch of supplier invoices for dual-layer audit",
        description:
          "Accepts a batch of supplier invoices, queues background processing, executes Layer 1 math and Layer 2 Gemini AI semantic audit off the HTTP thread, and updates progress in real time.",
        tags: ["Batches"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                name: "Q3 2026 Pre-Filing Supplier Batch",
                invoices: [
                  {
                    invoiceNumber: "INV-KSA-CLEAN-101",
                    issueDate: "2026-09-10",
                    country: "KSA",
                    supplierName: "Al-Fanar IT Consulting",
                    supplierTaxId: "300123456789003",
                    currency: "SAR",
                    lineItems: [
                      {
                        description: "Cloud Architecture Review",
                        quantity: 1,
                        unitPrice: 5000,
                        subtotal: 5000,
                        vatRate: 0.15,
                        vatAmount: 750,
                        total: 5750,
                      },
                    ],
                    subtotal: 5000,
                    totalVat: 750,
                    totalAmount: 5750,
                  },
                  {
                    invoiceNumber: "INV-KSA-ROLEX-FRAUD-102",
                    issueDate: "2026-09-11",
                    country: "KSA",
                    supplierName: "Elite Procurement Trading",
                    supplierTaxId: "300765432109003",
                    currency: "SAR",
                    lineItems: [
                      {
                        description: "ساعة يد رولكس ذهبية فاخرة لهدايا الإدارة (Rolex Gold Luxury Watch)",
                        quantity: 1,
                        unitPrice: 45000,
                        subtotal: 45000,
                        vatRate: 0.15,
                        vatAmount: 6750,
                        total: 51750,
                      },
                    ],
                    subtotal: 45000,
                    totalVat: 6750,
                    totalAmount: 51750,
                  },
                  {
                    invoiceNumber: "INV-EGY-MATH-ERROR-103",
                    issueDate: "2026-09-12",
                    country: "EGY",
                    supplierName: "Cairo Commercial Logistics",
                    supplierTaxId: "123-456-789",
                    currency: "EGP",
                    lineItems: [
                      {
                        description: "Office Paper & Warehouse Supplies",
                        quantity: 100,
                        unitPrice: 50,
                        subtotal: 5000,
                        vatRate: 0.14,
                        vatAmount: 200,
                        total: 5200,
                      },
                    ],
                    subtotal: 5000,
                    totalVat: 200,
                    totalAmount: 5200,
                  },
                ],
              },
            },
          },
        },
        responses: {
          "202": {
            description: "Batch accepted for background auditing",
          },
          "400": {
            description: "Invalid batch payload",
          },
        },
      },
    },
    "/api/v1/batches/{id}": {
      get: {
        summary: "Check batch audit progress, status, and findings",
        tags: ["Batches"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "The unique batch UUID",
          },
        ],
        responses: {
          "200": {
            description: "Batch details with live progress percentage and invoice breakdown",
          },
          "404": {
            description: "Batch not found",
          },
        },
      },
    },
    "/api/v1/batches/{id}/report.pdf": {
      get: {
        summary: "Download Executive Pre-Filing Tax Compliance PDF Report",
        description:
          "Generates an executive-ready PDF report with financial scorecard, at-risk VAT totals, compliance rate, and itemized discrepancy tables.",
        tags: ["Batches"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "The unique batch UUID",
          },
        ],
        responses: {
          "200": {
            description: "Binary PDF report stream",
            content: {
              "application/pdf": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          "404": {
            description: "Batch not found",
          },
        },
      },
    },
    "/api/v1/audit/costs": {
      get: {
        summary: "Get AI Token Consumption and Cost Tracking Summary",
        tags: ["Audit Costs"],
        responses: {
          "200": {
            description: "AI cost and token metrics",
          },
        },
      },
    },
    "/api/v1/invoices/audit-single": {
      post: {
        summary: "Audit a single supplier invoice synchronously",
        tags: ["Invoices"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                invoiceNumber: "INV-KSA-2026-001",
                issueDate: "2026-09-10",
                country: "KSA",
                supplierName: "Al-Riyadh Tech Solutions LLC",
                supplierTaxId: "300123456789003",
                currency: "SAR",
                lineItems: [
                  {
                    description: "Cloud Infrastructure Setup",
                    quantity: 1,
                    unitPrice: 2500,
                    subtotal: 2500,
                    vatRate: 0.15,
                    vatAmount: 375,
                    total: 2875,
                  },
                ],
                subtotal: 2500,
                totalVat: 375,
                totalAmount: 2875,
              },
            },
          },
        },
        responses: {
          "200": { description: "Invoice audited successfully" },
        },
      },
    },
    "/api/v1/invoices": {
      get: {
        summary: "List audited invoices",
        tags: ["Invoices"],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20 },
          },
        ],
        responses: {
          "200": { description: "List of audited invoices" },
        },
      },
    },
    "/api/v1/invoices/{id}": {
      get: {
        summary: "Get invoice audit details by ID",
        tags: ["Invoices"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Invoice audit details" },
        },
      },
    },
  },
};
