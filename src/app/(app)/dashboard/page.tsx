"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const fmt = (n: number) => "₦" + (n || 0).toLocaleString("en-NG");

type Dash = {
  cards: { totalSales: number; totalExpenses: number; cashBalance: number; receivables: number; payables: number; netProfit: number; netProfitMonth: number; txCount: number };
  recent: { id: number; transactionDate: string; transactionType: string; description: string; amount: number; status: string }[];
  topCustomers: { id: number; name: string; totalSales: number }[];
  outstandingCustomers: { id: number; name: string; outstanding: number }[];
  outstandingSuppliers: { id: number; name: string; outstanding: number }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not load dashboard.");
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="card p-6 text-red-700">{error}</div>;
  if (!data) return <div className="card p-8 text-center text-slate-500">Loading dashboard...</div>;

  const c = data.cards;
  const cards = [
    { label: "Total Sales", value: fmt(c.totalSales), icon: "🧾", bg: "bg-emerald-50", href: "/sales" },
    { label: "Total Expenses", value: fmt(c.totalExpenses), icon: "💸", bg: "bg-red-50", href: "/expenses" },
    { label: "Cash Balance", value: fmt(c.cashBalance), icon: "💰", bg: "bg-blue-50", href: "/transactions" },
    { label: "Customers Owe You", value: fmt(c.receivables), icon: "👥", bg: "bg-amber-50", href: "/customers" },
    { label: "You Owe Suppliers", value: fmt(c.payables), icon: "🏭", bg: "bg-orange-50", href: "/suppliers" },
    { label: "Net Profit", value: fmt(c.netProfit), icon: c.netProfit >= 0 ? "📈" : "📉", bg: c.netProfit >= 0 ? "bg-emerald-50" : "bg-red-50", href: "/reports" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black">Dashboard</h1>
          <p className="text-sm text-slate-500">This month&apos;s profit: <b className={c.netProfitMonth >= 0 ? "text-emerald-700" : "text-red-700"}>{fmt(c.netProfitMonth)}</b> · {c.txCount} transactions</p>
        </div>
        <Link href="/assistant" className="btn-primary">💬 Record transaction</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((k) => (
          <Link key={k.label} href={k.href} className={`card p-4 ${k.bg} hover:shadow-md transition`}>
            <div className="text-2xl">{k.icon}</div>
            <div className="mt-1 text-xs font-bold text-slate-500 uppercase">{k.label}</div>
            <div className="text-lg sm:text-xl font-black truncate">{k.value}</div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">Recent Transactions</h2>
            <Link href="/transactions" className="text-sm text-emerald-700 font-bold">View all →</Link>
          </div>
          {data.recent.length === 0 ? (
            <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
              No transactions yet. <Link href="/assistant" className="text-emerald-700 font-bold">Record your first sale →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recent.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-xl px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{t.description}</div>
                    <div className="text-xs text-slate-500">{t.transactionDate} · {t.transactionType.replace("_", " ")}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black">{fmt(t.amount)}</div>
                    <span className={`badge ${t.status === "posted" ? "badge-posted" : "badge-voided"}`}>{t.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold">Outstanding Customer Balances</h2>
              <Link href="/customers" className="text-sm text-emerald-700 font-bold">All →</Link>
            </div>
            {data.outstandingCustomers.length === 0 ? (
              <p className="text-sm text-slate-500">No outstanding customer debts. 🎉</p>
            ) : (
              <div className="space-y-2">
                {data.outstandingCustomers.map((x) => (
                  <div key={x.id} className="flex justify-between text-sm bg-amber-50 rounded-xl px-3 py-2">
                    <span className="font-semibold">{x.name}</span>
                    <b className="text-amber-800">{fmt(x.outstanding)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold">Outstanding Supplier Balances</h2>
              <Link href="/suppliers" className="text-sm text-emerald-700 font-bold">All →</Link>
            </div>
            {data.outstandingSuppliers.length === 0 ? (
              <p className="text-sm text-slate-500">You don&apos;t owe any supplier. 🎉</p>
            ) : (
              <div className="space-y-2">
                {data.outstandingSuppliers.map((x) => (
                  <div key={x.id} className="flex justify-between text-sm bg-orange-50 rounded-xl px-3 py-2">
                    <span className="font-semibold">{x.name}</span>
                    <b className="text-orange-800">{fmt(x.outstanding)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card p-5">
            <h2 className="font-bold mb-3">Top Customers</h2>
            {data.topCustomers.length === 0 ? (
              <p className="text-sm text-slate-500">No customers yet.</p>
            ) : (
              <div className="space-y-2">
                {data.topCustomers.map((x, i) => (
                  <div key={x.id} className="flex justify-between text-sm">
                    <span>{i + 1}. <b>{x.name}</b></span>
                    <span className="font-bold">{fmt(x.totalSales)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
