"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => "₦" + (n || 0).toLocaleString("en-NG");

type Entry = {
  id: number; entryDate: string; description: string; transactionId: number | null;
  totalDebit: number; totalCredit: number; balanced: boolean;
  lines: { id: number; debit: number; credit: number; account: { code: string; name: string } | null }[];
};

export default function JournalPage() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/journal").then((r) => r.json()).then((d) => setRows(d.entries || [])).finally(() => setLoading(false));
  }, []);

  const allBalanced = rows.every((r) => r.balanced);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-black">Journal</h1>
          <p className="text-sm text-slate-500">
            Every entry must balance (debits = credits).{" "}
            {rows.length > 0 && (allBalanced ? <span className="badge badge-paid">✓ All balanced</span> : <span className="badge badge-unpaid">⚠ Unbalanced found</span>)}
          </p>
        </div>
        <button className="btn-ghost no-print" onClick={() => window.print()}>🖨️ Print</button>
      </div>

      <div className="space-y-3">
        {loading ? <div className="card p-6 text-slate-500">Loading...</div> : rows.length === 0 ? (
          <div className="card p-6 text-center text-slate-500">No journal entries yet. Post a transaction to see double-entry records here.</div>
        ) : rows.map((e) => (
          <div key={e.id} className="card p-4">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <div className="font-bold">#{e.id} — {e.description}</div>
                <div className="text-xs text-slate-500">{e.entryDate}{e.transactionId ? ` · Txn #${e.transactionId}` : ""}</div>
              </div>
              <span className={`badge ${e.balanced ? "badge-paid" : "badge-unpaid"}`}>{e.balanced ? "Balanced ✓" : "UNBALANCED"}</span>
            </div>
            <div className="mt-2 table-wrap">
              <table className="data">
                <thead><tr><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
                <tbody>
                  {e.lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.account ? `${l.account.code} — ${l.account.name}` : "—"}</td>
                      <td className="text-right font-mono">{l.debit > 0 ? fmt(l.debit) : "—"}</td>
                      <td className="text-right font-mono">{l.credit > 0 ? fmt(l.credit) : "—"}</td>
                    </tr>
                  ))}
                  <tr className="font-black bg-slate-50">
                    <td>Total</td>
                    <td className="text-right font-mono">{fmt(e.totalDebit)}</td>
                    <td className="text-right font-mono">{fmt(e.totalCredit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
