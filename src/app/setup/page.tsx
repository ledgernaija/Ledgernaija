"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = ["Fashion", "Food & Restaurant", "Beauty", "Electronics & Phones", "Retail", "Wholesale", "Services", "Artisan", "Online Vendor", "Other"];
const TYPES = ["Sole Proprietorship", "Partnership", "Limited Company", "Cooperative", "Other"];

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: "", businessType: "Sole Proprietorship", category: "Fashion",
    city: "Lagos", state: "Lagos", phone: "", currency: "NGN", seedDemo: true,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create business.");
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create business.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-emerald-50 to-slate-100">
      <div className="card w-full max-w-lg p-6 md:p-8">
        <h1 className="text-2xl font-black">Welcome to SME Finance 👋</h1>
        <p className="text-slate-500 text-sm mt-1">Let&apos;s set up your business. This takes less than a minute.</p>
        {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl p-3">{error}</div>}
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="label">Business name *</label>
            <input className="input" required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="e.g. Blessing Fashion Hub" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Business type</label>
              <select className="input" value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">City</label>
              <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Lagos" />
            </div>
            <div>
              <label className="label">State</label>
              <input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Lagos" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Business phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0803 000 0000" />
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option value="NGN">NGN (₦)</option>
              </select>
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 rounded-xl p-3">
            <input type="checkbox" checked={form.seedDemo} onChange={(e) => setForm({ ...form, seedDemo: e.target.checked })} className="w-4 h-4 mt-0.5 accent-emerald-700" />
            <span><b>Load example data</b> (Blessing Fashion Hub style: Emeka, Ada, sample sales & expenses) so I can explore quickly. You can delete it later.</span>
          </label>
          <button className="btn-primary w-full" disabled={loading}>{loading ? "Setting up..." : "Create my business"}</button>
        </form>
      </div>
    </div>
  );
}
