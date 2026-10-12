"use client";
import { useState } from "react";

const fmt = (n: number | null | undefined) => (n == null ? "—" : "₦" + n.toLocaleString("en-NG"));

const QUICK = [
  "Sold goods",
  "Customer paid",
  "Paid expense",
  "Bought stock",
  "Paid supplier",
  "Customer owes me",
  "Show my sales",
  "How much do customers owe me?",
  "How much do I owe suppliers?",
  "What is my profit?",
];

const EXAMPLE_FILL: Record<string, string> = {
  "Sold goods": "Sold 5 dresses to Ada for 250k. She paid 150k.",
  "Customer paid": "Emeka paid me 50k.",
  "Paid expense": "Paid 20k for transport.",
  "Bought stock": "Bought goods from ABC Supplies for 300k. I haven't paid.",
  "Paid supplier": "Paid my supplier 100k.",
  "Customer owes me": "John owes me 75k.",
};

type Parsed = {
  intent: string; amount: number | null; amount_paid: number | null; amount_owed: number | null;
  customer: string | null; supplier: string | null; description: string | null;
  payment_status: string | null; category: string | null; expense_account_code: string | null;
  confidence: number; needs_clarification: boolean; questions: string[];
};

type Msg = { role: "user" | "ai"; text?: string; parsed?: Parsed; preview?: string[]; answer?: string; matchedCustomer?: { id: number; name: string } | null; matchedSupplier?: { id: number; name: string } | null };

const EXPENSES = [
  { code: "6000", label: "Rent" }, { code: "6010", label: "Transportation" },
  { code: "6020", label: "Electricity" }, { code: "6030", label: "Internet" },
  { code: "6040", label: "Salaries" }, { code: "6050", label: "Marketing" },
  { code: "6060", label: "Bank Charges" }, { code: "6070", label: "Repairs" },
  { code: "6080", label: "General Expenses" },
];

export default function AssistantPage() {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "ai", text: "Hello! Tell me what happened in your business today. For example: \"Sold 5 shirts to Ada for ₦250,000. She paid ₦150,000.\"" },
  ]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<{ parsed: Parsed; preview: string[]; matchedCustomer: { id: number; name: string } | null; matchedSupplier: { id: number; name: string } | null } | null>(null);
  const [edit, setEdit] = useState<{ amount: string; paid: string; party: string; desc: string; expCode: string } | null>(null);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || loading) return;
    setInput("");
    setPending(null);
    setEdit(null);
    setMsgs((m) => [...m, { role: "user", text: message }]);
    setLoading(true);
    try {
      const res = await fetch("/api/assistant?action=interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not understand that.");
      if (data.answer) {
        setMsgs((m) => [...m, { role: "ai", answer: data.answer }]);
      } else if (data.parsed?.needs_clarification) {
        const q = (data.parsed.questions || ["Can you tell me more?"]).join(" ");
        setMsgs((m) => [...m, { role: "ai", text: q, parsed: data.parsed }]);
      } else {
        setPending({ parsed: data.parsed, preview: data.preview || [], matchedCustomer: data.matchedCustomer || null, matchedSupplier: data.matchedSupplier || null });
        setEdit({
          amount: String(data.parsed.amount ?? ""),
          paid: data.parsed.amount_paid != null ? String(data.parsed.amount_paid) : "",
          party: data.parsed.customer || data.parsed.supplier || "",
          desc: data.parsed.description || "",
          expCode: data.parsed.expense_account_code || "6080",
        });
        setMsgs((m) => [...m, { role: "ai", parsed: data.parsed, preview: data.preview, matchedCustomer: data.matchedCustomer, matchedSupplier: data.matchedSupplier }]);
      }
    } catch (e: unknown) {
      setMsgs((m) => [...m, { role: "ai", text: e instanceof Error ? e.message : "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!pending || !edit) return;
    const amount = Math.round(Number(edit.amount) || 0);
    if (!(amount > 0)) {
      setMsgs((m) => [...m, { role: "ai", text: "Please enter a valid amount. I will never guess amounts." }]);
      return;
    }
    setLoading(true);
    try {
      const p = pending.parsed;
      const payload = {
        intent: p.intent,
        amount,
        amountPaid: p.intent === "sale" || p.intent === "purchase" ? Math.round(Number(edit.paid) || 0) : amount,
        customer: p.intent === "sale" || p.intent === "customer_payment" ? (edit.party || p.customer) : null,
        customerId: pending.matchedCustomer?.id ?? null,
        supplier: p.intent === "purchase" || p.intent === "supplier_payment" ? (edit.party || p.supplier) : null,
        supplierId: pending.matchedSupplier?.id ?? null,
        description: edit.desc || p.description || "",
        expenseAccountCode: edit.expCode,
      };
      const res = await fetch("/api/assistant?action=post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not post transaction.");
      setMsgs((m) => [...m, { role: "ai", text: "✅ " + data.message + " Anything else?" }]);
      setPending(null);
      setEdit(null);
    } catch (e: unknown) {
      setMsgs((m) => [...m, { role: "ai", text: e instanceof Error ? e.message : "Could not post. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function cancel() {
    setPending(null);
    setEdit(null);
    setMsgs((m) => [...m, { role: "ai", text: "No problem — cancelled. Nothing was recorded. Tell me what happened whenever you're ready." }]);
  }

  const lastAiWithParsed = [...msgs].reverse().find((m) => m.role === "ai" && m.parsed && !m.parsed.needs_clarification);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-black">Tell me what happened in your business</h1>
        <p className="text-sm text-slate-500">Type in plain language. I&apos;ll confirm before anything is recorded — I never guess amounts.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button
            key={q}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-full px-3 py-2 hover:border-emerald-500 hover:text-emerald-700"
            onClick={() => {
              if (EXAMPLE_FILL[q]) setInput(EXAMPLE_FILL[q]);
              else send(q);
            }}
          >
            {q}
          </button>
        ))}
      </div>

      <div className="card p-4 space-y-3 min-h-[300px] max-h-[55vh] overflow-y-auto bg-slate-50">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`${m.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"} px-4 py-3 max-w-[92%] text-sm whitespace-pre-line shadow-sm`}>
              {m.text && <div>{m.text}</div>}
              {m.answer && <div>{m.answer}</div>}
              {m.role === "ai" && m.parsed && !m.parsed.needs_clarification && m.preview && (
                <div className="mt-1">
                  <div className="font-bold">I understood this:</div>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <span className="text-slate-500">Type:</span><b className="capitalize">{m.parsed.intent.replace("_", " ")}</b>
                    {(m.parsed.customer || m.parsed.supplier) && (
                      <>
                        <span className="text-slate-500">{m.parsed.customer ? "Customer:" : "Supplier:"}</span>
                        <b>{m.parsed.customer || m.parsed.supplier}</b>
                      </>
                    )}
                    {m.parsed.description && (<><span className="text-slate-500">Details:</span><span>{m.parsed.description}</span></>)}
                    <span className="text-slate-500">Total:</span><b>{fmt(m.parsed.amount)}</b>
                    {m.parsed.amount_paid != null && (<><span className="text-slate-500">Paid:</span><b>{fmt(m.parsed.amount_paid)}</b></>)}
                    {m.parsed.amount_owed != null && m.parsed.amount_owed > 0 && (<><span className="text-slate-500">Outstanding:</span><b className="text-amber-700">{fmt(m.parsed.amount_owed)}</b></>)}
                    {m.parsed.category && (<><span className="text-slate-500">Category:</span><span>{m.parsed.category}</span></>)}
                  </div>
                  <div className="mt-2 text-xs bg-slate-50 rounded-lg p-2">
                    <div className="font-bold text-slate-500 uppercase text-[10px]">Accounting</div>
                    {m.preview.map((p, j) => <div key={j}>• {p}</div>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-sm text-slate-400 animate-pulse">Thinking...</div>}
      </div>

      {/* Confirmation / edit panel */}
      {pending && edit && (
        <div className="card p-4 border-2 border-emerald-500">
          <h3 className="font-bold">Confirm & post?</h3>
          <p className="text-xs text-slate-500">Check the details. Edit anything before posting.</p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Total amount (₦)</label>
              <input className="input" inputMode="numeric" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} />
            </div>
            {(pending.parsed.intent === "sale" || pending.parsed.intent === "purchase") && (
              <div>
                <label className="label">Amount paid now (₦)</label>
                <input className="input" inputMode="numeric" value={edit.paid} onChange={(e) => setEdit({ ...edit, paid: e.target.value })} />
              </div>
            )}
            {(pending.parsed.intent === "sale" || pending.parsed.intent === "customer_payment" || pending.parsed.intent === "purchase" || pending.parsed.intent === "supplier_payment") && (
              <div>
                <label className="label">{pending.parsed.intent.includes("supplier") || pending.parsed.intent === "purchase" ? "Supplier" : "Customer"}</label>
                <input className="input" value={edit.party} onChange={(e) => setEdit({ ...edit, party: e.target.value })} placeholder="Name" />
                {(pending.matchedCustomer || pending.matchedSupplier) && (
                  <div className="text-xs text-emerald-700 mt-1">Matched: {pending.matchedCustomer?.name || pending.matchedSupplier?.name}</div>
                )}
              </div>
            )}
            {pending.parsed.intent === "expense" && (
              <div>
                <label className="label">Expense category</label>
                <select className="input" value={edit.expCode} onChange={(e) => setEdit({ ...edit, expCode: e.target.value })}>
                  {EXPENSES.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <input className="input" value={edit.desc} onChange={(e) => setEdit({ ...edit, desc: e.target.value })} />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn-primary flex-1" onClick={confirm} disabled={loading}>Confirm & Post</button>
            <button className="btn-ghost flex-1" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex gap-2 sticky bottom-16 lg:bottom-4 bg-slate-100 py-2"
      >
        <input
          className="input flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Example: Sold 5 shirts to Ada for ₦250,000. She paid ₦150,000.'
        />
        <button className="btn-primary shrink-0" disabled={loading || !input.trim()}>Send</button>
      </form>
      {lastAiWithParsed ? null : null}
    </div>
  );
}
