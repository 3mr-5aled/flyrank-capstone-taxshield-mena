import PDFDocument from "pdfkit";
import { prisma } from "../../db/prisma.js";

export class PdfReportGenerator {
  public static async generateBatchReport(batchId: string): Promise<Buffer> {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        invoices: {
          include: {
            findings: true,
            lineItems: true,
          },
        },
      },
    });

    if (!batch) {
      throw new Error(`Batch with id '${batchId}' not found`);
    }

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      // 1. Header & Brand (Standard ASCII characters for bulletproof font compatibility)
      doc
        .fillColor("#0f172a")
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("TaxShield MENA", { continued: true })
        .fillColor("#2563eb")
        .text(" | Pre-Filing Tax Audit Report");

      doc
        .fillColor("#64748b")
        .fontSize(10)
        .font("Helvetica")
        .text("Automated VAT & E-Invoicing Risk Audit (Saudi ZATCA & Egypt ETA)", { lineGap: 8 });

      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#cbd5e1").lineWidth(1).stroke();
      doc.moveDown(0.8);

      // 2. Batch Metadata
      doc
        .fillColor("#1e293b")
        .fontSize(10)
        .font("Helvetica")
        .text(`Batch ID: `, { continued: true })
        .font("Helvetica-Bold")
        .text(batch.id, { continued: true })
        .font("Helvetica")
        .text(`  |  Date: `, { continued: true })
        .text(new Date().toLocaleDateString("en-US", { dateStyle: "long" }), { continued: true })
        .text(`  |  Status: `, { continued: true })
        .fillColor(batch.flaggedCount > 0 ? "#dc2626" : "#16a34a")
        .font("Helvetica-Bold")
        .text(batch.status);

      doc.moveDown(0.8);

      // 3. Financial Metrics Rollup
      const totalSpend = batch.invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
      const totalVat = batch.invoices.reduce((acc, inv) => acc + inv.totalVat, 0);
      const atRiskVat = batch.invoices
        .filter((inv) => inv.hasErrors)
        .reduce((acc, inv) => acc + inv.totalVat, 0);
      const claimableVat = totalVat - atRiskVat;
      const currency = batch.invoices[0]?.currency || "SAR";
      const complianceRate =
        batch.totalInvoices > 0
          ? ((batch.compliantCount / batch.totalInvoices) * 100).toFixed(1)
          : "100.0";

      // Draw Summary KPI Cards
      const cardY = doc.y;
      doc.rect(40, cardY, 160, 52).fillAndStroke("#f8fafc", "#cbd5e1");
      doc.rect(210, cardY, 160, 52).fillAndStroke("#f8fafc", "#cbd5e1");
      doc.rect(380, cardY, 175, 52).fillAndStroke("#f8fafc", "#cbd5e1");

      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold");
      doc.text("TOTAL INVOICES", 50, cardY + 8);
      doc.text("COMPLIANCE RATE", 220, cardY + 8);
      doc.text("AT-RISK INPUT VAT", 390, cardY + 8);

      doc.fillColor("#0f172a").fontSize(15).font("Helvetica-Bold");
      doc.text(`${batch.totalInvoices} Invoices`, 50, cardY + 24);

      doc.fillColor(Number(complianceRate) < 90 ? "#dc2626" : "#16a34a");
      doc.text(`${complianceRate}%`, 220, cardY + 24);

      doc.fillColor(atRiskVat > 0 ? "#dc2626" : "#16a34a");
      doc.text(`${atRiskVat.toLocaleString()} ${currency}`, 390, cardY + 24);

      doc.y = cardY + 68;

      // 4. Financial Summary Section
      doc.font("Helvetica-Bold").fillColor("#0f172a").fontSize(12).text("Financial Rollup Summary");
      doc.moveDown(0.4);
      doc.fontSize(9.5).font("Helvetica").fillColor("#334155");
      doc.text(`Total Audited B2B Spend: ${totalSpend.toLocaleString()} ${currency}`);
      doc.text(`Total Declared Input VAT: ${totalVat.toLocaleString()} ${currency}`);
      doc.text(`Legitimate / Safe Input VAT Deduction: ${claimableVat.toLocaleString()} ${currency}`);
      doc.text(`Flagged Tax Discrepancies: ${batch.flaggedCount} invoices requiring review`);
      doc.moveDown(1.2);

      // 5. Itemized Findings Table
      doc.fontSize(12).fillColor("#0f172a").font("Helvetica-Bold").text("Audit Findings & Flagged Discrepancies");
      doc.moveDown(0.5);

      const flaggedInvoices = batch.invoices.filter((inv) => inv.findings.length > 0);

      if (flaggedInvoices.length === 0) {
        doc
          .fillColor("#16a34a")
          .fontSize(10)
          .font("Helvetica")
          .text("All invoices successfully passed Layer 1 mathematical rules and Layer 2 semantic tax audits.");
      } else {
        flaggedInvoices.forEach((inv) => {
          doc
            .fontSize(10)
            .font("Helvetica-Bold")
            .fillColor("#0f172a")
            .text(`[${inv.country}] Invoice: ${inv.invoiceNumber} — ${inv.supplierName}`);

          doc
            .fontSize(8.5)
            .font("Helvetica")
            .fillColor("#64748b")
            .text(`Stated Total: ${inv.totalAmount.toLocaleString()} ${inv.currency} | Declared VAT: ${inv.totalVat.toLocaleString()} ${inv.currency} | Supplier Tax ID: ${inv.supplierTaxId}`);

          inv.findings.forEach((f) => {
            const isCritical = f.severity === "CRITICAL";
            // Strip non-ASCII characters for clean Helvetica rendering in PDF
            const cleanMessage = f.messageEn.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ");
            doc
              .fontSize(9)
              .font("Helvetica-Bold")
              .fillColor(isCritical ? "#dc2626" : "#d97706")
              .text(`  • [${f.severity}] [${f.layer}] ${f.ruleCode}: `, { continued: true })
              .font("Helvetica")
              .fillColor("#1e293b")
              .text(cleanMessage);
          });
          doc.moveDown(0.6);
        });
      }

      // Footer
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#94a3b8")
        .text(
          "TaxShield MENA — Confidential pre-filing tax audit report. Generated automatically for tax risk mitigation.",
          40,
          780,
          { align: "center", width: 515 }
        );

      doc.end();
    });
  }
}
