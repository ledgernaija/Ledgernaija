import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { user, business } = await requireAuth();
  if (!user || !business) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 100), 300);
  const rows = await db.select().from(auditLogs).where(eq(auditLogs.businessId, business.id)).orderBy(desc(auditLogs.id)).limit(limit);
  const userRows = await db.select({ id: users.id, fullName: users.fullName }).from(users);
  const map = new Map(userRows.map((u) => [u.id, u.fullName]));
  return NextResponse.json({ logs: rows.map((r) => ({ ...r, userName: map.get(r.userId) || "—" })) });
}
