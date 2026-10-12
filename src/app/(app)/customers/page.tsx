"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => "₦" + (n || 0).toLocaleString("en-NG");

type Cust = {
  id: number; name: string; phone: string | null;
  balance: { totalSales: number; paid: number; outstanding: number; lastDate: string | null };
};

export default function CustomersPage() {
  const [rows, setRows] = useState<Cust[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<{ customer: { id: number; name: string; phone: string | null }; balance: Cust["balance"]; history: { id: number; transactionDate: string; transactionType: string; description: string; amount: number; amountPaid: number; status: string }[] } | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", date: new Date().toISOString().slice(0, 10) });
  const [filter, setFilter] = useState("");

  function load() {
    setLoading(true);
    fetch("/api/customers").then((r) => r.json()).then((d) => setRows(d.customers || [])).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json();
    if (!res.ok) { setError(d.error); return; }
    setShow(false);
    setForm({ name: "", phone: "", email: "", address: "" });
    load();
  }

  async function openDetail(id: number) {
    const res = await fetch(`/api/customers?id=${id}`);
    const d = await res.json();
    if (res.ok) setDetail(d);
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    const res = await fetch("/api/transactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "customer_payment", customerId: detail.customer.id, date: payForm.date, description: `Payment from ${detail.customer.name}`, amount: Number(payForm.amount) }),
    });
    const d = await res.json();
    if (!res.ok) { alert(d.error); return; }
    setPayForm({ amount: "", date: new Date().toISOString().slice(0, 10) });
    openDetail(detail.customer.id);
    load();
  }

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()));
  const totalOut = rows.reduce((s, r) => s + Math.max(0, r.balance.outstanding), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-black">Customers</h1>
          <p className="text-sm text-slate-500">Receivables: <b className="text-amber-700">{fmt(totalOut)}</b> · {rows.length} customers</p>
        </div>
        <button className="btn-primary" onClick={() => setShow(!show)}>+ Add customer</button>
      </div>

      {show && (
        <form onSubmit={save} className="card p-5 space-y-3">
          <h3 className="font-bold">Add customer</h3>
          {error && <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl p-3">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Name *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Emeka" /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0803..." /></div>
            <div><label className="label">Email</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Address</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <button className="btn-primary">Save customer</button>
        </form>
      )}

      <div className="card p-4">
        <input className="input max-w-xs" placeholder="Search customers..." value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      <div className="card p-2 sm:p-4">
        {loading ? <p className="p-4 text-slate-500">Loading...</p> : filtered.length === 0 ? (
          <div className="p-6 text-center text-slate-500">No customers found. Add your first customer above.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Customer</th><th>Phone</th><th>Total Sales</th><th>Paid</th><th>Outstanding</th><th>Last Txn</th><th>Action</th></tr></thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="font-bold">{c.name}</td>
                    <td>{c.phone || "—"}</td>
                    <td className="whitespace-nowrap">{fmt(c.balance.totalSales)}</td>
                    <td className="whitespace-nowrap">{fmt(c.balance.paid)}</td>
                    <td className={`font-black whitespace-nowrap ${c.balance.outstanding > 0 ? "text-amber-700" : "text-emerald-700"}`}>{fmt(c.balance.outstanding)}</td>
                    <td className="whitespace-nowrap">{c.balance.lastDate || "—"}</td>
                    <td><button className="text-emerald-700 font-bold text-sm" onClick={() => openDetail(c.id)}>View / Pay</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setDetail(null)}>
          <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-black text-xl">{detail.customer.name}</h3>
                <p className="text-sm text-slate-500">{detail.customer.phone || "No phone"}</p>
              </div>
              <button className="btn-ghost" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 rounded-xl p-3"><div className="text-[11px] font-bold text-slate-500">SALES</div><div className="font-black">{fmt(detail.balance.totalSales)}</div></div>
              <div className="bg-emerald-50 rounded-xl p-3"><div className="text-[11px] font-bold text-slate-500">PAID</div><div className="font-black text-emerald-700">{fmt(detail.balance.paid)}</div></div>
              <div className="bg-amber-50 rounded-xl p-3"><div className="text-[11px] font-bold text-slate-500">OWING</div><div className="font-black text-amber-700">{fmt(detail.balance.outstanding)}</div></div>
            </div>
            <form onSubmit={recordPayment} className="mt-4 bg-slate-50 rounded-xl p-4 flex flex-col sm:flex-row gap-2 items-end">
              <div className="flex-1 w-full"><label className="label">Record payment (₦)</label><input className="input" required inputMode="numeric" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="Amount received" /></div>
              <div><label className="label">Date</label><input type="date" className="input" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} /></div>
              <button className="btn-primary">Record</button>
            </form>
            <h4 className="mt-4 font-bold">Transaction history</h4>
            <div className="mt-2 space-y-2">
              {detail.history.length === 0 ? <p className="text-sm text-slate-500">No transactions yet.</p> : detail.history.map((h) => (
                <div key={h.id} className="flex justify-between text-sm bg-slate-50 rounded-xl px-3 py-2">
                  <div><b>{h.description}</b><div className="text-xs text-slate-500">{h.transactionDate} · {h.transactionType.replace("_", " ")} · {h.status}</div></div>
                  <div className="text-right font-bold">{fmt(h.amount)}{h.transactionType === "sale" && <div className="text-xs font-normal text-slate-500">paid {fmt(h.amountPaid)}</div>}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
