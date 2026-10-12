"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => "₦" + (n || 0).toLocaleString("en-NG");

type Tx = {
  id: number; transactionDate: string; transactionType: string; description: string;
  amount: number; amountPaid: number; paymentStatus: string; status: string; source: string;
  customerName: string | null; supplierName: string | null; reference: string | null;
};

export default function LedgerPage() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ type: "", status: "", from: "", to: "", q: "" });

  function load() {
    setLoading(true);
    const sp = new URLSearchParams();
    if (f.type) sp.set("type", f.type);
    if (f.status) sp.set("status", f.status);
    if (f.from) sp.set("from", f.from);
    if (f.to) sp.set("to", f.to);
    if (f.q) sp.set("q", f.q);
    fetch("/api/transactions?" + sp.toString()).then((r) => r.json()).then((d) => setRows(d.transactions || [])).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function voidTx(id: number) {
    if (!confirm("Void this transaction? A reversing journal entry will be created and the record kept.")) return;
    const res = await fetch(`/api/transactions?action=void&id=${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (res.ok) load();
    else alert((await res.json()).error || "Could not void.");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 no-print">
        <div>
          <h1 className="text-2xl font-black">Transaction Ledger</h1>
          <p className="text-sm text-slate-500">{rows.length} records</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => window.print()}>🖨️ Print</button>
          <a className="btn-ghost" href="/api/backup?format=csv&type=transactions">⬇️ CSV</a>
        </div>
      </div>

      <div className="card p-4 no-print">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="">All types</option>
            <option value="sale">Sales</option>
            <option value="expense">Expenses</option>
            <option value="customer_payment">Customer payments</option>
            <option value="supplier_payment">Supplier payments</option>
            <option value="purchase">Purchases</option>
            <option value="owner_draw">Owner drawings</option>
            <option value="owner_capital">Owner capital</option>
            <option value="other_income">Other income</option>
          </select>
          <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="">All statuses</option>
            <option value="posted">Posted</option>
            <option value="voided">Voided</option>
          </select>
          <input type="date" className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
          <input type="date" className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          <input className="input" placeholder="Search..." value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <button className="btn-primary" onClick={load}>Filter</button>
        </div>
      </div>

      <div className="card p-2 sm:p-4">
        {loading ? <p className="p-4 text-slate-500">Loading...</p> : rows.length === 0 ? (
          <div className="p-6 text-center text-slate-500">No transactions match these filters.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Party</th><th>Amount</th><th>Paid</th><th>Pay Status</th><th>Status</th><th>Source</th><th className="no-print">Action</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{r.transactionDate}</td>
                    <td>{r.description}</td>
                    <td className="capitalize whitespace-nowrap">{r.transactionType.replace("_", " ")}</td>
                    <td>{r.customerName || r.supplierName || "—"}</td>
                    <td className="font-bold whitespace-nowrap">{fmt(r.amount)}</td>
                    <td className="whitespace-nowrap">{fmt(r.amountPaid)}</td>
                    <td><span className={`badge ${r.paymentStatus === "paid" ? "badge-paid" : r.paymentStatus === "partial" ? "badge-partial" : "badge-unpaid"}`}>{r.paymentStatus}</span></td>
                    <td><span className={`badge ${r.status === "posted" ? "badge-posted" : "badge-voided"}`}>{r.status}</span></td>
                    <td className="text-xs">{r.source}</td>
                    <td className="no-print">{r.status === "posted" && <button className="text-red-600 text-xs font-bold" onClick={() => voidTx(r.id)}>Void</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
