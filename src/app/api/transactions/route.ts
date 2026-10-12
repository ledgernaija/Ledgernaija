import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { transactions, customers, suppliers } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import {
  postSale, postExpense, postCustomerPayment, postSupplierPayment,
  postPurchase, postOwnerWithdrawal, postOwnerCapital, postOtherIncome,
  voidTransaction, getAccountByCode,
} from "@/lib/accounting";

export async function GET(req: NextRequest) {
  const { user, business } = await requireAuth();
  if (!user || !business) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type");
  const status = sp.get("status");
  const from = sp.get("from");
  const to = sp.get("to");
  const customerId = sp.get("customerId");
  const supplierId = sp.get("supplierId");
  const q = sp.get("q");
  const limit = Math.min(Number(sp.get("limit") || 200), 500);

  const conds: ReturnType<typeof eq>[] = [eq(transactions.businessId, business.id)];
  if (type) conds.push(eq(transactions.transactionType, type as never));
  if (status) conds.push(eq(transactions.status, status as never));
  if (from) conds.push(gte(transactions.transactionDate, from));
  if (to) conds.push(lte(transactions.transactionDate, to));
  if (customerId) conds.push(eq(transactions.customerId, Number(customerId)));
  if (supplierId) conds.push(eq(transactions.supplierId, Number(supplierId)));

  let rows = await db.select().from(transactions).where(and(...conds)).orderBy(desc(transactions.transactionDate), desc(transactions.id)).limit(limit);
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((r) => r.description.toLowerCase().includes(needle) || (r.reference || "").toLowerCase().includes(needle));
  }
  // attach names
  const custRows = await db.select().from(customers).where(eq(customers.businessId, business.id));
  const supRows = await db.select().from(suppliers).where(eq(suppliers.businessId, business.id));
  const cMap = new Map(custRows.map((c) => [c.id, c.name]));
  const sMap = new Map(supRows.map((s) => [s.id, s.name]));
  const enriched = rows.map((r) => ({
    ...r,
    customerName: r.customerId ? cMap.get(r.customerId) || null : null,
    supplierName: r.supplierId ? sMap.get(r.supplierId) || null : null,
  }));
  return NextResponse.json({ transactions: enriched });
}

export async function POST(req: NextRequest) {
  const { user, business } = await requireAuth();
  if (!user || !business) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  try {
    const body = await req.json();
    const kind = body.kind as string;
    const date = body.date || new Date().toISOString().slice(0, 10);
    const description = (body.description || "").trim();
    const amount = Math.round(Number(body.amount) || 0);
    if (!description) return NextResponse.json({ error: "Description is required." }, { status: 400 });
    if (!(amount > 0)) return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });

    // verify customer/supplier belong to business
    async function checkCustomer(id: number | null) {
      if (!id) return null;
      const r = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.businessId, business!.id))).limit(1);
      if (!r.length) throw new Error("Customer not found.");
      return id;
    }
    async function checkSupplier(id: number | null) {
      if (!id) return null;
      const r = await db.select().from(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.businessId, business!.id))).limit(1);
      if (!r.length) throw new Error("Supplier not found.");
      return id;
    }

    let txId: number;
    if (kind === "sale") {
      const amountPaid = Math.round(Number(body.amountPaid ?? amount) || 0);
      const customerId = await checkCustomer(body.customerId ? Number(body.customerId) : null);
      txId = await postSale({ businessId: business.id, date, description, amount, amountPaid, customerId, createdBy: user.id, source: body.source || "manual" });
    } else if (kind === "expense") {
      const code = body.expenseAccountCode || "6080";
      const acc = await getAccountByCode(business.id, code);
      if (!acc) return NextResponse.json({ error: "Expense category not found." }, { status: 400 });
      txId = await postExpense({ businessId: business.id, date, description, amount, expenseAccountCode: code, createdBy: user.id, source: body.source || "manual" });
    } else if (kind === "customer_payment") {
      if (!body.customerId) return NextResponse.json({ error: "Select a customer." }, { status: 400 });
      const customerId = await checkCustomer(Number(body.customerId));
      txId = await postCustomerPayment({ businessId: business.id, date, description, amount, customerId: customerId!, createdBy: user.id, source: body.source || "manual" });
    } else if (kind === "purchase") {
      const amountPaid = Math.round(Number(body.amountPaid ?? 0) || 0);
      const supplierId = await checkSupplier(body.supplierId ? Number(body.supplierId) : null);
      txId = await postPurchase({ businessId: business.id, date, description, amount, amountPaid, supplierId, createdBy: user.id, source: body.source || "manual" });
    } else if (kind === "supplier_payment") {
      if (!body.supplierId) return NextResponse.json({ error: "Select a supplier." }, { status: 400 });
      const supplierId = await checkSupplier(Number(body.supplierId));
      txId = await postSupplierPayment({ businessId: business.id, date, description, amount, supplierId: supplierId!, createdBy: user.id, source: body.source || "manual" });
    } else if (kind === "owner_draw") {
      txId = await postOwnerWithdrawal({ businessId: business.id, date, description, amount, createdBy: user.id, source: body.source || "manual" });
    } else if (kind === "owner_capital") {
      txId = await postOwnerCapital({ businessId: business.id, date, description, amount, createdBy: user.id, source: body.source || "manual" });
    } else if (kind === "other_income") {
      txId = await postOtherIncome({ businessId: business.id, date, description, amount, createdBy: user.id, source: body.source || "manual" });
    } else {
      return NextResponse.json({ error: "Unknown transaction kind." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, transactionId: txId });
  } catch (e: unknown) {
    console.error("post transaction error", e);
    const msg = e instanceof Error ? e.message : "Something went wrong while saving this transaction. Please try again.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const { user, business } = await requireAuth();
  if (!user || !business) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const action = req.nextUrl.searchParams.get("action");
  const id = req.nextUrl.searchParams.get("id");
  if (action === "void" && id) {
    try {
      const body = await req.json().catch(() => ({}));
      await voidTransaction({ businessId: business.id, transactionId: Number(id), userId: user.id, reason: body.reason });
      return NextResponse.json({ ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not void transaction.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
