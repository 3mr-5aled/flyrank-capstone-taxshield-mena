import { prisma } from "./db/prisma.js";
import { BatchService } from "./modules/batches/batch.service.js";

async function main() {
  console.log("🌱 Seeding TaxShield MENA Database...\n");

  // 1. Create Saudi & Egyptian Demo Tenants
  console.log("Creating demo enterprise tenants...");
  const ksaTenant = await prisma.tenant.upsert({
    where: { taxId: "300123456789003" },
    update: {},
    create: {
      name: "Al-Riyadh International Tech S.A.",
      taxId: "300123456789003",
      country: "KSA",
    },
  });

  const egyTenant = await prisma.tenant.upsert({
    where: { taxId: "123456789" },
    update: {},
    create: {
      name: "Cairo Digital Solutions S.A.E.",
      taxId: "123456789",
      country: "EGY",
    },
  });

  console.log(`✅ Tenants created: ${ksaTenant.name} (${ksaTenant.country}), ${egyTenant.name} (${egyTenant.country})`);

  // 2. Seed a Sample Pre-Audited Batch with Real-World Discrepancies
  console.log("\nSeeding pre-computed sample audit batch...");
  const seedInvoices = [
    {
      invoiceNumber: "SEED-KSA-CLEAN-01",
      issueDate: "2026-09-01",
      country: "KSA" as const,
      supplierName: "Oracle Saudi Arabia",
      supplierTaxId: "300765432109003",
      currency: "SAR" as const,
      subtotal: 12000,
      totalVat: 1800,
      totalAmount: 13800,
      lineItems: [
        {
          description: "Enterprise Database Cloud Licensing",
          quantity: 1,
          unitPrice: 12000,
          subtotal: 12000,
          vatRate: 0.15,
          vatAmount: 1800,
          total: 13800,
        },
      ],
    },
    {
      invoiceNumber: "SEED-KSA-ROLEX-02",
      issueDate: "2026-09-05",
      country: "KSA" as const,
      supplierName: "Al-Safwah Luxury Watches",
      supplierTaxId: "300888999111003",
      currency: "SAR" as const,
      subtotal: 55000,
      totalVat: 8250,
      totalAmount: 63250,
      lineItems: [
        {
          description: "ساعة يد رولكس ذهبية فاخرة لهدايا الإدارة (Rolex Gold Luxury Watch)",
          quantity: 1,
          unitPrice: 55000,
          subtotal: 55000,
          vatRate: 0.15,
          vatAmount: 8250,
          total: 63250,
        },
      ],
    },
    {
      invoiceNumber: "SEED-EGY-MATH-03",
      issueDate: "2026-09-08",
      country: "EGY" as const,
      supplierName: "Nile Commercial Paper S.A.E",
      supplierTaxId: "555-666-777",
      currency: "EGP" as const,
      subtotal: 15000,
      totalVat: 900, // Tampered! 14% of 15,000 should be 2,100 EGP!
      totalAmount: 15900,
      lineItems: [
        {
          description: "Warehouse Paper and Printing Supplies",
          quantity: 30,
          unitPrice: 500,
          subtotal: 15000,
          vatRate: 0.14,
          vatAmount: 900, // Should be 2,100!
          total: 15900,
        },
      ],
    },
  ];

  const batch = await BatchService.createAndQueueBatch(
    "Demonstration Q3 Pre-Filing Tax Audit",
    seedInvoices,
    ksaTenant.id
  );

  console.log(`✅ Seed batch created: ${batch.id} (${batch.name})`);
  console.log("\n=======================================================");
  console.log("🎉 Database successfully seeded with demo data!");
  console.log(`📖 Open Swagger UI:      http://localhost:3000/docs`);
  console.log(`📋 Inspect Seeded Batch: http://localhost:3000/api/v1/batches/${batch.id}`);
  console.log(`📄 Download Audit PDF:   http://localhost:3000/api/v1/batches/${batch.id}/report.pdf`);
  console.log(`💰 AI Cost Analytics:   http://localhost:3000/api/v1/audit/costs`);
  console.log("=======================================================\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
