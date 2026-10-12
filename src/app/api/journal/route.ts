import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries, journalLines, accounts } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { user, business } = await requireAuth();
  if (!user || !business) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 100), 300);

  const conds = [eq(journalEntries.businessId, business.id)];
  if (from) conds.push(gte(journalEntries.entryDate, from));
  if (to) conds.push(lte(journalEntries.entryDate, to));

  const entries = await db.select().from(journalEntries).where(and(...conds)).orderBy(desc(journalEntries.entryDate), desc(journalEntries.id)).limit(limit);
  const accs = await db.select().from(accounts).where(eq(accounts.businessId, business.id));
  const accMap = new Map(accs.map((a) => [a.id, a]));

  const result = await Promise.all(entries.map(async (e) => {
    const lines = await db.select().from(journalLines).where(eq(journalLines.journalEntryId, e.id));
    const enriched = lines.map((l) => ({ ...l, account: accMap.get(l.accountId) || null }));
    const td = lines.reduce((s, l) => s + l.debit, 0);
    const tc = lines.reduce((s, l) => s + l.credit, 0);
    return { ...e, lines: enriched, totalDebit: td, totalCredit: tc, balanced: td === tc };
  }));
  return NextResponse.json({ entries: result });
}
