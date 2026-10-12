import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { calculateProfitAndLoss, calculateBalanceSheet, calculateTrialBalance } from "@/lib/accounting";

export async function GET(req: NextRequest) {
  const { user, business } = await requireAuth();
  if (!user || !business) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const type = req.nextUrl.searchParams.get("type") || "pnl";
  let from = req.nextUrl.searchParams.get("from") || undefined;
  let to = req.nextUrl.searchParams.get("to") || undefined;
  const preset = req.nextUrl.searchParams.get("preset");
  const now = new Date();
  if (preset === "month") {
    from = now.toISOString().slice(0, 7) + "-01";
    to = undefined;
  } else if (preset === "last_month") {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    from = d.toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    to = end.toISOString().slice(0, 10);
  } else if (preset === "year") {
    from = `${now.getFullYear()}-01-01`;
    to = undefined;
  }

  if (type === "pnl") {
    const pnl = await calculateProfitAndLoss(business.id, from, to);
    return NextResponse.json({ pnl, from: from || null, to: to || null });
  }
  if (type === "balance") {
    const bs = await calculateBalanceSheet(business.id);
    return NextResponse.json({ balance: bs });
  }
  if (type === "trial") {
    const tb = await calculateTrialBalance(business.id, from, to);
    return NextResponse.json({ trial: tb });
  }
  return NextResponse.json({ error: "Unknown report type." }, { status: 400 });
}
