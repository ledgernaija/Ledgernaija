"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const fmt = (n: number) => "₦" + (n || 0).toLocaleString("en-NG");

type Tx = { id: number; transactionDate: string; description: string; amount: number; amountPaid: number; paymentStatus: string; status: string; customerName: string | null; reference: string | null };

export default function SalesPage() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [customers, setCustomers] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), description: "", amount: "", amountPaid: "", customerId: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/transactions?type=sale").then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
    ]).then(([t, c]) => {
      setRows(t.transactions || []);
      setCustomers((c.customers || []).map((x: { id: number; name: string }) => ({ id: x.id, name: x.name })));
    }).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "sale", date: form.date, description: form.description,
          amount: Number(form.amount), amountPaid: form.amountPaid === "" ? Number(form.amount) : Number(form.amountPaid),
          customerId: form.customerId || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setShow(false);
      setForm({ date: new Date().toISOString().slice(0, 10), description: "", amount: "", amountPaid: "", customerId: "" });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save sale.");
    } finally {
      setSaving(false);
    }
  }

  async function voidTx(id: number) {
    if (!confirm("Void this sale? A reversing entry will be created and the record kept for audit.")) return;
    const res = await fetch(`/api/transactions?action=void&id=${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (res.ok) load();
    else alert((await res.json()).error || "Could not void.");
  }

  const total = rows.filter((r) => r.status === "posted").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-black">Sales</h1>
          <p className="text-sm text-slate-500">Total: <b>{fmt(total)}</b> · {rows.length} records</p>
        </div>
        <div className="flex gap-2">
          <Link href="/assistant" className="btn-ghost">💬 Use Assistant</Link>
          <button className="btn-primary" onClick={() => setShow(!show)}>+ Record sale</button>
        </div>
      </div>

      {show && (
        <form onSubmit={save} className="card p-5 space-y-3">
          <h3 className="font-bold">Record a sale</h3>
          {error && <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl p-3">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div>
              <label className="label">Customer (optional for cash sales)</label>
              <select className="input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                <option value="">Walk-in / cash</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">What did you sell?</label>
            <input className="input" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. 3 pairs of shoes" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Total amount (₦)</label>
              <input className="input" required inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="150000" />
            </div>
            <div>
              <label className="label">Amount paid now (₦)</label>
              <input className="input" inputMode="numeric" value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} placeholder="Leave blank = fully paid" />
            </div>
          </div>
          <button className="btn-primary w-full sm:w-auto" disabled={saving}>{saving ? "Saving..." : "Save sale"}</button>
        </form>
      )}

      <div className="card p-2 sm:p-4">
        {loading ? <p className="p-4 text-slate-500">Loading...</p> : rows.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            No sales yet. Record your first sale above — or just tell the <Link href="/assistant" className="text-emerald-700 font-bold">Assistant</Link> what happened.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Date</th><th>Description</th><th>Customer</th><th>Amount</th><th>Paid</th><th>Status</th><th className="no-print">Action</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{r.transactionDate}</td>
                    <td>{r.description}</td>
                    <td>{r.customerName || "—"}</td>
                    <td className="font-bold whitespace-nowrap">{fmt(r.amount)}</td>
                    <td className="whitespace-nowrap">{fmt(r.amountPaid)}</td>
                    <td>
                      <span className={`badge ${r.status === "voided" ? "badge-voided" : r.paymentStatus === "paid" ? "badge-paid" : r.paymentStatus === "partial" ? "badge-partial" : "badge-unpaid"}`}>
                        {r.status === "voided" ? "voided" : r.paymentStatus}
                      </span>
                    </td>
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
