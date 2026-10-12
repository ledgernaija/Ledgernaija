import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, customers, suppliers, accounts, transactions, journalEntries, journalLines, auditLogs } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { user, business } = await requireAuth();
  if (!user || !business) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const format = req.nextUrl.searchParams.get("format") || "json";
  const bizId = business.id;

  const [cust, sup, acc, tx, je] = await Promise.all([
    db.select().from(customers).where(eq(customers.businessId, bizId)),
    db.select().from(suppliers).where(eq(suppliers.businessId, bizId)),
    db.select().from(accounts).where(eq(accounts.businessId, bizId)),
    db.select().from(transactions).where(eq(transactions.businessId, bizId)),
    db.select().from(journalEntries).where(eq(journalEntries.businessId, bizId)),
  ]);
  const jl = await db.select().from(journalLines);

  if (format === "csv") {
    const type = req.nextUrl.searchParams.get("type") || "transactions";
    let csv = "";
    if (type === "transactions") {
      csv = "id,date,type,description,amount,amount_paid,payment_status,status,reference,customer_id,supplier_id\n" +
        tx.map((t) => `${t.id},${t.transactionDate},${t.transactionType},"${t.description.replace(/"/g, '""')}",${t.amount},${t.amountPaid},${t.paymentStatus},${t.status},${t.reference || ""},${t.customerId || ""},${t.supplierId || ""}`).join("\n");
    } else if (type === "customers") {
      csv = "id,name,phone,email,address\n" + cust.map((c) => `${c.id},"${c.name}",${c.phone || ""},${c.email || ""},"${(c.address || "").replace(/"/g, '""')}"`).join("\n");
    } else if (type === "suppliers") {
      csv = "id,name,phone,email,address\n" + sup.map((s) => `${s.id},"${s.name}",${s.phone || ""},${s.email || ""},"${(s.address || "").replace(/"/g, '""')}"`).join("\n");
    }
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="sme-finance-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const backup = {
    exportedAt: new Date().toISOString(),
    app: "SME Finance V0.5",
    business,
    customers: cust,
    suppliers: sup,
    accounts: acc,
    transactions: tx,
    journalEntries: je,
    journalLines: jl.filter((l) => je.some((e) => e.id === l.journalEntryId)),
  };
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="sme-finance-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
