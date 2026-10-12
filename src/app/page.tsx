import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-slate-100">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-xl">₦</div>
          <div>
            <div className="font-black text-lg leading-none">SME FINANCE</div>
            <div className="text-xs text-slate-500">Your Business Accountant on WhatsApp</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost !min-h-[44px] text-sm">Log in</Link>
          <Link href="/register" className="btn-primary !min-h-[44px] text-sm">Start Free</Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-4 pt-10 pb-16">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-900 text-xs font-bold px-3 py-1.5 rounded-full mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              LIVE PROTOTYPE V0.5 — Built for Nigerian SMEs
            </div>
            <h1 className="text-4xl md:text-5xl font-black leading-tight tracking-tight">
              Run Your Business.<br />
              <span className="text-emerald-700">We&apos;ll Keep the Numbers.</span>
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              SME Finance helps small businesses record sales, expenses, customer debts and
              business finances without needing to understand complicated accounting software.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link href="/register" className="btn-primary text-lg">Start Free</Link>
              <a href="#how" className="btn-secondary text-lg">See How It Works</a>
            </div>
            <p className="mt-3 text-sm text-slate-500">Free during testing · No accounting knowledge needed · Works on any phone</p>
          </div>

          {/* Chat demo */}
          <div className="card p-5 shadow-xl">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Live example</div>
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="chat-bubble-user px-4 py-3 max-w-[85%] text-sm">
                  Sold 3 shoes to Emeka for ₦150,000. He paid ₦100,000.
                </div>
              </div>
              <div className="flex justify-start">
                <div className="chat-bubble-ai px-4 py-3 max-w-[90%] text-sm shadow-sm">
                  <div className="font-bold mb-1">Here&apos;s what I understood:</div>
                  <div className="space-y-0.5 text-slate-700">
                    <div>Sale: <b>₦150,000</b></div>
                    <div>Paid: <b>₦100,000</b></div>
                    <div>Outstanding: <b className="text-amber-700">₦50,000</b></div>
                    <div>Customer: <b>Emeka</b></div>
                  </div>
                  <div className="mt-2 font-semibold">Post this transaction?</div>
                  <div className="mt-2 flex gap-2">
                    <span className="btn-primary !min-h-0 !py-1.5 !px-4 text-xs">Confirm</span>
                    <span className="btn-ghost !min-h-0 !py-1.5 !px-4 text-xs">Edit</span>
                  </div>
                </div>
              </div>
            </div>
            <Link href="/register" className="mt-4 block text-center text-emerald-700 font-bold text-sm hover:underline">
              Try it yourself — it takes 1 minute →
            </Link>
          </div>
        </div>

        {/* Benefits */}
        <div id="how" className="mt-16 grid md:grid-cols-3 gap-5">
          {[
            { icon: "💬", title: "Record Your Business", text: "Tell us what happened in plain language." },
            { icon: "📊", title: "Understand Your Numbers", text: "See sales, expenses, profit and money owed." },
            { icon: "📁", title: "Build Your Financial History", text: "Keep organized business records that can eventually help you become financing-ready." },
          ].map((b) => (
            <div key={b.title} className="card p-6">
              <div className="text-3xl">{b.icon}</div>
              <h3 className="mt-3 font-bold text-lg">{b.title}</h3>
              <p className="mt-1 text-slate-600">{b.text}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="mt-12 card p-6 md:p-8">
          <h2 className="font-black text-2xl">How it works</h2>
          <div className="mt-4 grid md:grid-cols-4 gap-4">
            {[
              { n: "1", t: "Say what happened", d: "\"Paid ₦20,000 for transport\"" },
              { n: "2", t: "We understand it", d: "Sale, expense, payment or stock" },
              { n: "3", t: "You confirm", d: "Nothing is posted without your OK" },
              { n: "4", t: "See your reports", d: "Profit, debts, balances — always ready" },
            ].map((s) => (
              <div key={s.n} className="bg-slate-50 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-black flex items-center justify-center">{s.n}</div>
                <div className="mt-2 font-bold">{s.t}</div>
                <div className="text-sm text-slate-500">{s.d}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
            <b>Our promise:</b> We never invent amounts. If something is unclear, we ask you first.
            Every transaction is balanced and recorded properly — like a real accountant would.
          </div>
        </div>

        {/* Who */}
        <div className="mt-12 text-center">
          <h2 className="font-black text-2xl">Made for businesses like yours</h2>
          <p className="mt-2 text-slate-600">Fashion · Food · Beauty · Electronics · Retail · Services · Artisans · Online vendors</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className="btn-primary text-lg">Start Free</Link>
            <Link href="/login" className="btn-secondary text-lg">I have an account</Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        SME Finance V0.5 — Prototype for user testing. Not a bank, lender or financial institution.
      </footer>
    </div>
  );
}
