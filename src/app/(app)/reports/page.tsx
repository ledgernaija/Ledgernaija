"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => "₦" + (n || 0).toLocaleString("en-NG");

type Pnl = { sales: number; otherIncome: number; revenue: number; cogs: number; gross: number; expenses: { code: string; name: string; amount: number }[]; totalExpenses: number; net: number };
type Bs = { cash: number; bank: number; ar: number; inv: number; totalAssets: number; ap: number; totalLiab: number; capital: number; drawings: number; currentResult: number; totalEquity: number; balanced: boolean };
type Tb = { rows: { id: number; code: string; name: string; type: string; debit: number; credit: number }[]; totalDebit: number; totalCredit: number; balanced: boolean };

export default function ReportsPage() {
  const [tab, setTab] = useState<"pnl" | "balance" | "trial">("pnl");
  const [preset, setPreset] = useState("month");
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [bs, setBs] = useState<Bs | null>(null);
  const [tb, setTb] = useState<Tb | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/reports?type=pnl&preset=${preset}`).then((r) => r.json()),
      fetch("/api/reports?type=balance").then((r) => r.json()),
      fetch("/api/reports?type=trial").then((r) => r.json()),
    ]).then(([p, b, t]) => {
      setPnl(p.pnl);
      setBs(b.balance);
      setTb(t.trial);
    }).finally(() => setLoading(false));
  }, [preset]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-black">Reports</h1>
        <button className="btn-ghost no-print" onClick={() => window.print()}>🖨️ Print report</button>
      </div>

      <div className="flex gap-2 no-print flex-wrap">
        {([["pnl", "Profit & Loss"], ["balance", "Balance Sheet"], ["trial", "Trial Balance"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={tab === k ? "btn-primary !min-h-[42px]" : "btn-ghost !min-h-[42px]"}>{label}</button>
        ))}
      </div>

      {tab === "pnl" && (
        <div className="flex gap-2 no-print flex-wrap">
          {( [["month", "This Month"], ["last_month", "Last Month"], ["year", "This Year"], ["", "All Time"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setPreset(k)} className={`text-sm font-bold px-3 py-1.5 rounded-full border ${preset === k ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-slate-600 border-slate-300"}`}>{label}</button>
          ))}
        </div>
      )}

      {loading ? <div className="card p-6 text-slate-500">Loading reports...</div> : (
        <>
          {tab === "pnl" && pnl && (
            <div className="card p-5 max-w-2xl">
              <h2 className="font-black text-lg">Profit & Loss</h2>
              <div className="mt-3 space-y-1 text-sm">
                <Row label="Sales Revenue" value={pnl.sales} />
                {pnl.otherIncome > 0 && <Row label="Other Income" value={pnl.otherIncome} />}
                <Row label="Total Revenue" value={pnl.revenue} bold />
                <Row label="Cost of Goods Sold" value={pnl.cogs} neg />
                <Row label="Gross Profit" value={pnl.gross} bold highlight />
                <div className="pt-2 font-bold text-slate-500 uppercase text-xs">Operating Expenses</div>
                {pnl.expenses.length === 0 ? <div className="text-slate-400">No expenses in this period.</div> : pnl.expenses.map((e) => <Row key={e.code} label={`${e.name}`} value={e.amount} neg />)}
                <Row label="Total Expenses" value={pnl.totalExpenses} bold />
                <div className={`mt-2 rounded-xl p-3 flex justify-between font-black text-lg ${pnl.net >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                  <span>Net Profit</span><span>{fmt(pnl.net)}</span>
                </div>
              </div>
            </div>
          )}

          {tab === "balance" && bs && (
            <div className="card p-5 max-w-2xl">
              <div className="flex justify-between items-center">
                <h2 className="font-black text-lg">Balance Sheet</h2>
                <span className={`badge ${bs.balanced ? "badge-paid" : "badge-unpaid"}`}>{bs.balanced ? "Balanced ✓" : "Out of balance!"}</span>
              </div>
              <div className="mt-3 text-sm">
                <div className="font-bold text-slate-500 uppercase text-xs">Assets</div>
                <Row label="Cash" value={bs.cash} />
                <Row label="Bank" value={bs.bank} />
                <Row label="Accounts Receivable (customers owe you)" value={bs.ar} />
                <Row label="Inventory" value={bs.inv} />
                <Row label="TOTAL ASSETS" value={bs.totalAssets} bold />
                <div className="pt-3 font-bold text-slate-500 uppercase text-xs">Liabilities</div>
                <Row label="Accounts Payable (you owe suppliers)" value={bs.ap} />
                <Row label="TOTAL LIABILITIES" value={bs.totalLiab} bold />
                <div className="pt-3 font-bold text-slate-500 uppercase text-xs">Equity</div>
                <Row label="Owner Capital" value={bs.capital} />
                <Row label="Owner Drawings" value={bs.drawings} neg />
                <Row label="Current Result (profit)" value={bs.currentResult} />
                <Row label="TOTAL EQUITY" value={bs.totalEquity} bold />
                <div className="mt-2 text-xs text-slate-500">Check: Assets ({fmt(bs.totalAssets)}) = Liabilities ({fmt(bs.totalLiab)}) + Equity ({fmt(bs.totalEquity)})</div>
              </div>
            </div>
          )}

          {tab === "trial" && tb && (
            <div className="card p-5 max-w-3xl">
              <div className="flex justify-between items-center">
                <h2 className="font-black text-lg">Trial Balance</h2>
                <span className={`badge ${tb.balanced ? "badge-paid" : "badge-unpaid"}`}>{tb.balanced ? "Debits = Credits ✓" : "UNBALANCED"}</span>
              </div>
              <div className="mt-3 table-wrap">
                <table className="data">
                  <thead><tr><th>Code</th><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
                  <tbody>
                    {tb.rows.filter((r) => r.debit !== 0 || r.credit !== 0).map((r) => (
                      <tr key={r.id}>
                        <td className="font-mono">{r.code}</td>
                        <td>{r.name}</td>
                        <td className="text-right font-mono">{r.debit > 0 ? fmt(r.debit) : "—"}</td>
                        <td className="text-right font-mono">{r.credit > 0 ? fmt(r.credit) : "—"}</td>
                      </tr>
                    ))}
                    <tr className="font-black bg-slate-50">
                      <td colSpan={2}>Total</td>
                      <td className="text-right font-mono">{fmt(tb.totalDebit)}</td>
                      <td className="text-right font-mono">{fmt(tb.totalCredit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value, bold, neg, highlight }: { label: string; value: number; bold?: boolean; neg?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${bold ? "font-black border-t border-slate-200 mt-1 pt-2" : ""} ${highlight ? "bg-emerald-50 rounded px-2 font-bold" : ""}`}>
      <span>{label}</span>
      <span className="font-mono">{neg && value > 0 ? `(${fmt(value)})` : fmt(value)}</span>
    </div>
  );
}
