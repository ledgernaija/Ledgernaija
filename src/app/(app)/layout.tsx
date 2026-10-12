"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/assistant", label: "Assistant", icon: "💬" },
  { href: "/sales", label: "Sales", icon: "🧾" },
  { href: "/expenses", label: "Expenses", icon: "💸" },
  { href: "/customers", label: "Customers", icon: "👥" },
  { href: "/suppliers", label: "Suppliers", icon: "🏭" },
  { href: "/transactions", label: "Ledger", icon: "📒" },
  { href: "/journal", label: "Journal", icon: "📓" },
  { href: "/accounts", label: "Accounts", icon: "🗂️" },
  { href: "/reports", label: "Reports", icon: "📊" },
  { href: "/audit", label: "Audit Log", icon: "🔍" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [biz, setBiz] = useState<{ businessName: string } | null>(null);
  const [user, setUser] = useState<{ fullName: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth?action=me")
      .then(async (r) => {
        if (!r.ok) throw new Error("auth");
        const d = await r.json();
        if (!d.user) throw new Error("auth");
        setUser(d.user);
        if (!d.business) {
          router.push("/setup");
          return;
        }
        setBiz(d.business);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    await fetch("/api/auth?action=logout", { method: "POST" });
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-2xl mx-auto animate-pulse">₦</div>
          <p className="mt-3 text-slate-500 font-semibold">Loading your business...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 no-print">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button className="lg:hidden btn-ghost !p-2 !min-h-0" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
              <span className="text-xl">{menuOpen ? "✕" : "☰"}</span>
            </button>
            <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-lg shrink-0">₦</div>
            <div className="min-w-0">
              <div className="font-black truncate text-sm sm:text-base">{biz?.businessName || "SME Finance"}</div>
              <div className="text-[11px] text-slate-500 truncate hidden sm:block">{user?.fullName}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/assistant" className="btn-primary !min-h-[42px] !py-1.5 text-sm">💬 Assistant</Link>
            <button onClick={logout} className="btn-ghost !min-h-[42px] !py-1.5 text-sm hidden sm:inline-flex">Log out</button>
          </div>
        </div>
        {/* Mobile nav */}
        {menuOpen && (
          <nav className="lg:hidden border-t border-slate-100 px-4 py-3 grid grid-cols-2 gap-1 bg-white max-h-[60vh] overflow-y-auto">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className={`navlink ${pathname === n.href ? "active" : ""}`}>
                <span>{n.icon}</span> {n.label}
              </Link>
            ))}
            <button onClick={logout} className="navlink text-left"><span>🚪</span> Log out</button>
          </nav>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-4 py-5 flex gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0 no-print">
          <nav className="card p-3 space-y-0.5 sticky top-20">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={`navlink ${pathname === n.href ? "active" : ""}`}>
                <span>{n.icon}</span> {n.label}
              </Link>
            ))}
          </nav>
          <div className="card p-4 mt-4 text-xs text-slate-500">
            <b className="text-slate-700">V0.5 Prototype</b><br />
            Not a bank or lender. Records are for testing.
          </div>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Mobile bottom quick nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-30 no-print">
        <div className="grid grid-cols-5 text-center text-[11px] font-semibold">
          {[
            { href: "/dashboard", label: "Home", icon: "🏠" },
            { href: "/assistant", label: "Assistant", icon: "💬" },
            { href: "/sales", label: "Sales", icon: "🧾" },
            { href: "/customers", label: "Customers", icon: "👥" },
            { href: "/reports", label: "Reports", icon: "📊" },
          ].map((n) => (
            <Link key={n.href} href={n.href} className={`py-2.5 ${pathname === n.href ? "text-emerald-700" : "text-slate-500"}`}>
              <div className="text-lg leading-none">{n.icon}</div>
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="h-16 lg:hidden" />
    </div>
  );
}
