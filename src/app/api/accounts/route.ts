import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { allAccountsWithBalances } from "@/lib/accounting";

export async function GET() {
  const { user, business } = await requireAuth();
  if (!user || !business) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const rows = await allAccountsWithBalances(business.id);
  return NextResponse.json({ accounts: rows });
}
