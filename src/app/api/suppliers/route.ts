import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { suppliers, transactions } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { audit, calculateSupplierBalance } from "@/lib/accounting";

export async function GET(req: NextRequest) {
  const { user, business } = await requireAuth();
  if (!user || !business) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const rows = await db.select().from(suppliers).where(and(eq(suppliers.id, Number(id)), eq(suppliers.businessId, business.id))).limit(1);
    if (rows.length === 0) return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
    const bal = await calculateSupplierBalance(business.id, Number(id));
    const history = await db.select().from(transactions).where(and(eq(transactions.businessId, business.id), eq(transactions.supplierId, Number(id)))).orderBy(desc(transactions.transactionDate), desc(transactions.id)).limit(100);
    return NextResponse.json({ supplier: rows[0], balance: bal, history });
  }
  const rows = await db.select().from(suppliers).where(eq(suppliers.businessId, business.id)).orderBy(desc(suppliers.id));
  const withBal = await Promise.all(rows.map(async (s) => ({ ...s, balance: await calculateSupplierBalance(business.id, s.id) })));
  return NextResponse.json({ suppliers: withBal });
}

export async function POST(req: NextRequest) {
  const { user, business } = await requireAuth();
  if (!user || !business) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.name || !body.name.trim()) return NextResponse.json({ error: "Supplier name is required." }, { status: 400 });
    const inserted = await db.insert(suppliers).values({
      businessId: business.id,
      name: body.name.trim(),
      phone: body.phone || null,
      email: body.email || null,
      address: body.address || null,
      notes: body.notes || null,
    }).returning();
    await audit(user.id, business.id, "Supplier created", "supplier", inserted[0].id, null, { name: body.name });
    return NextResponse.json({ ok: true, supplier: inserted[0] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save supplier." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { user, business } = await requireAuth();
  if (!user || !business) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  try {
    const body = await req.json();
    const rows = await db.select().from(suppliers).where(and(eq(suppliers.id, Number(id)), eq(suppliers.businessId, business.id))).limit(1);
    if (rows.length === 0) return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
    await db.update(suppliers).set({
      name: body.name ?? rows[0].name,
      phone: body.phone ?? rows[0].phone,
      email: body.email ?? rows[0].email,
      address: body.address ?? rows[0].address,
      notes: body.notes ?? rows[0].notes,
      updatedAt: new Date(),
    }).where(eq(suppliers.id, Number(id)));
    await audit(user.id, business.id, "Supplier updated", "supplier", Number(id), rows[0], body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update supplier." }, { status: 500 });
  }
}
