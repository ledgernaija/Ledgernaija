"use client";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [biz, setBiz] = useState({ businessName: "", businessType: "", category: "", city: "", state: "", phone: "", currency: "NGN" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/auth?action=me").then((r) => r.json()).then((d) => {
      if (d.business) setBiz({
        businessName: d.business.businessName || "",
        businessType: d.business.businessType || "",
        category: d.business.category || "",
        city: d.business.city || "",
        state: d.business.state || "",
        phone: d.business.phone || "",
        currency: d.business.currency || "NGN",
      });
    }).finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/business", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(biz) });
    setSaving(false);
    setMsg(res.ok ? "Saved ✓" : "Could not save.");
  }

  if (loading) return <div className="card p-6 text-slate-500">Loading...</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-black">Settings</h1>

      <form onSubmit={save} className="card p-5 space-y-3">
        <h2 className="font-bold">Business Profile</h2>
        <div>
          <label className="label">Business name</label>
          <input className="input" value={biz.businessName} onChange={(e) => setBiz({ ...biz, businessName: e.target.value })} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Business type</label><input className="input" value={biz.businessType} onChange={(e) => setBiz({ ...biz, businessType: e.target.value })} /></div>
          <div><label className="label">Category</label><input className="input" value={biz.category} onChange={(e) => setBiz({ ...biz, category: e.target.value })} /></div>
          <div><label className="label">City</label><input className="input" value={biz.city} onChange={(e) => setBiz({ ...biz, city: e.target.value })} /></div>
          <div><label className="label">State</label><input className="input" value={biz.state} onChange={(e) => setBiz({ ...biz, state: e.target.value })} /></div>
          <div><label className="label">Phone</label><input className="input" value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} /></div>
          <div><label className="label">Currency</label><input className="input" value={biz.currency} disabled /></div>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
          {msg && <span className="text-sm font-bold text-emerald-700">{msg}</span>}
        </div>
      </form>

      <div className="card p-5 space-y-3">
        <h2 className="font-bold">Backup & Export</h2>
        <p className="text-sm text-slate-500">Download your records anytime. Keep your own copy safe.</p>
        <div className="flex flex-wrap gap-2">
          <a className="btn-ghost" href="/api/backup?format=json">⬇️ Full backup (JSON)</a>
          <a className="btn-ghost" href="/api/backup?format=csv&type=transactions">⬇️ Transactions (CSV)</a>
          <a className="btn-ghost" href="/api/backup?format=csv&type=customers">⬇️ Customers (CSV)</a>
          <a className="btn-ghost" href="/api/backup?format=csv&type=suppliers">⬇️ Suppliers (CSV)</a>
        </div>
      </div>

      <div className="card p-5 space-y-2">
        <h2 className="font-bold">Coming in future versions</h2>
        <ul className="text-sm text-slate-500 list-disc ml-5 space-y-1">
          <li>Real WhatsApp integration (your accountant on WhatsApp)</li>
          <li>Forgot-password email reset</li>
          <li>Multi-user roles (manager, bookkeeper, staff)</li>
          <li>Bank / POS connections, payroll, inventory, tax</li>
        </ul>
      </div>
    </div>
  );
}
