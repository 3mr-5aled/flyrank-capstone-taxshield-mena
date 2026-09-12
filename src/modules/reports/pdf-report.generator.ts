import PDFDocument from "pdfkit";
import { prisma } from "../../db/prisma.js";

function cleanHeader(text: string, fallback = "N/A"): string {
  if (!text) return fallback;
  const cleaned = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, " - ")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
  return cleaned || fallback;
}

function cleanForPdf(text: string): string {
  if (!text) return "";

  let cleaned = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, " - ")
    .replace(/\u2026/g, "...")
    .replace(/[\u00B7]/g, "•");

  // Handle "Line X ("... (English Parens)...")" patterns: extract clean English label
  cleaned = cleaned.replace(/Line (\d+)\s*\(".*?\(([^)]+)\)"\)/, "Line $1 ($2)");
  // Handle legacy mojibake or pure non-ASCII inside quotes
  cleaned = cleaned.replace(/Line (\d+)\s*\("[^"]*"\)/, "Line $1");
  // Outer parentheses with quotes
  cleaned = cleaned.replace(/\("[^"]*?\(([^)]+)\)"\)/, "($1)");

  // Strip remaining non-ASCII characters (preserve standard printable ASCII and bullet)
  cleaned = cleaned.replace(/[^\x20-\x7E\u2022]/g, "");

  // Clean empty parens/quotes/spaces
  cleaned = cleaned
    .replace(/\(\s*["']?\s*["']?\s*\)/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/""/g, "")
    .replace(/\s*:\s*:/g, ":")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,:;])/g, "$1")
    .trim();

  return cleaned;
}

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
      const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      // 1. Header & Brand (Standard ASCII characters for bulletproof font compatibility)
      doc
        .fillColor("#0f172a")
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("TaxShield MENA", 40, 40, { continued: true })
        .fillColor("#2563eb")
        .text(" | Pre-Filing Tax Audit Report");

      doc
        .fillColor("#64748b")
        .fontSize(10)
        .font("Helvetica")
        .text("Automated VAT & E-Invoicing Risk Audit (Saudi ZATCA & Egypt ETA)", 40, doc.y + 2, { lineGap: 8 });

      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#cbd5e1").lineWidth(1).stroke();
      doc.moveDown(0.8);

      // 2. Batch Metadata
      const metaY = doc.y;
      doc
        .fillColor("#1e293b")
        .fontSize(9.5)
        .font("Helvetica")
        .text("Batch ID: ", 40, metaY, { continued: true })
        .font("Helvetica-Bold")
        .text(batch.id, { continued: true })
        .font("Helvetica")
        .text("  |  Date: ", { continued: true })
        .text(new Date(batch.createdAt).toLocaleDateString("en-US", { dateStyle: "long" }), { continued: true })
        .text("  |  Status: ", { continued: true })
        .fillColor(batch.flaggedCount > 0 ? "#dc2626" : "#16a34a")
        .font("Helvetica-Bold")
        .text(batch.status);

      doc.moveDown(0.9);

      // 3. Financial Metrics Rollup KPI Cards
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

      // 4. Financial Summary Section (Structured Card, reset doc.x to 40)
      const summaryBoxY = cardY + 66;
      doc.font("Helvetica-Bold").fillColor("#0f172a").fontSize(12).text("Financial Rollup Summary", 40, summaryBoxY);

      const boxStartY = summaryBoxY + 18;
      const summaryBoxWidth = 515;
      const summaryBoxHeight = 62;
      doc.rect(40, boxStartY, summaryBoxWidth, summaryBoxHeight).fillAndStroke("#f8fafc", "#e2e8f0");

      const col1X = 52;
      const col2X = 305;
      const r1Y = boxStartY + 10;
      const r2Y = boxStartY + 26;
      const r3Y = boxStartY + 42;

      doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#475569").text("Total Audited B2B Spend:", col1X, r1Y);
      doc.font("Helvetica").fillColor("#0f172a").text(`${totalSpend.toLocaleString()} ${currency}`, col1X + 130, r1Y);

      doc.font("Helvetica-Bold").fillColor("#475569").text("Legitimate / Safe Input VAT:", col2X, r1Y);
      doc.font("Helvetica-Bold").fillColor("#16a34a").text(`${claimableVat.toLocaleString()} ${currency}`, col2X + 130, r1Y);

      doc.font("Helvetica-Bold").fillColor("#475569").text("Total Declared Input VAT:", col1X, r2Y);
      doc.font("Helvetica").fillColor("#0f172a").text(`${totalVat.toLocaleString()} ${currency}`, col1X + 130, r2Y);

      doc.font("Helvetica-Bold").fillColor("#475569").text("Flagged Tax Discrepancies:", col2X, r2Y);
      doc.font("Helvetica-Bold").fillColor(batch.flaggedCount > 0 ? "#dc2626" : "#16a34a").text(
        `${batch.flaggedCount} invoice${batch.flaggedCount === 1 ? "" : "s"} requiring review`,
        col2X + 130,
        r2Y
      );

      doc.font("Helvetica-Bold").fillColor("#475569").text("Audit Engine Verification:", col1X, r3Y);
      doc.font("Helvetica").fillColor("#2563eb").text("Dual-Layer (Deterministic Rules + AI Semantic Classification)", col1X + 130, r3Y);

      // 5. Itemized Findings Table
      const findingsStartY = boxStartY + summaryBoxHeight + 18;
      doc.fontSize(12).fillColor("#0f172a").font("Helvetica-Bold").text("Audit Findings & Flagged Discrepancies", 40, findingsStartY);

      let nextY = findingsStartY + 20;

      const flaggedInvoices = batch.invoices.filter((inv) => inv.findings.length > 0);

      if (flaggedInvoices.length === 0) {
        doc.rect(40, nextY, 515, 34).fillAndStroke("#f0fdf4", "#bbf7d0");
        doc
          .fillColor("#16a34a")
          .fontSize(9.5)
          .font("Helvetica-Bold")
          .text("All invoices successfully passed Layer 1 mathematical rules and Layer 2 semantic tax audits.", 52, nextY + 11);
      } else {
        flaggedInvoices.forEach((inv) => {
          const cleanSupplier = cleanHeader(inv.supplierName, `Supplier (${inv.supplierTaxId})`);
          const cleanInvNum = cleanHeader(inv.invoiceNumber, "INV-UNKNOWN");
          const hasCritical = inv.findings.some((f) => f.severity === "CRITICAL");

          const headerText = `[${inv.country}] Invoice: ${cleanInvNum}  —  ${cleanSupplier}`;
          const metaText = `Stated Total: ${inv.totalAmount.toLocaleString()} ${inv.currency}   |   Declared VAT: ${inv.totalVat.toLocaleString()} ${inv.currency}   |   Supplier Tax ID: ${inv.supplierTaxId}`;

          doc.fontSize(9.5).font("Helvetica-Bold");
          const headerH = doc.heightOfString(headerText, { width: 495 });

          doc.fontSize(8).font("Helvetica");
          const metaH = doc.heightOfString(metaText, { width: 495 });

          const cleanedFindings = inv.findings.map((f) => {
            const cleanMsg = cleanForPdf(f.messageEn);
            const prefix = `  • [${f.severity}] [${f.layer}] ${f.ruleCode}: `;
            doc.fontSize(8.5).font("Helvetica");
            const h = doc.heightOfString(`${prefix}${cleanMsg}`, { width: 490 });
            return {
              severity: f.severity,
              prefix,
              cleanMsg,
              height: h,
            };
          });

          const findingsTotalHeight = cleanedFindings.reduce((acc, f) => acc + f.height + 5, 0);
          const cardHeight = 10 + headerH + 3 + metaH + 8 + findingsTotalHeight + 8;

          if (nextY + cardHeight > 750) {
            doc.addPage();
            nextY = 40;
          }

          const cardTopY = nextY;

          // Card container
          doc.rect(40, cardTopY, 515, cardHeight).fillAndStroke("#f8fafc", "#e2e8f0");
          // Accent bar
          doc.rect(40, cardTopY, 4, cardHeight).fill(hasCritical ? "#dc2626" : "#d97706");

          // Header text
          doc
            .fontSize(9.5)
            .font("Helvetica-Bold")
            .fillColor("#0f172a")
            .text(headerText, 52, cardTopY + 10, { width: 495 });

          // Meta text
          const curMetaY = cardTopY + 10 + headerH + 3;
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#64748b")
            .text(metaText, 52, curMetaY, { width: 495 });

          let curFY = curMetaY + metaH + 8;
          cleanedFindings.forEach((f) => {
            const isCritical = f.severity === "CRITICAL";
            doc
              .fontSize(8.5)
              .font("Helvetica-Bold")
              .fillColor(isCritical ? "#dc2626" : "#d97706")
              .text(f.prefix, 52, curFY, { continued: true, width: 490 })
              .font("Helvetica")
              .fillColor("#1e293b")
              .text(f.cleanMsg, { width: 490 });

            curFY += f.height + 5;
          });

          nextY = cardTopY + cardHeight + 10;
        });
      }

      // Footers across all buffered pages
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
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
      }

      doc.end();
    });
  }
}
