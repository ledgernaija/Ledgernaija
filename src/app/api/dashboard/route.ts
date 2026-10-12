import { NextResponse } from "next/server";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { transactions, customers, suppliers } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import {
  calculateProfitAndLoss, calculateBalanceSheet,
  calculateCustomerBalance, calculateSupplierBalance,
} from "@/lib/accounting";

export async function GET() {
  const { user, business } = await requireAuth();
  if (!user || !business) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const txs = await db.select().from(transactions).where(and(eq(transactions.businessId, business.id), eq(transactions.status, "posted")));
  const totalSales = txs.filter((t) => t.transactionType === "sale").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = txs.filter((t) => t.transactionType === "expense").reduce((s, t) => s + t.amount, 0);
  const txCount = txs.length;

  const bs = await calculateBalanceSheet(business.id);
  const monthStart = new Date().toISOString().slice(0, 7) + "-01";
  const pnlMonth = await calculateProfitAndLoss(business.id, monthStart);
  const pnlAll = await calculateProfitAndLoss(business.id);

  const recent = await db.select().from(transactions).where(eq(transactions.businessId, business.id)).orderBy(desc(transactions.id)).limit(8);
  const custRows = await db.select().from(customers).where(eq(customers.businessId, business.id));
  const supRows = await db.select().from(suppliers).where(eq(suppliers.businessId, business.id));

  const custBals = await Promise.all(custRows.map(async (c) => ({ ...c, ...(await calculateCustomerBalance(business.id, c.id)) })));
  const supBals = await Promise.all(supRows.map(async (s) => ({ ...s, ...(await calculateSupplierBalance(business.id, s.id)) })));

  const receivables = custBals.reduce((s, c) => s + Math.max(0, c.outstanding), 0);
  const payables = supBals.reduce((s, c) => s + Math.max(0, c.outstanding), 0);
  const cashBalance = bs.cash + bs.bank;

  const topCustomers = [...custBals].sort((a, b) => b.totalSales - a.totalSales).slice(0, 5);
  const outstandingCustomers = custBals.filter((c) => c.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding).slice(0, 5);
  const outstandingSuppliers = supBals.filter((s) => s.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding).slice(0, 5);

  return NextResponse.json({
    cards: {
      totalSales, totalExpenses, cashBalance, receivables, payables,
      netProfit: pnlAll.net, netProfitMonth: pnlMonth.net, txCount,
    },
    balanceSheet: bs,
    recent,
    topCustomers,
    outstandingCustomers,
    outstandingSuppliers,
    customerCount: custRows.length,
    supplierCount: supRows.length,
  });
}
