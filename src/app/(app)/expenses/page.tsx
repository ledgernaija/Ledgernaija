"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const fmt = (n: number) => "₦" + (n || 0).toLocaleString("en-NG");
const EXPENSES = [
  { code: "6000", label: "Rent" }, { code: "6010", label: "Transportation" },
  { code: "6020", label: "Electricity" }, { code: "6030", label: "Internet" },
  { code: "6040", label: "Salaries" }, { code: "6050", label: "Marketing" },
  { code: "6060", label: "Bank Charges" }, { code: "6070", label: "Repairs" },
  { code: "6080", label: "General Expenses" },
];

type Tx = { id: number; transactionDate: string; description: string; amount: number; status: string; expenseAccountId: number | null };

export default function ExpensesPage() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [accounts, setAccounts] = useState<{ id: number; code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), description: "", amount: "", expenseAccountCode: "6080" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/transactions?type=expense").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]).then(([t, a]) => {
      setRows(t.transactions || []);
      setAccounts(a.accounts || []);
    }).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function accName(id: number | null) {
    if (!id) return "—";
    return accounts.find((a) => a.id === id)?.name || "—";
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "expense", ...form, amount: Number(form.amount) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setShow(false);
      setForm({ date: new Date().toISOString().slice(0, 10), description: "", amount: "", expenseAccountCode: "6080" });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save expense.");
    } finally {
      setSaving(false);
    }
  }

  async function voidTx(id: number) {
    if (!confirm("Void this expense? A reversing entry will be created.")) return;
    const res = await fetch(`/api/transactions?action=void&id=${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (res.ok) load();
    else alert((await res.json()).error || "Could not void.");
  }

  const total = rows.filter((r) => r.status === "posted").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-black">Expenses</h1>
          <p className="text-sm text-slate-500">Total: <b>{fmt(total)}</b></p>
        </div>
        <div className="flex gap-2">
          <Link href="/assistant" className="btn-ghost">💬 Use Assistant</Link>
          <button className="btn-primary" onClick={() => setShow(!show)}>+ Record expense</button>
        </div>
      </div>

      {show && (
        <form onSubmit={save} className="card p-5 space-y-3">
          <h3 className="font-bold">Record an expense</h3>
          {error && <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl p-3">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.expenseAccountCode} onChange={(e) => setForm({ ...form, expenseAccountCode: e.target.value })}>
                {EXPENSES.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">What did you spend on?</label>
            <input className="input" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Transport to market" />
          </div>
          <div>
            <label className="label">Amount (₦)</label>
            <input className="input" required inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="20000" />
          </div>
          <button className="btn-primary w-full sm:w-auto" disabled={saving}>{saving ? "Saving..." : "Save expense"}</button>
        </form>
      )}

      <div className="card p-2 sm:p-4">
        {loading ? <p className="p-4 text-slate-500">Loading...</p> : rows.length === 0 ? (
          <div className="p-6 text-center text-slate-500">No expenses yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Status</th><th className="no-print">Action</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{r.transactionDate}</td>
                    <td>{r.description}</td>
                    <td>{accName(r.expenseAccountId)}</td>
                    <td className="font-bold whitespace-nowrap">{fmt(r.amount)}</td>
                    <td><span className={`badge ${r.status === "posted" ? "badge-posted" : "badge-voided"}`}>{r.status}</span></td>
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
