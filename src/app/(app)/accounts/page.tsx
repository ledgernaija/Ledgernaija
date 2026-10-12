"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => "₦" + (n || 0).toLocaleString("en-NG");

type Acc = { id: number; code: string; name: string; type: string; debit: number; credit: number };

const GROUPS: { type: string; label: string; desc: string }[] = [
  { type: "ASSET", label: "Assets", desc: "What your business owns or is owed" },
  { type: "LIABILITY", label: "Liabilities", desc: "What your business owes others" },
  { type: "EQUITY", label: "Equity", desc: "Owner's stake in the business" },
  { type: "REVENUE", label: "Revenue", desc: "Money earned from sales" },
  { type: "COGS", label: "Cost of Sales", desc: "Direct cost of goods sold" },
  { type: "EXPENSE", label: "Expenses", desc: "Running costs of the business" },
];

export default function AccountsPage() {
  const [rows, setRows] = useState<Acc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then((d) => setRows(d.accounts || [])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Chart of Accounts</h1>
        <p className="text-sm text-slate-500">The accounting categories behind your reports. You don&apos;t need to memorize these — the Assistant handles them for you.</p>
      </div>
      {loading ? <div className="card p-6 text-slate-500">Loading...</div> : GROUPS.map((g) => {
        const list = rows.filter((r) => r.type === g.type);
        if (list.length === 0) return null;
        return (
          <div key={g.type} className="card p-4">
            <h2 className="font-bold">{g.label}</h2>
            <p className="text-xs text-slate-500 mb-2">{g.desc}</p>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Code</th><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id}>
                      <td className="font-mono">{a.code}</td>
                      <td className="font-semibold">{a.name}</td>
                      <td className="text-right font-mono">{a.debit > 0 ? fmt(a.debit) : "—"}</td>
                      <td className="text-right font-mono">{a.credit > 0 ? fmt(a.credit) : "—"}</td>
                      <td className="text-right font-mono font-bold">{fmt(a.debit - a.credit === 0 ? 0 : (["ASSET", "EXPENSE", "COGS"].includes(a.type) || a.code === "3100" ? a.debit - a.credit : a.credit - a.debit))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
