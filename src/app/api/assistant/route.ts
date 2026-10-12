import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { customers, suppliers } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { interpretTransaction, type InterpretResult } from "@/lib/assistant";
import {
  postSale, postExpense, postCustomerPayment, postSupplierPayment,
  postPurchase, postOwnerWithdrawal, postOwnerCapital, audit,
  calculateProfitAndLoss, allAccountsWithBalances,
  calculateCustomerBalance, calculateSupplierBalance,
} from "@/lib/accounting";

export async function POST(req: NextRequest) {
  const { user, business } = await requireAuth();
  if (!user || !business) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const action = req.nextUrl.searchParams.get("action") || "interpret";
  try {
    const body = await req.json();

    if (action === "interpret") {
      const message = String(body.message || "").trim();
      if (!message) return NextResponse.json({ error: "Please type what happened in your business." }, { status: 400 });
      const parsed = await interpretTransaction(message);

      // Handle query intents immediately with real data
      if (parsed.intent.startsWith("query_")) {
        const answer = await answerQuery(business.id, parsed.intent);
        return NextResponse.json({ parsed, answer, needsConfirm: false });
      }

      // Fuzzy-match customer/supplier to existing records
      let matchedCustomer = null;
      let matchedSupplier = null;
      if (parsed.customer) {
        matchedCustomer = await fuzzyFind(customers, business.id, parsed.customer);
      }
      if (parsed.supplier) {
        matchedSupplier = await fuzzyFind(suppliers, business.id, parsed.supplier);
      }

      // Build preview of accounting treatment
      const preview = buildPreview(parsed);
      return NextResponse.json({ parsed, matchedCustomer, matchedSupplier, preview, needsConfirm: !parsed.needs_clarification });
    }

    if (action === "post") {
      // Body contains confirmed structured data (edited by user if needed)
      const d = body.data as {
        intent: string; amount: number; amountPaid: number;
        customer?: string | null; customerId?: number | null;
        supplier?: string | null; supplierId?: number | null;
        description?: string; expenseAccountCode?: string; date?: string;
      };
      if (!d || !d.amount || d.amount <= 0) return NextResponse.json({ error: "A valid amount is required. The system will never guess amounts." }, { status: 400 });
      const date = d.date || new Date().toISOString().slice(0, 10);
      const desc = (d.description || "").trim() || defaultDesc(d.intent, d.customer || d.supplier);

      // Resolve or create customer
      let customerId: number | null = d.customerId ?? null;
      if (!customerId && d.customer && (d.intent === "sale" || d.intent === "customer_payment")) {
        customerId = await findOrCreate(customers, business.id, user.id, d.customer);
      }
      let supplierId: number | null = d.supplierId ?? null;
      if (!supplierId && d.supplier && (d.intent === "purchase" || d.intent === "supplier_payment")) {
        supplierId = await findOrCreate(suppliers, business.id, user.id, d.supplier);
      }
      // Validate ids belong to business
      if (customerId) {
        const r = await db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.businessId, business.id))).limit(1);
        if (!r.length) return NextResponse.json({ error: "Customer not found." }, { status: 400 });
      }
      if (supplierId) {
        const r = await db.select().from(suppliers).where(and(eq(suppliers.id, supplierId), eq(suppliers.businessId, business.id))).limit(1);
        if (!r.length) return NextResponse.json({ error: "Supplier not found." }, { status: 400 });
      }

      let txId: number;
      const source = "assistant";
      if (d.intent === "sale") {
        txId = await postSale({ businessId: business.id, date, description: desc, amount: Math.round(d.amount), amountPaid: Math.round(d.amountPaid ?? 0), customerId, createdBy: user.id, source });
      } else if (d.intent === "expense") {
        txId = await postExpense({ businessId: business.id, date, description: desc, amount: Math.round(d.amount), expenseAccountCode: d.expenseAccountCode || "6080", createdBy: user.id, source });
      } else if (d.intent === "customer_payment") {
        if (!customerId) return NextResponse.json({ error: "Which customer paid? Please choose a customer." }, { status: 400 });
        txId = await postCustomerPayment({ businessId: business.id, date, description: desc, amount: Math.round(d.amount), customerId, createdBy: user.id, source });
      } else if (d.intent === "purchase") {
        txId = await postPurchase({ businessId: business.id, date, description: desc, amount: Math.round(d.amount), amountPaid: Math.round(d.amountPaid ?? 0), supplierId, createdBy: user.id, source });
      } else if (d.intent === "supplier_payment") {
        if (!supplierId) return NextResponse.json({ error: "Which supplier did you pay? Please choose a supplier." }, { status: 400 });
        txId = await postSupplierPayment({ businessId: business.id, date, description: desc, amount: Math.round(d.amount), supplierId, createdBy: user.id, source });
      } else if (d.intent === "owner_draw") {
        txId = await postOwnerWithdrawal({ businessId: business.id, date, description: desc, amount: Math.round(d.amount), createdBy: user.id, source });
      } else if (d.intent === "owner_capital") {
        txId = await postOwnerCapital({ businessId: business.id, date, description: desc, amount: Math.round(d.amount), createdBy: user.id, source });
      } else {
        return NextResponse.json({ error: "Unknown transaction type." }, { status: 400 });
      }
      return NextResponse.json({ ok: true, transactionId: txId, message: confirmMessage(d.intent, d.amount, customerId ? d.customer : null, supplierId ? d.supplier : null) });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e: unknown) {
    console.error("assistant error", e);
    const msg = e instanceof Error ? e.message : "Something went wrong. Please try again.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

async function fuzzyFind(table: typeof customers | typeof suppliers, businessId: number, name: string) {
  const rows = await db.select().from(table as typeof customers).where(eq((table as typeof customers).businessId, businessId));
  const needle = name.toLowerCase().trim();
  const exact = rows.find((r) => r.name.toLowerCase() === needle);
  if (exact) return exact;
  const partial = rows.find((r) => r.name.toLowerCase().includes(needle) || needle.includes(r.name.toLowerCase()));
  return partial || null;
}

async function findOrCreate(table: typeof customers | typeof suppliers, businessId: number, userId: number, name: string): Promise<number> {
  const found = await fuzzyFind(table, businessId, name);
  if (found) return found.id;
  const inserted = await db.insert(table).values({ businessId, name: name.trim() }).returning({ id: (table as typeof customers).id });
  const newId = (inserted[0] as { id: number }).id;
  await audit(userId, businessId, table === customers ? "Customer created" : "Supplier created", table === customers ? "customer" : "supplier", newId, null, { name, via: "assistant" });
  return newId;
}

function defaultDesc(intent: string, party?: string | null): string {
  switch (intent) {
    case "sale": return party ? `Sale to ${party}` : "Sale";
    case "expense": return "Business expense";
    case "customer_payment": return party ? `Payment from ${party}` : "Customer payment";
    case "purchase": return party ? `Purchase from ${party}` : "Stock purchase";
    case "supplier_payment": return party ? `Payment to ${party}` : "Supplier payment";
    case "owner_draw": return "Owner withdrawal";
    case "owner_capital": return "Owner capital";
    default: return "Transaction";
  }
}

function confirmMessage(intent: string, amount: number, customer?: string | null, supplier?: string | null): string {
  const f = "₦" + Math.round(amount).toLocaleString("en-NG");
  switch (intent) {
    case "sale": return `Recorded sale of ${f}${customer ? ` to ${customer}` : ""}.`;
    case "expense": return `Recorded ${f} as a business expense paid from cash.`;
    case "customer_payment": return `Recorded ${f} received${customer ? ` from ${customer}` : ""}.`;
    case "purchase": return `Recorded stock purchase of ${f}${supplier ? ` from ${supplier}` : ""}.`;
    case "supplier_payment": return `Recorded ${f} paid${supplier ? ` to ${supplier}` : ""}.`;
    case "owner_draw": return `Recorded ${f} taken by the owner (not an expense).`;
    case "owner_capital": return `Recorded ${f} added to the business by the owner.`;
    default: return `Recorded ${f}.`;
  }
}

function buildPreview(p: InterpretResult): string[] {
  const f = (n: number | null) => (n == null ? "—" : "₦" + n.toLocaleString("en-NG"));
  switch (p.intent) {
    case "sale":
      if (!p.customer && p.payment_status === "paid") return [`Cash +${f(p.amount)}`, `Sales Revenue +${f(p.amount)}`];
      return [
        `Accounts Receivable +${f(p.amount)}`, `Sales Revenue +${f(p.amount)}`,
        `Cash received: ${f(p.amount_paid)}`, `Outstanding: ${f(p.amount_owed)}`,
      ];
    case "expense":
      return [`${p.category || "Expense"} +${f(p.amount)}`, `Cash −${f(p.amount)}`];
    case "customer_payment":
      return [`Cash +${f(p.amount)}`, `Accounts Receivable −${f(p.amount)}`];
    case "purchase":
      return [`Inventory +${f(p.amount)}`, `Accounts Payable +${f(p.amount)}`, `Paid now: ${f(p.amount_paid)}`, `Still owed: ${f(p.amount_owed)}`];
    case "supplier_payment":
      return [`Accounts Payable −${f(p.amount)}`, `Cash −${f(p.amount)}`];
    case "owner_draw":
      return [`Owner Drawings +${f(p.amount)}`, `Cash −${f(p.amount)}`, `Note: not an operating expense`];
    case "owner_capital":
      return [`Cash +${f(p.amount)}`, `Owner Capital +${f(p.amount)}`];
    default:
      return [];
  }
}

async function answerQuery(businessId: number, intent: string): Promise<string> {
  const f = (n: number) => "₦" + n.toLocaleString("en-NG");
  if (intent === "query_receivables") {
    const rows = await db.select().from(customers).where(eq(customers.businessId, businessId));
    let total = 0;
    const lines: string[] = [];
    for (const c of rows) {
      const b = await calculateCustomerBalance(businessId, c.id);
      if (b.outstanding > 0) { total += b.outstanding; lines.push(`${c.name}: ${f(b.outstanding)}`); }
    }
    if (total === 0) return "No customer owes you money right now. Well done!";
    return `Customers owe you ${f(total)} in total.\n` + lines.slice(0, 10).join("\n");
  }
  if (intent === "query_payables") {
    const rows = await db.select().from(suppliers).where(eq(suppliers.businessId, businessId));
    let total = 0;
    const lines: string[] = [];
    for (const s of rows) {
      const b = await calculateSupplierBalance(businessId, s.id);
      if (b.outstanding > 0) { total += b.outstanding; lines.push(`${s.name}: ${f(b.outstanding)}`); }
    }
    if (total === 0) return "You don't owe any supplier money right now.";
    return `You owe suppliers ${f(total)} in total.\n` + lines.slice(0, 10).join("\n");
  }
  if (intent === "query_sales") {
    const pnl = await calculateProfitAndLoss(businessId);
    return `Your total sales are ${f(pnl.sales)}.`;
  }
  if (intent === "query_expenses") {
    const pnl = await calculateProfitAndLoss(businessId);
    return `Your total expenses are ${f(pnl.totalExpenses)}.`;
  }
  if (intent === "query_profit") {
    const pnl = await calculateProfitAndLoss(businessId);
    return pnl.net >= 0
      ? `Your business has made ${f(pnl.net)} profit (sales ${f(pnl.revenue)} minus expenses ${f(pnl.totalExpenses + pnl.cogs)}).`
      : `Your business is at a loss of ${f(Math.abs(pnl.net))} so far. Sales ${f(pnl.revenue)}, expenses ${f(pnl.totalExpenses + pnl.cogs)}.`;
  }
  if (intent === "query_cash") {
    const bals = await allAccountsWithBalances(businessId);
    const cash = bals.find((b) => b.code === "1000");
    const bank = bals.find((b) => b.code === "1010");
    const total = (cash?.debit ?? 0) + (bank?.debit ?? 0);
    return `Your cash balance is ${f(total)} (Cash ${f(cash?.debit ?? 0)}, Bank ${f(bank?.debit ?? 0)}).`;
  }
  return "I don't have an answer for that yet.";
}
