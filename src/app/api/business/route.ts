import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, businessUsers, customers, suppliers } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { createDefaultAccounts, audit, postSale, postExpense, postCustomerPayment, postPurchase } from "@/lib/accounting";

export async function GET() {
  const { user, business } = await requireAuth();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  return NextResponse.json({ business });
}

export async function POST(req: NextRequest) {
  const { user } = await requireAuth();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  try {
    const body = await req.json();
    const { businessName, businessType, category, city, state, phone, currency, seedDemo } = body;
    if (!businessName || !businessName.trim()) return NextResponse.json({ error: "Business name is required." }, { status: 400 });

    const inserted = await db.insert(businesses).values({
      ownerUserId: user.id,
      businessName: businessName.trim(),
      businessType: businessType || "Sole Proprietorship",
      category: category || "General",
      city: city || "",
      state: state || "",
      country: "Nigeria",
      currency: currency || "NGN",
      phone: phone || user.phone || "",
    }).returning();
    const biz = inserted[0];
    await db.insert(businessUsers).values({ businessId: biz.id, userId: user.id, role: "owner" });
    await createDefaultAccounts(biz.id);
    await audit(user.id, biz.id, "Business created", "business", biz.id, null, { businessName: biz.businessName });

    if (seedDemo) {
      await seedDemoData(biz.id, user.id);
    }
    return NextResponse.json({ ok: true, business: biz });
  } catch (e) {
    console.error("business create error", e);
    return NextResponse.json({ error: "Something went wrong while creating your business. Please try again." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { user, business } = await requireAuth();
  if (!user || !business) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  try {
    const body = await req.json();
    const allowed: Record<string, string> = {};
    for (const k of ["businessName", "businessType", "category", "city", "state", "phone", "currency"]) {
      if (body[k] !== undefined) allowed[k] = body[k];
    }
    await db.update(businesses).set({ ...allowed, updatedAt: new Date() } as never).where(eq(businesses.id, business.id));
    await audit(user.id, business.id, "Business settings changed", "business", business.id, null, allowed);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("business update error", e);
    return NextResponse.json({ error: "Could not save business settings." }, { status: 500 });
  }
}

async function seedDemoData(businessId: number, userId: number) {
  const today = new Date().toISOString().slice(0, 10);
  // customers
  const emeka = await db.insert(customers).values({ businessId, name: "Emeka", phone: "0803 000 0001" }).returning({ id: customers.id });
  const ada = await db.insert(customers).values({ businessId, name: "Ada", phone: "0803 000 0002" }).returning({ id: customers.id });
  const chinedu = await db.insert(customers).values({ businessId, name: "Chinedu", phone: "0803 000 0003" }).returning({ id: customers.id });
  const abc = await db.insert(suppliers).values({ businessId, name: "ABC Fashion Supplies", phone: "0803 100 0001" }).returning({ id: suppliers.id });
  await db.insert(suppliers).values({ businessId, name: "Lagos Garments Ltd", phone: "0803 100 0002" });

  await postSale({ businessId, date: today, description: "3 pairs of shoes", amount: 150000, amountPaid: 100000, customerId: emeka[0].id, createdBy: userId, source: "manual", reference: "DEMO-001" });
  await postSale({ businessId, date: today, description: "5 dresses", amount: 250000, amountPaid: 250000, customerId: ada[0].id, createdBy: userId, source: "manual", reference: "DEMO-002" });
  await postSale({ businessId, date: today, description: "2 handbags", amount: 80000, amountPaid: 0, customerId: chinedu[0].id, createdBy: userId, source: "manual", reference: "DEMO-003" });
  await postCustomerPayment({ businessId, date: today, description: "Payment from Emeka", amount: 30000, customerId: emeka[0].id, createdBy: userId, source: "manual" });
  await postExpense({ businessId, date: today, description: "Transportation to market", amount: 15000, expenseAccountCode: "6010", createdBy: userId, source: "manual" });
  await postExpense({ businessId, date: today, description: "Shop rent", amount: 100000, expenseAccountCode: "6000", createdBy: userId, source: "manual" });
  await postPurchase({ businessId, date: today, description: "Ankara fabrics", amount: 200000, amountPaid: 50000, supplierId: abc[0].id, createdBy: userId, source: "manual" });
  await audit(userId, businessId, "Demo data seeded", "business", businessId, null, null);
}
