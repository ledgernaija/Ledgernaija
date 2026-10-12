"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => "₦" + (n || 0).toLocaleString("en-NG");

type Sup = {
  id: number; name: string; phone: string | null;
  balance: { totalPurchases: number; paid: number; outstanding: number; lastDate: string | null };
};

export default function SuppliersPage() {
  const [rows, setRows] = useState<Sup[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<{ supplier: { id: number; name: string; phone: string | null }; balance: Sup["balance"]; history: { id: number; transactionDate: string; transactionType: string; description: string; amount: number; amountPaid: number; status: string }[] } | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", date: new Date().toISOString().slice(0, 10) });
  const [buyForm, setBuyForm] = useState({ description: "", amount: "", amountPaid: "", date: new Date().toISOString().slice(0, 10) });

  function load() {
    setLoading(true);
    fetch("/api/suppliers").then((r) => r.json()).then((d) => setRows(d.suppliers || [])).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json();
    if (!res.ok) { setError(d.error); return; }
    setShow(false);
    setForm({ name: "", phone: "", email: "", address: "" });
    load();
  }

  async function openDetail(id: number) {
    const res = await fetch(`/api/suppliers?id=${id}`);
    const d = await res.json();
    if (res.ok) setDetail(d);
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    const res = await fetch("/api/transactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "supplier_payment", supplierId: detail.supplier.id, date: payForm.date, description: `Payment to ${detail.supplier.name}`, amount: Number(payForm.amount) }),
    });
    const d = await res.json();
    if (!res.ok) { alert(d.error); return; }
    setPayForm({ amount: "", date: new Date().toISOString().slice(0, 10) });
    openDetail(detail.supplier.id);
    load();
  }

  async function recordPurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    const res = await fetch("/api/transactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "purchase", supplierId: detail.supplier.id, date: buyForm.date, description: buyForm.description, amount: Number(buyForm.amount), amountPaid: Number(buyForm.amountPaid || 0) }),
    });
    const d = await res.json();
    if (!res.ok) { alert(d.error); return; }
    setBuyForm({ description: "", amount: "", amountPaid: "", date: new Date().toISOString().slice(0, 10) });
    openDetail(detail.supplier.id);
    load();
  }

  const totalOut = rows.reduce((s, r) => s + Math.max(0, r.balance.outstanding), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-black">Suppliers</h1>
          <p className="text-sm text-slate-500">Payables: <b className="text-orange-700">{fmt(totalOut)}</b> · {rows.length} suppliers</p>
        </div>
        <button className="btn-primary" onClick={() => setShow(!show)}>+ Add supplier</button>
      </div>

      {show && (
        <form onSubmit={save} className="card p-5 space-y-3">
          <h3 className="font-bold">Add supplier</h3>
          {error && <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl p-3">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Name *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. ABC Fashion Supplies" /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Address</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <button className="btn-primary">Save supplier</button>
        </form>
      )}

      <div className="card p-2 sm:p-4">
        {loading ? <p className="p-4 text-slate-500">Loading...</p> : rows.length === 0 ? (
          <div className="p-6 text-center text-slate-500">No suppliers yet. Add your first supplier above.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Supplier</th><th>Phone</th><th>Purchases</th><th>Paid</th><th>Outstanding</th><th>Last Txn</th><th>Action</th></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td className="font-bold">{s.name}</td>
                    <td>{s.phone || "—"}</td>
                    <td className="whitespace-nowrap">{fmt(s.balance.totalPurchases)}</td>
                    <td className="whitespace-nowrap">{fmt(s.balance.paid)}</td>
                    <td className={`font-black whitespace-nowrap ${s.balance.outstanding > 0 ? "text-orange-700" : "text-emerald-700"}`}>{fmt(s.balance.outstanding)}</td>
                    <td className="whitespace-nowrap">{s.balance.lastDate || "—"}</td>
                    <td><button className="text-emerald-700 font-bold text-sm" onClick={() => openDetail(s.id)}>View / Pay</button></td>
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
                <h3 className="font-black text-xl">{detail.supplier.name}</h3>
                <p className="text-sm text-slate-500">{detail.supplier.phone || "No phone"}</p>
              </div>
              <button className="btn-ghost" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 rounded-xl p-3"><div className="text-[11px] font-bold text-slate-500">BOUGHT</div><div className="font-black">{fmt(detail.balance.totalPurchases)}</div></div>
              <div className="bg-emerald-50 rounded-xl p-3"><div className="text-[11px] font-bold text-slate-500">PAID</div><div className="font-black text-emerald-700">{fmt(detail.balance.paid)}</div></div>
              <div className="bg-orange-50 rounded-xl p-3"><div className="text-[11px] font-bold text-slate-500">OWED</div><div className="font-black text-orange-700">{fmt(detail.balance.outstanding)}</div></div>
            </div>
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <form onSubmit={recordPayment} className="bg-slate-50 rounded-xl p-4 space-y-2">
                <h4 className="font-bold text-sm">Pay supplier</h4>
                <input className="input" required inputMode="numeric" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="Amount (₦)" />
                <input type="date" className="input" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
                <button className="btn-primary w-full">Pay</button>
              </form>
              <form onSubmit={recordPurchase} className="bg-slate-50 rounded-xl p-4 space-y-2">
                <h4 className="font-bold text-sm">New credit purchase</h4>
                <input className="input" required value={buyForm.description} onChange={(e) => setBuyForm({ ...buyForm, description: e.target.value })} placeholder="e.g. Ankara fabrics" />
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" required inputMode="numeric" value={buyForm.amount} onChange={(e) => setBuyForm({ ...buyForm, amount: e.target.value })} placeholder="Total ₦" />
                  <input className="input" inputMode="numeric" value={buyForm.amountPaid} onChange={(e) => setBuyForm({ ...buyForm, amountPaid: e.target.value })} placeholder="Paid ₦" />
                </div>
                <button className="btn-secondary w-full !min-h-[44px]">Add purchase</button>
              </form>
            </div>
            <h4 className="mt-4 font-bold">Transaction history</h4>
            <div className="mt-2 space-y-2">
              {detail.history.length === 0 ? <p className="text-sm text-slate-500">No transactions yet.</p> : detail.history.map((h) => (
                <div key={h.id} className="flex justify-between text-sm bg-slate-50 rounded-xl px-3 py-2">
                  <div><b>{h.description}</b><div className="text-xs text-slate-500">{h.transactionDate} · {h.transactionType.replace("_", " ")} · {h.status}</div></div>
                  <div className="text-right font-bold">{fmt(h.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
