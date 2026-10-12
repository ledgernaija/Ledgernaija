import { eq, and, sql, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  transactions,
  journalEntries,
  journalLines,
  auditLogs,
} from "@/db/schema";

// Default chart of accounts per spec section 16
export const DEFAULT_ACCOUNTS: { code: string; name: string; type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "COGS" | "EXPENSE" }[] = [
  { code: "1000", name: "Cash", type: "ASSET" },
  { code: "1010", name: "Bank", type: "ASSET" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET" },
  { code: "1200", name: "Inventory", type: "ASSET" },
  { code: "2000", name: "Accounts Payable", type: "LIABILITY" },
  { code: "3000", name: "Owner Capital", type: "EQUITY" },
  { code: "3100", name: "Owner Drawings", type: "EQUITY" },
  { code: "3200", name: "Retained Earnings / Current Result", type: "EQUITY" },
  { code: "4000", name: "Sales Revenue", type: "REVENUE" },
  { code: "4100", name: "Other Income", type: "REVENUE" },
  { code: "5000", name: "Cost of Goods Sold", type: "COGS" },
  { code: "6000", name: "Rent", type: "EXPENSE" },
  { code: "6010", name: "Transportation", type: "EXPENSE" },
  { code: "6020", name: "Electricity", type: "EXPENSE" },
  { code: "6030", name: "Internet", type: "EXPENSE" },
  { code: "6040", name: "Salaries", type: "EXPENSE" },
  { code: "6050", name: "Marketing", type: "EXPENSE" },
  { code: "6060", name: "Bank Charges", type: "EXPENSE" },
  { code: "6070", name: "Repairs", type: "EXPENSE" },
  { code: "6080", name: "General Expenses", type: "EXPENSE" },
];

export async function createDefaultAccounts(businessId: number) {
  const existing = await db.select().from(accounts).where(eq(accounts.businessId, businessId)).limit(1);
  if (existing.length > 0) return existing;
  const rows = DEFAULT_ACCOUNTS.map((a) => ({
    businessId,
    code: a.code,
    name: a.name,
    type: a.type as "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "COGS" | "EXPENSE",
  }));
  await db.insert(accounts).values(rows);
  return rows;
}

export async function getAccountByCode(businessId: number, code: string) {
  const rows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.businessId, businessId), eq(accounts.code, code)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAccountById(businessId: number, id: number) {
  const rows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.businessId, businessId), eq(accounts.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export type JournalLineInput = {
  accountCode?: string;
  accountId?: number;
  debit?: number;
  credit?: number;
  description?: string;
};

export function validateJournalEntry(lines: { debit: number; credit: number }[]): { ok: boolean; error?: string; totalDebit: number; totalCredit: number } {
  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (lines.length < 2) return { ok: false, error: "A journal entry must have at least 2 lines.", totalDebit, totalCredit };
  if (totalDebit <= 0 || totalCredit <= 0) return { ok: false, error: "Debit and credit totals must be greater than zero.", totalDebit, totalCredit };
  if (totalDebit !== totalCredit) return { ok: false, error: `Unbalanced journal: debits (${totalDebit}) must equal credits (${totalCredit}).`, totalDebit, totalCredit };
  for (const l of lines) {
    if ((l.debit > 0 && l.credit > 0)) return { ok: false, error: "A line cannot have both debit and credit.", totalDebit, totalCredit };
    if (l.debit < 0 || l.credit < 0) return { ok: false, error: "Negative amounts not allowed.", totalDebit, totalCredit };
  }
  return { ok: true, totalDebit, totalCredit };
}

export async function createJournalEntry(opts: {
  businessId: number;
  transactionId?: number | null;
  entryDate: string;
  description: string;
  reference?: string;
  createdBy?: number | null;
  lines: JournalLineInput[];
}): Promise<number> {
  const resolved: { accountId: number; debit: number; credit: number; description?: string }[] = [];
  for (const l of opts.lines) {
    let accountId = l.accountId;
    if (!accountId && l.accountCode) {
      const acc = await getAccountByCode(opts.businessId, l.accountCode);
      if (!acc) throw new Error(`Account ${l.accountCode} not found for this business.`);
      accountId = acc.id;
    }
    if (!accountId) throw new Error("Each journal line needs an account.");
    // verify account belongs to business
    const acc = await getAccountById(opts.businessId, accountId);
    if (!acc) throw new Error("Account does not belong to this business.");
    resolved.push({
      accountId,
      debit: Math.round(l.debit || 0),
      credit: Math.round(l.credit || 0),
      description: l.description,
    });
  }
  const v = validateJournalEntry(resolved);
  if (!v.ok) throw new Error(v.error || "Invalid journal entry.");
  const inserted = await db
    .insert(journalEntries)
    .values({
      businessId: opts.businessId,
      transactionId: opts.transactionId ?? null,
      entryDate: opts.entryDate,
      description: opts.description,
      reference: opts.reference,
      createdBy: opts.createdBy ?? null,
    })
    .returning({ id: journalEntries.id });
  const entryId = inserted[0].id;
  for (const r of resolved) {
    await db.insert(journalLines).values({
      journalEntryId: entryId,
      accountId: r.accountId,
      debit: r.debit,
      credit: r.credit,
      description: r.description,
    });
  }
  return entryId;
}

export async function audit(
  userId: number,
  businessId: number | null,
  action: string,
  recordType?: string,
  recordId?: number,
  oldValue?: unknown,
  newValue?: unknown
) {
  await db.insert(auditLogs).values({
    userId,
    businessId: businessId ?? null,
    action,
    recordType,
    recordId,
    oldValue: oldValue !== undefined ? JSON.stringify(oldValue) : null,
    newValue: newValue !== undefined ? JSON.stringify(newValue) : null,
  });
}

function paymentStatusFor(total: number, paid: number): "paid" | "partial" | "unpaid" {
  if (paid <= 0) return "unpaid";
  if (paid >= total) return "paid";
  return "partial";
}

type BasePost = {
  businessId: number;
  date: string;
  description: string;
  createdBy?: number | null;
  source?: string;
  reference?: string;
};

// SALE: handles cash, credit, partial per spec sections 18-20
export async function postSale(opts: BasePost & {
  amount: number;
  amountPaid: number;
  customerId?: number | null;
  paymentAccountCode?: string; // default 1000 Cash
}) {
  const amount = Math.round(opts.amount);
  const amountPaid = Math.round(opts.amountPaid || 0);
  if (amount <= 0) throw new Error("Sale amount must be greater than zero.");
  if (amountPaid < 0 || amountPaid > amount) throw new Error("Invalid paid amount.");
  const payCode = opts.paymentAccountCode || "1000";
  const status = paymentStatusFor(amount, amountPaid);

  const inserted = await db.insert(transactions).values({
    businessId: opts.businessId,
    transactionDate: opts.date,
    transactionType: "sale",
    description: opts.description,
    amount,
    amountPaid,
    customerId: opts.customerId ?? null,
    paymentStatus: status,
    source: opts.source || "manual",
    reference: opts.reference,
    status: "posted",
    createdBy: opts.createdBy ?? null,
  }).returning({ id: transactions.id });
  const txId = inserted[0].id;

  if (!opts.customerId && status === "paid") {
    // Pure cash sale: DR Cash, CR Sales
    await createJournalEntry({
      businessId: opts.businessId,
      transactionId: txId,
      entryDate: opts.date,
      description: `Cash sale: ${opts.description}`,
      reference: opts.reference,
      createdBy: opts.createdBy,
      lines: [
        { accountCode: payCode, debit: amount },
        { accountCode: "4000", credit: amount },
      ],
    });
  } else {
    // Credit/partial (or cash with customer tracked): DR AR full, CR Sales full
    await createJournalEntry({
      businessId: opts.businessId,
      transactionId: txId,
      entryDate: opts.date,
      description: `Sale: ${opts.description}`,
      reference: opts.reference,
      createdBy: opts.createdBy,
      lines: [
        { accountCode: "1100", debit: amount },
        { accountCode: "4000", credit: amount },
      ],
    });
    if (amountPaid > 0) {
      await createJournalEntry({
        businessId: opts.businessId,
        transactionId: txId,
        entryDate: opts.date,
        description: `Payment received for sale: ${opts.description}`,
        reference: opts.reference,
        createdBy: opts.createdBy,
        lines: [
          { accountCode: payCode, debit: amountPaid },
          { accountCode: "1100", credit: amountPaid },
        ],
      });
    }
  }
  if (opts.createdBy) await audit(opts.createdBy, opts.businessId, "Transaction created", "sale", txId, null, { amount, amountPaid, description: opts.description });
  return txId;
}

export async function postCustomerPayment(opts: BasePost & {
  amount: number;
  customerId: number;
  paymentAccountCode?: string;
}) {
  const amount = Math.round(opts.amount);
  if (amount <= 0) throw new Error("Payment amount must be greater than zero.");
  const payCode = opts.paymentAccountCode || "1000";
  const inserted = await db.insert(transactions).values({
    businessId: opts.businessId,
    transactionDate: opts.date,
    transactionType: "customer_payment",
    description: opts.description,
    amount,
    amountPaid: amount,
    customerId: opts.customerId,
    paymentStatus: "paid",
    source: opts.source || "manual",
    reference: opts.reference,
    status: "posted",
    createdBy: opts.createdBy ?? null,
  }).returning({ id: transactions.id });
  const txId = inserted[0].id;
  await createJournalEntry({
    businessId: opts.businessId,
    transactionId: txId,
    entryDate: opts.date,
    description: opts.description,
    reference: opts.reference,
    createdBy: opts.createdBy,
    lines: [
      { accountCode: payCode, debit: amount },
      { accountCode: "1100", credit: amount },
    ],
  });
  if (opts.createdBy) await audit(opts.createdBy, opts.businessId, "Transaction created", "customer_payment", txId, null, { amount, description: opts.description });
  return txId;
}

export async function postExpense(opts: BasePost & {
  amount: number;
  expenseAccountCode: string;
  paymentAccountCode?: string;
}) {
  const amount = Math.round(opts.amount);
  if (amount <= 0) throw new Error("Expense amount must be greater than zero.");
  const payCode = opts.paymentAccountCode || "1000";
  const expAcc = await getAccountByCode(opts.businessId, opts.expenseAccountCode);
  if (!expAcc) throw new Error("Expense account not found.");
  const inserted = await db.insert(transactions).values({
    businessId: opts.businessId,
    transactionDate: opts.date,
    transactionType: "expense",
    description: opts.description,
    amount,
    amountPaid: amount,
    expenseAccountId: expAcc.id,
    paymentStatus: "paid",
    source: opts.source || "manual",
    reference: opts.reference,
    status: "posted",
    createdBy: opts.createdBy ?? null,
  }).returning({ id: transactions.id });
  const txId = inserted[0].id;
  await createJournalEntry({
    businessId: opts.businessId,
    transactionId: txId,
    entryDate: opts.date,
    description: opts.description,
    reference: opts.reference,
    createdBy: opts.createdBy,
    lines: [
      { accountCode: opts.expenseAccountCode, debit: amount },
      { accountCode: payCode, credit: amount },
    ],
  });
  if (opts.createdBy) await audit(opts.createdBy, opts.businessId, "Transaction created", "expense", txId, null, { amount, description: opts.description });
  return txId;
}

export async function postPurchase(opts: BasePost & {
  amount: number;
  amountPaid: number;
  supplierId?: number | null;
  paymentAccountCode?: string;
}) {
  const amount = Math.round(opts.amount);
  const amountPaid = Math.round(opts.amountPaid || 0);
  if (amount <= 0) throw new Error("Purchase amount must be greater than zero.");
  if (amountPaid < 0 || amountPaid > amount) throw new Error("Invalid paid amount.");
  const payCode = opts.paymentAccountCode || "1000";
  const status = paymentStatusFor(amount, amountPaid);
  const inserted = await db.insert(transactions).values({
    businessId: opts.businessId,
    transactionDate: opts.date,
    transactionType: "purchase",
    description: opts.description,
    amount,
    amountPaid,
    supplierId: opts.supplierId ?? null,
    paymentStatus: status,
    source: opts.source || "manual",
    reference: opts.reference,
    status: "posted",
    createdBy: opts.createdBy ?? null,
  }).returning({ id: transactions.id });
  const txId = inserted[0].id;
  // DR Inventory, CR AP (or Cash if fully paid cash without supplier? keep consistent: always via AP then payment if paid)
  if (!opts.supplierId && status === "paid") {
    await createJournalEntry({
      businessId: opts.businessId, transactionId: txId, entryDate: opts.date,
      description: `Cash purchase: ${opts.description}`, reference: opts.reference, createdBy: opts.createdBy,
      lines: [{ accountCode: "1200", debit: amount }, { accountCode: payCode, credit: amount }],
    });
  } else {
    await createJournalEntry({
      businessId: opts.businessId, transactionId: txId, entryDate: opts.date,
      description: `Purchase: ${opts.description}`, reference: opts.reference, createdBy: opts.createdBy,
      lines: [{ accountCode: "1200", debit: amount }, { accountCode: "2000", credit: amount }],
    });
    if (amountPaid > 0) {
      await createJournalEntry({
        businessId: opts.businessId, transactionId: txId, entryDate: opts.date,
        description: `Payment for purchase: ${opts.description}`, reference: opts.reference, createdBy: opts.createdBy,
        lines: [{ accountCode: "2000", debit: amountPaid }, { accountCode: payCode, credit: amountPaid }],
      });
    }
  }
  if (opts.createdBy) await audit(opts.createdBy, opts.businessId, "Transaction created", "purchase", txId, null, { amount, amountPaid, description: opts.description });
  return txId;
}

export async function postSupplierPayment(opts: BasePost & {
  amount: number;
  supplierId: number;
  paymentAccountCode?: string;
}) {
  const amount = Math.round(opts.amount);
  if (amount <= 0) throw new Error("Payment amount must be greater than zero.");
  const payCode = opts.paymentAccountCode || "1000";
  const inserted = await db.insert(transactions).values({
    businessId: opts.businessId,
    transactionDate: opts.date,
    transactionType: "supplier_payment",
    description: opts.description,
    amount,
    amountPaid: amount,
    supplierId: opts.supplierId,
    paymentStatus: "paid",
    source: opts.source || "manual",
    reference: opts.reference,
    status: "posted",
    createdBy: opts.createdBy ?? null,
  }).returning({ id: transactions.id });
  const txId = inserted[0].id;
  await createJournalEntry({
    businessId: opts.businessId, transactionId: txId, entryDate: opts.date,
    description: opts.description, reference: opts.reference, createdBy: opts.createdBy,
    lines: [{ accountCode: "2000", debit: amount }, { accountCode: payCode, credit: amount }],
  });
  if (opts.createdBy) await audit(opts.createdBy, opts.businessId, "Transaction created", "supplier_payment", txId, null, { amount, description: opts.description });
  return txId;
}

export async function postOwnerWithdrawal(opts: BasePost & { amount: number; paymentAccountCode?: string }) {
  const amount = Math.round(opts.amount);
  if (amount <= 0) throw new Error("Amount must be greater than zero.");
  const payCode = opts.paymentAccountCode || "1000";
  const inserted = await db.insert(transactions).values({
    businessId: opts.businessId, transactionDate: opts.date, transactionType: "owner_draw",
    description: opts.description, amount, amountPaid: amount,
    paymentStatus: "paid", source: opts.source || "manual", reference: opts.reference,
    status: "posted", createdBy: opts.createdBy ?? null,
  }).returning({ id: transactions.id });
  const txId = inserted[0].id;
  await createJournalEntry({
    businessId: opts.businessId, transactionId: txId, entryDate: opts.date,
    description: opts.description, reference: opts.reference, createdBy: opts.createdBy,
    lines: [{ accountCode: "3100", debit: amount }, { accountCode: payCode, credit: amount }],
  });
  if (opts.createdBy) await audit(opts.createdBy, opts.businessId, "Transaction created", "owner_draw", txId, null, { amount, description: opts.description });
  return txId;
}

export async function postOwnerCapital(opts: BasePost & { amount: number; paymentAccountCode?: string }) {
  const amount = Math.round(opts.amount);
  if (amount <= 0) throw new Error("Amount must be greater than zero.");
  const payCode = opts.paymentAccountCode || "1000";
  const inserted = await db.insert(transactions).values({
    businessId: opts.businessId, transactionDate: opts.date, transactionType: "owner_capital",
    description: opts.description, amount, amountPaid: amount,
    paymentStatus: "paid", source: opts.source || "manual", reference: opts.reference,
    status: "posted", createdBy: opts.createdBy ?? null,
  }).returning({ id: transactions.id });
  const txId = inserted[0].id;
  await createJournalEntry({
    businessId: opts.businessId, transactionId: txId, entryDate: opts.date,
    description: opts.description, reference: opts.reference, createdBy: opts.createdBy,
    lines: [{ accountCode: payCode, debit: amount }, { accountCode: "3000", credit: amount }],
  });
  if (opts.createdBy) await audit(opts.createdBy, opts.businessId, "Transaction created", "owner_capital", txId, null, { amount, description: opts.description });
  return txId;
}

export async function postOtherIncome(opts: BasePost & { amount: number; paymentAccountCode?: string }) {
  const amount = Math.round(opts.amount);
  if (amount <= 0) throw new Error("Amount must be greater than zero.");
  const payCode = opts.paymentAccountCode || "1000";
  const inserted = await db.insert(transactions).values({
    businessId: opts.businessId, transactionDate: opts.date, transactionType: "other_income",
    description: opts.description, amount, amountPaid: amount,
    paymentStatus: "paid", source: opts.source || "manual", reference: opts.reference,
    status: "posted", createdBy: opts.createdBy ?? null,
  }).returning({ id: transactions.id });
  const txId = inserted[0].id;
  await createJournalEntry({
    businessId: opts.businessId, transactionId: txId, entryDate: opts.date,
    description: opts.description, reference: opts.reference, createdBy: opts.createdBy,
    lines: [{ accountCode: payCode, debit: amount }, { accountCode: "4100", credit: amount }],
  });
  if (opts.createdBy) await audit(opts.createdBy, opts.businessId, "Transaction created", "other_income", txId, null, { amount, description: opts.description });
  return txId;
}

export async function voidTransaction(opts: { businessId: number; transactionId: number; userId: number; reason?: string }) {
  const txRows = await db.select().from(transactions).where(
    and(eq(transactions.id, opts.transactionId), eq(transactions.businessId, opts.businessId))
  ).limit(1);
  if (txRows.length === 0) throw new Error("Transaction not found.");
  const tx = txRows[0];
  if (tx.status === "voided") throw new Error("Transaction already voided.");

  // Find all journal entries for this transaction
  const entries = await db.select().from(journalEntries).where(
    and(eq(journalEntries.transactionId, opts.transactionId), eq(journalEntries.businessId, opts.businessId))
  );

  // Create reversing entries in reverse order
  const today = new Date().toISOString().slice(0, 10);
  for (const e of [...entries].reverse()) {
    const lines = await db.select().from(journalLines).where(eq(journalLines.journalEntryId, e.id));
    if (lines.length === 0) continue;
    const reversed = lines.map((l) => ({
      accountId: l.accountId,
      debit: l.credit,
      credit: l.debit,
      description: `Reversal of #${e.id}`,
    }));
    const v = validateJournalEntry(reversed);
    if (!v.ok) throw new Error("Reversal would be unbalanced. Void rejected.");
    const inserted = await db.insert(journalEntries).values({
      businessId: opts.businessId,
      transactionId: opts.transactionId,
      entryDate: today,
      description: `VOID reversal of entry #${e.id}: ${e.description}`,
      reference: e.reference,
      createdBy: opts.userId,
    }).returning({ id: journalEntries.id });
    const newId = inserted[0].id;
    for (const r of reversed) {
      await db.insert(journalLines).values({
        journalEntryId: newId,
        accountId: r.accountId,
        debit: r.debit,
        credit: r.credit,
        description: r.description,
      });
    }
  }

  await db.update(transactions).set({ status: "voided", updatedAt: new Date() }).where(eq(transactions.id, opts.transactionId));
  await audit(opts.userId, opts.businessId, "Transaction voided", tx.transactionType, opts.transactionId, { status: tx.status }, { status: "voided", reason: opts.reason || "" });
  return true;
}

// Balances
export async function accountBalances(businessId: number, from?: string, to?: string) {
  const conditions = [eq(journalEntries.businessId, businessId)];
  if (from) conditions.push(gte(journalEntries.entryDate, from));
  if (to) conditions.push(lte(journalEntries.entryDate, to));
  const rows = await db
    .select({
      accountId: journalLines.accountId,
      code: accounts.code,
      name: accounts.name,
      type: accounts.type,
      totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}),0)::int`,
      totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}),0)::int`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(and(...conditions))
    .groupBy(journalLines.accountId, accounts.code, accounts.name, accounts.type);
  return rows;
}

export async function allAccountsWithBalances(businessId: number, from?: string, to?: string) {
  const accs = await db.select().from(accounts).where(eq(accounts.businessId, businessId));
  const bals = await accountBalances(businessId, from, to);
  const map = new Map(bals.map((b) => [b.accountId, b]));
  return accs.map((a) => {
    const b = map.get(a.id);
    const d = b?.totalDebit ?? 0;
    const c = b?.totalCredit ?? 0;
    // Normal balance logic for display: debit balance = d - c for Assets/Expenses/COGS/Drawings; credit balance = c - d for Liab/Equity/Revenue
    let debit = 0;
    let credit = 0;
    if (["ASSET", "EXPENSE", "COGS"].includes(a.type)) {
      const net = d - c;
      if (net >= 0) debit = net; else credit = -net;
    } else if (a.type === "EQUITY") {
      if (a.code === "3100") {
        // drawings is debit-normal
        const net = d - c;
        if (net >= 0) debit = net; else credit = -net;
      } else {
        const net = c - d;
        if (net >= 0) credit = net; else debit = -net;
      }
    } else {
      const net = c - d;
      if (net >= 0) credit = net; else debit = -net;
    }
    return { ...a, totalDebit: d, totalCredit: c, debit, credit, net: d - c };
  });
}

export async function calculateTrialBalance(businessId: number, from?: string, to?: string) {
  const rows = await allAccountsWithBalances(businessId, from, to);
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  return { rows, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
}

export async function calculateProfitAndLoss(businessId: number, from?: string, to?: string) {
  const rows = await allAccountsWithBalances(businessId, from, to);
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const sales = byCode.get("4000")?.credit ?? 0;
  const otherIncome = byCode.get("4100")?.credit ?? 0;
  const revenue = sales + otherIncome;
  const cogs = byCode.get("5000")?.debit ?? 0;
  const gross = revenue - cogs;
  const expenseCodes = ["6000", "6010", "6020", "6030", "6040", "6050", "6060", "6070", "6080"];
  const expenses = expenseCodes.map((c) => ({ code: c, name: byCode.get(c)?.name || c, amount: byCode.get(c)?.debit ?? 0 })).filter((e) => e.amount !== 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const net = gross - totalExpenses;
  return { sales, otherIncome, revenue, cogs, gross, expenses, totalExpenses, net };
}

export async function calculateBalanceSheet(businessId: number) {
  const rows = await allAccountsWithBalances(businessId);
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const cash = byCode.get("1000")?.debit ?? 0;
  const bank = byCode.get("1010")?.debit ?? 0;
  const ar = byCode.get("1100")?.debit ?? 0;
  const inv = byCode.get("1200")?.debit ?? 0;
  const totalAssets = cash + bank + ar + inv;
  const ap = byCode.get("2000")?.credit ?? 0;
  const totalLiab = ap;
  const capital = byCode.get("3000")?.credit ?? 0;
  const drawings = byCode.get("3100")?.debit ?? 0;
  const pnl = await calculateProfitAndLoss(businessId);
  const currentResult = pnl.net;
  const totalEquity = capital - drawings + currentResult;
  const balanced = totalAssets === totalLiab + totalEquity;
  return { cash, bank, ar, inv, totalAssets, ap, totalLiab, capital, drawings, currentResult, totalEquity, balanced };
}

export async function calculateCustomerBalance(businessId: number, customerId: number) {
  const txs = await db.select().from(transactions).where(
    and(eq(transactions.businessId, businessId), eq(transactions.customerId, customerId), eq(transactions.status, "posted"))
  );
  let totalSales = 0;
  let initialPaid = 0;
  let laterPayments = 0;
  let lastDate: string | null = null;
  for (const t of txs) {
    if (t.transactionType === "sale") {
      totalSales += t.amount;
      initialPaid += t.amountPaid;
    } else if (t.transactionType === "customer_payment") {
      laterPayments += t.amount;
    }
    if (!lastDate || t.transactionDate > lastDate) lastDate = t.transactionDate;
  }
  const paid = initialPaid + laterPayments;
  const outstanding = totalSales - paid;
  return { totalSales, paid, outstanding, lastDate, count: txs.length };
}

export async function calculateSupplierBalance(businessId: number, supplierId: number) {
  const txs = await db.select().from(transactions).where(
    and(eq(transactions.businessId, businessId), eq(transactions.supplierId, supplierId), eq(transactions.status, "posted"))
  );
  let totalPurchases = 0;
  let initialPaid = 0;
  let laterPayments = 0;
  let lastDate: string | null = null;
  for (const t of txs) {
    if (t.transactionType === "purchase") {
      totalPurchases += t.amount;
      initialPaid += t.amountPaid;
    } else if (t.transactionType === "supplier_payment") {
      laterPayments += t.amount;
    }
    if (!lastDate || t.transactionDate > lastDate) lastDate = t.transactionDate;
  }
  const paid = initialPaid + laterPayments;
  const outstanding = totalPurchases - paid;
  return { totalPurchases, paid, outstanding, lastDate, count: txs.length };
}
