"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", remember: true });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed.");
      router.push(data.hasBusiness ? "/dashboard" : "/setup");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
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
        <h1 className="text-2xl font-black">Welcome back</h1>
        <p className="text-slate-500 text-sm mt-1">Log in to continue keeping your numbers.</p>
        {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl p-3">{error}</div>}
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Your password" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              <input type="checkbox" checked={form.remember} onChange={(e) => setForm({ ...form, remember: e.target.checked })} className="w-4 h-4 accent-emerald-700" />
              Remember me
            </label>
            <span className="text-slate-400" title="Coming in a future version">Forgot password? (soon)</span>
          </div>
          <button className="btn-primary w-full" disabled={loading}>{loading ? "Logging in..." : "Log in"}</button>
        </form>
        <p className="mt-4 text-sm text-center text-slate-600">
          New here? <Link href="/register" className="text-emerald-700 font-bold">Start free</Link>
        </p>
      </div>
    </div>
  );
}
