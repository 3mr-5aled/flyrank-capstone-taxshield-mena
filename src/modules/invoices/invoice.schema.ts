import { z } from "zod";

export const LineItemSchema = z.object({
  description: z.string().min(1, "Line item description is required"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unitPrice: z.number().nonnegative("Unit price must be non-negative"),
  subtotal: z.number().nonnegative("Subtotal must be non-negative"),
  vatRate: z.number().min(0).max(1, "VAT rate must be between 0 and 1 (e.g. 0.15)"),
  vatAmount: z.number().nonnegative("VAT amount must be non-negative"),
  total: z.number().nonnegative("Total must be non-negative"),
});

export const AuditInvoiceInputSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  issueDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format for issueDate",
  }),
  country: z.enum(["KSA", "EGY"], {
    errorMap: () => ({ message: "Country must be 'KSA' or 'EGY'" }),
  }),
  supplierName: z.string().min(2, "Supplier name must be at least 2 characters"),
  supplierTaxId: z.string().min(5, "Supplier Tax ID must be at least 5 characters"),
  subtotal: z.number().nonnegative("Invoice subtotal must be non-negative"),
  totalVat: z.number().nonnegative("Invoice total VAT must be non-negative"),
  totalAmount: z.number().nonnegative("Invoice total amount must be non-negative"),
  currency: z.enum(["SAR", "EGP", "USD"]).optional(),
  lineItems: z
    .array(LineItemSchema)
    .min(1, "Invoice must contain at least one line item"),
  qrCode: z.string().optional(),
});

export type AuditInvoiceInput = z.infer<typeof AuditInvoiceInputSchema>;
export type LineItemInput = z.infer<typeof LineItemSchema>;
