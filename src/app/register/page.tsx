"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth?action=register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed.");
      router.push("/setup");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-emerald-50 to-slate-100">
      <div className="card w-full max-w-md p-6 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-xl">₦</div>
          <div className="font-black text-lg">SME FINANCE</div>
        </div>
        <h1 className="text-2xl font-black">Create your account</h1>
        <p className="text-slate-500 text-sm mt-1">Start recording your business in plain language.</p>
        {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl p-3">{error}</div>}
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="label">Full name *</label>
            <input className="input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Blessing Adeyemi" />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">Phone number</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0803 000 0000" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Password *</label>
              <input className="input" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min. 6 characters" />
            </div>
            <div>
              <label className="label">Confirm *</label>
              <input className="input" type="password" required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Repeat password" />
            </div>
          </div>
          <button className="btn-primary w-full" disabled={loading}>{loading ? "Creating account..." : "Create account"}</button>
        </form>
        <p className="mt-4 text-sm text-center text-slate-600">
          Already have an account? <Link href="/login" className="text-emerald-700 font-bold">Log in</Link>
        </p>
        <p className="mt-2 text-xs text-center text-slate-400">Prototype for testing — not a bank or lender.</p>
      </div>
    </div>
  );
}
