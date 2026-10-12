// SME Finance V0.5 — AI abstraction + rule-based fallback parser
// interpretTransaction(message) — never invents amounts.

export type InterpretResult = {
  intent:
    | "sale"
    | "expense"
    | "customer_payment"
    | "supplier_payment"
    | "purchase"
    | "owner_draw"
    | "owner_capital"
    | "other_income"
    | "query_sales"
    | "query_expenses"
    | "query_receivables"
    | "query_payables"
    | "query_profit"
    | "query_cash"
    | "unknown";
  amount: number | null;
  amount_paid: number | null;
  amount_owed: number | null;
  customer: string | null;
  supplier: string | null;
  description: string | null;
  payment_status: "paid" | "partial" | "unpaid" | null;
  category: string | null;
  expense_account_code: string | null;
  confidence: number;
  needs_clarification: boolean;
  questions: string[];
  raw: string;
  source: "rule-based" | "ai";
};

const EXPENSE_KEYWORDS: { codes: string[]; account: string; label: string }[] = [
  { codes: ["transport", "uber", "bolt", "fuel", "driver", "delivery", "logistics", "danfo", "keke"], account: "6010", label: "Transportation" },
  { codes: ["rent", "shop rent", "store rent", "accommodation"], account: "6000", label: "Rent" },
  { codes: ["electric", "nepa", "light", "power", "prepaid", "phcn", "ekedc"], account: "6020", label: "Electricity" },
  { codes: ["internet", "data", "wifi", "mtn", "glo", "airtel", "subscription"], account: "6030", label: "Internet" },
  { codes: ["salary", "salaries", "wage", "staff", "worker", "employee"], account: "6040", label: "Salaries" },
  { codes: ["market", "ads", "advert", "promo", "instagram", "influencer", "flyer"], account: "6050", label: "Marketing" },
  { codes: ["bank charge", "sms charge", "cot", "transfer charge"], account: "6060", label: "Bank Charges" },
  { codes: ["repair", "fix", "maintain", "service"], account: "6070", label: "Repairs" },
];

function detectExpenseCategory(msg: string): { code: string; label: string } {
  const lower = msg.toLowerCase();
  for (const e of EXPENSE_KEYWORDS) {
    if (e.codes.some((k) => lower.includes(k))) return { code: e.account, label: e.label };
  }
  return { code: "6080", label: "General Expenses" };
}

// Parse money amounts: ₦150,000 / 150,000 / 250k / 1.5m / 2 million
function parseAmounts(msg: string): number[] {
  const results: number[] = [];
  const re = /₦?\s*([\d,]+(?:\.\d+)?)\s*(k|m|million|thousand)?/gi;
  let m: RegExpExecArray | null;
  const lower = msg.toLowerCase();
  while ((m = re.exec(msg)) !== null) {
    const rawNum = m[1].replace(/,/g, "");
    const suffix = (m[2] || "").toLowerCase();
    const base = parseFloat(rawNum);
    if (isNaN(base)) continue;
    // Skip tiny bare numbers that are likely quantities (e.g. "3 pairs") unless they have ₦/k/m or comma
    const hasMoneySignal =
      m[0].includes("₦") || m[0].includes(",") || suffix !== "" || /₦|naira|paid|cost|price|amount|worth|for\s+[\d]/i.test(msg.slice(Math.max(0, m.index - 12), m.index + m[0].length + 6));
    // If number < 100 and no signal, treat as quantity — skip
    if (base < 100 && !hasMoneySignal && !suffix) continue;
    // Skip years like 2024/2025/2026 alone
    if ((base === 2024 || base === 2025 || base === 2026) && !suffix && !m[0].includes("₦")) continue;
    let val = base;
    if (suffix === "k" || suffix === "thousand") val = base * 1000;
    else if (suffix === "m" || suffix === "million") val = base * 1000000;
    if (val <= 0) continue;
    // Avoid duplicates from overlapping matches
    results.push(Math.round(val));
    void lower;
  }
  return results;
}

function extractNameAfter(msg: string, keywords: string[]): string | null {
  for (const kw of keywords) {
    const re = new RegExp(kw + "\\s+([A-Z][A-Za-z.'-]*(?:\\s+[A-Z][A-Za-z.'-]*){0,2})");
    const m = msg.match(re);
    if (m) {
      let name = m[1].trim().replace(/[.,;]+$/, "");
      // filter out non-names
      if (/^(the|a|an|my|some|goods|cash|business|shop|store)\b/i.test(name)) continue;
      // Remove trailing money words
      name = name.replace(/\s+(for|of|worth|valued).*$/i, "").trim();
      if (name.length >= 2) return name;
    }
  }
  return null;
}

function extractLeadingName(msg: string): string | null {
  // "Emeka paid me 50k" / "John owes me 75k" / "Ada paid 100k"
  const m = msg.match(/^\s*([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,1})\s+(paid|owes?|owe|gave|sent|transferred)\b/);
  if (m) {
    const name = m[1].trim();
    if (!/^(i|we|he|she|they|the|customer|supplier)\b/i.test(name)) return name;
  }
  return null;
}

function extractSupplier(msg: string): string | null {
  const from = extractNameAfter(msg, ["from"]);
  if (from) return from;
  // "Paid ABC Supplies 100k" / "Paid my supplier 100k"
  const m = msg.match(/paid\s+(?:my\s+supplier|supplier\s+)?([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,2})\s+[\d₦]/);
  if (m) {
    const name = m[1].trim();
    if (!/^(my|the|a|an|for|cash)\b/i.test(name)) return name;
  }
  return null;
}

function extractDescription(msg: string): string | null {
  // "Sold 3 shoes..." / "Sold 5 shirts to Ada" / "Bought goods..."
  let m = msg.match(/sold\s+(.+?)\s+(to|for|at)\b/i);
  if (m) return m[1].trim().slice(0, 120);
  m = msg.match(/bought\s+(.+?)\s+(from|for|at)\b/i);
  if (m) return m[1].trim().slice(0, 120);
  m = msg.match(/paid\s+[\d₦,.kKmM\s]+\s+for\s+(.+)$/i);
  if (m) return m[1].trim().slice(0, 120);
  return null;
}

export function interpretRuleBased(message: string): InterpretResult {
  const msg = message.trim();
  const lower = msg.toLowerCase();
  const amounts = parseAmounts(msg);

  const base: InterpretResult = {
    intent: "unknown",
    amount: null,
    amount_paid: null,
    amount_owed: null,
    customer: null,
    supplier: null,
    description: null,
    payment_status: null,
    category: null,
    expense_account_code: null,
    confidence: 0,
    needs_clarification: false,
    questions: [],
    raw: message,
    source: "rule-based",
  };

  // ---- QUERIES ----
  if (/how much do (customers?|people|clients?) owe/i.test(msg) || /customers? (owe|owing|debt|balance)/i.test(msg) || /who (owes|is owing)/i.test(msg) || /total receivables/i.test(msg)) {
    return { ...base, intent: "query_receivables", confidence: 0.95 };
  }
  if (/how much do i owe|what do i owe|supplier (balance|debt|owe)|total payables|owe suppliers/i.test(msg)) {
    return { ...base, intent: "query_payables", confidence: 0.95 };
  }
  if (/show (my |me )?(sales|revenue)|total sales|how much (did |have )?(i|we) (sold|sell|made)/i.test(msg)) {
    return { ...base, intent: "query_sales", confidence: 0.9 };
  }
  if (/show (my |me )?expenses|total expenses|how much (did |have )?(i|we) spend/i.test(msg)) {
    return { ...base, intent: "query_expenses", confidence: 0.9 };
  }
  if (/profit|how (is|am) (my|the) business|am i (making|losing)/i.test(msg)) {
    return { ...base, intent: "query_profit", confidence: 0.9 };
  }
  if (/cash (balance|at hand|position)|how much (cash|money) (do i have|is left|remain)/i.test(msg)) {
    return { ...base, intent: "query_cash", confidence: 0.85 };
  }

  // ---- OWNER DRAW ----
  if (/\b(i took|took .*from (the )?business|withdrew|withdraw|for myself|personal use|my own use)\b/i.test(msg)) {
    const amount = amounts[0] ?? null;
    if (amount == null) {
      return { ...base, intent: "owner_draw", confidence: 0.6, needs_clarification: true, questions: ["How much did you take from the business?"] };
    }
    return { ...base, intent: "owner_draw", amount, amount_paid: amount, amount_owed: 0, payment_status: "paid", description: "Owner withdrawal", confidence: 0.9 };
  }

  // ---- OWNER CAPITAL ----
  if (/\b(put .*into (the )?business|added? capital|invest(ed|ment)?|contributed|seed money|started .*with)\b/i.test(msg)) {
    const amount = amounts[0] ?? null;
    if (amount == null) {
      return { ...base, intent: "owner_capital", confidence: 0.6, needs_clarification: true, questions: ["How much did you put into the business?"] };
    }
    return { ...base, intent: "owner_capital", amount, amount_paid: amount, amount_owed: 0, payment_status: "paid", description: "Owner capital", confidence: 0.9 };
  }

  // ---- CUSTOMER PAYMENT: "Emeka paid me 50k" / "Ada paid 100k" / "Received 50k from Emeka" ----
  if (/(paid me|paid us|received .*from|collected .*from)/i.test(msg) || (/^\s*[A-Z][A-Za-z.'-]*\s+paid\b/.test(msg) && !/i paid/i.test(msg))) {
    const customer = extractLeadingName(msg) || extractNameAfter(msg, ["from"]) || null;
    const amount = amounts[0] ?? null;
    if (amount == null) {
      return { ...base, intent: "customer_payment", customer, confidence: 0.65, needs_clarification: true, questions: [`How much did ${customer || "the customer"} pay?`] };
    }
    if (!customer) {
      return { ...base, intent: "customer_payment", amount, confidence: 0.7, needs_clarification: true, questions: ["Which customer paid you?"] };
    }
    return { ...base, intent: "customer_payment", amount, amount_paid: amount, amount_owed: 0, customer, payment_status: "paid", description: `Payment from ${customer}`, confidence: 0.9 };
  }

  // ---- "X owes me 75k" => credit sale ----
  {
    const owesMatch = msg.match(/([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,1})\s+owes?\s+me\b/i);
    if (owesMatch) {
      const customer = owesMatch[1].trim();
      const amount = amounts[0] ?? null;
      if (amount == null) {
        return { ...base, intent: "sale", customer, confidence: 0.65, needs_clarification: true, questions: [`How much does ${customer} owe you?`] };
      }
      return { ...base, intent: "sale", amount, amount_paid: 0, amount_owed: amount, customer, payment_status: "unpaid", description: `Sale to ${customer} (owed)`, category: "Sales Revenue", confidence: 0.85 };
    }
  }

  // ---- SUPPLIER PAYMENT ----
  if (/paid\s+(my\s+)?supplier|paid\s+[A-Z].*suppl/i.test(msg) || (/^paid\b/i.test(msg) && /supplier|abc|supply|supplies|distributor/i.test(msg))) {
    const supplier = extractSupplier(msg) || extractNameAfter(msg, ["supplier"]) || null;
    const amount = amounts[0] ?? null;
    if (amount == null) {
      return { ...base, intent: "supplier_payment", supplier, confidence: 0.6, needs_clarification: true, questions: ["How much did you pay the supplier?"] };
    }
    if (!supplier) {
      return { ...base, intent: "supplier_payment", amount, confidence: 0.7, needs_clarification: true, questions: ["Which supplier did you pay?"] };
    }
    return { ...base, intent: "supplier_payment", amount, amount_paid: amount, amount_owed: 0, supplier, payment_status: "paid", description: `Payment to ${supplier}`, confidence: 0.85 };
  }

  // ---- EXPENSE ----
  if (/\b(paid|spent|spend|expense|bought airtime|paid for)\b/i.test(msg) && !/\bbought\b/i.test(msg) && !/\bsold\b/i.test(msg)) {
    // exclude supplier payment & customer payment already handled; exclude purchase wording with goods/stock
    const isStock = /goods|stock|inventory|materials|products for (sale|resale)/i.test(msg);
    if (!isStock) {
      const { code, label } = detectExpenseCategory(msg);
      const amount = amounts[0] ?? null;
      if (amount == null) {
        return { ...base, intent: "expense", confidence: 0.6, needs_clarification: true, category: label, expense_account_code: code, description: extractDescription(msg), questions: ["How much did you spend?"] };
      }
      const desc = extractDescription(msg) || `${label} expense`;
      return { ...base, intent: "expense", amount, amount_paid: amount, amount_owed: 0, payment_status: "paid", description: desc, category: label, expense_account_code: code, confidence: 0.85 };
    }
  }
  // "Paid rent of 100k" without 'for'
  if (/^paid\s+/i.test(msg) && /(rent|transport|electric|internet|salar|market|repair|bank)/i.test(msg)) {
    const { code, label } = detectExpenseCategory(msg);
    const amount = amounts[0] ?? null;
    if (amount == null) {
      return { ...base, intent: "expense", confidence: 0.6, needs_clarification: true, category: label, expense_account_code: code, questions: [`How much did you pay for ${label.toLowerCase()}?`] };
    }
    return { ...base, intent: "expense", amount, amount_paid: amount, amount_owed: 0, payment_status: "paid", description: `${label}`, category: label, expense_account_code: code, confidence: 0.85 };
  }

  // ---- PURCHASE ----
  if (/\bbought\b/i.test(msg)) {
    const supplier = extractSupplier(msg) || extractNameAfter(msg, ["from"]) || null;
    const amountsFound = amounts;
    const lowerMsg = lower;
    const notPaid = /(haven't paid|have not paid|hasn't paid|has not paid|not paid|yet to pay|on credit|unpaid|still (owe|owing))/i.test(msg);
    const desc = extractDescription(msg) || "Goods purchased";
    if (amountsFound.length === 0) {
      return { ...base, intent: "purchase", supplier, description: desc, confidence: 0.6, needs_clarification: true, questions: ["How much did the goods cost?"] };
    }
    const amount = amountsFound[0];
    let paid: number | null = null;
    if (notPaid) paid = 0;
    else if (amountsFound.length >= 2) paid = amountsFound[1];
    else if (/(paid|i've paid|cash)/i.test(msg) && !notPaid) paid = amount;
    else {
      // ambiguous — ask
      return {
        ...base, intent: "purchase", amount, supplier, description: desc, confidence: 0.7,
        needs_clarification: true,
        questions: [`Did you pay the ₦${amount.toLocaleString()}${supplier ? ` to ${supplier}` : ""}, or is it on credit?`],
      };
    }
    void lowerMsg;
    const owed = amount - (paid ?? 0);
    const status = paid === 0 ? "unpaid" : paid === amount ? "paid" : "partial";
    return { ...base, intent: "purchase", amount, amount_paid: paid, amount_owed: owed, supplier, description: desc, payment_status: status, confidence: supplier ? 0.9 : 0.8 };
  }

  // ---- SALE ----
  if (/\bsold\b|\bsale\b/i.test(msg)) {
    const customer = extractNameAfter(msg, ["to"]) || null;
    const amountsFound = amounts;
    const notPaid = /(haven't paid|have not paid|hasn't paid|has not paid|not paid|yet to pay|on credit|unpaid|still (owe|owing)|has not)/i.test(msg);
    const desc = extractDescription(msg) || "Goods sold";
    if (amountsFound.length === 0) {
      return { ...base, intent: "sale", customer, description: desc, confidence: 0.6, needs_clarification: true, questions: ["How much was the sale?"] };
    }
    const amount = amountsFound[0];
    let paid: number | null = null;
    if (notPaid) paid = 0;
    else if (amountsFound.length >= 2) paid = amountsFound[1];
    else if (/\b(customer )?paid\b|\bfully paid\b|\bpaid in full\b|\bpaid complete/i.test(msg)) paid = amount;
    else if (customer) {
      // "Sold 5 dresses to Ada for 250k" — ambiguous whether paid
      return {
        ...base, intent: "sale", amount, customer, description: desc, confidence: 0.7,
        needs_clarification: true,
        questions: [`How much did ${customer} pay out of ₦${amount.toLocaleString()}? (Reply with the amount, "paid in full", or "not paid")`],
      };
    } else {
      // Cash sale without customer: assume paid
      paid = amount;
    }
    const owed = amount - (paid ?? 0);
    const status = paid === 0 ? "unpaid" : paid === amount ? "paid" : "partial";
    // Credit sale without customer — need customer
    if (!customer && status !== "paid") {
      return { ...base, intent: "sale", amount, amount_paid: paid, amount_owed: owed, description: desc, payment_status: status, confidence: 0.7, needs_clarification: true, questions: ["Who is the customer?"] };
    }
    return { ...base, intent: "sale", amount, amount_paid: paid, amount_owed: owed, customer, description: desc, payment_status: status, category: "Sales Revenue", confidence: customer ? 0.92 : 0.85 };
  }

  // ---- Fallback: generic money mention ----
  if (amounts.length > 0) {
    return {
      ...base, confidence: 0.35, needs_clarification: true,
      questions: ["I saw an amount but I'm not sure what happened. Was this a sale, an expense, a customer payment, or stock purchase?"],
    };
  }

  return {
    ...base, confidence: 0.2, needs_clarification: true,
    questions: ["Tell me what happened — for example: \"Sold 5 shirts to Ada for ₦250,000. She paid ₦150,000.\""],
  };
}

// AI abstraction: tries external AI if configured, else rule-based.
// Never throws — always falls back.
export async function interpretTransaction(message: string): Promise<InterpretResult> {
  const apiKey = process.env.AI_API_KEY;
  const apiUrl = process.env.AI_API_URL;
  if (apiKey && apiUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          message,
          instruction:
            "Parse this Nigerian SME business message into JSON: {intent, amount, amount_paid, customer, supplier, description, payment_status, category, confidence}. Never invent numbers. If amount missing, return null.",
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        // Validate AI output strictly
        if (data && typeof data === "object" && typeof data.intent === "string") {
          const allowed = ["sale", "expense", "customer_payment", "supplier_payment", "purchase", "owner_draw", "owner_capital", "other_income"];
          if (allowed.includes(data.intent)) {
            const amount = typeof data.amount === "number" && data.amount > 0 ? Math.round(data.amount) : null;
            const paid = typeof data.amount_paid === "number" && data.amount_paid >= 0 ? Math.round(data.amount_paid) : null;
            const result: InterpretResult = {
              intent: data.intent,
              amount,
              amount_paid: paid,
              amount_owed: amount != null && paid != null ? amount - paid : null,
              customer: typeof data.customer === "string" ? data.customer : null,
              supplier: typeof data.supplier === "string" ? data.supplier : null,
              description: typeof data.description === "string" ? data.description : message.slice(0, 120),
              payment_status: ["paid", "partial", "unpaid"].includes(data.payment_status) ? data.payment_status : null,
              category: typeof data.category === "string" ? data.category : null,
              expense_account_code: null,
              confidence: typeof data.confidence === "number" ? data.confidence : 0.7,
              needs_clarification: amount == null,
              questions: amount == null ? ["How much was involved in this transaction?"] : [],
              raw: message,
              source: "ai",
            };
            if (result.intent === "expense") {
              const { code, label } = detectExpenseCategory(message + " " + (result.category || ""));
              result.expense_account_code = code;
              result.category = result.category || label;
            }
            return result;
          }
        }
        // invalid AI output → fall through to rules
      }
    } catch {
      // fall through
    }
  }
  return interpretRuleBased(message);
}

export const QUICK_EXAMPLES = [
  "Sold 3 shoes for ₦150,000. Customer paid.",
  "Sold 5 dresses to Ada for 250k. She paid 150k.",
  "Emeka paid me 50k.",
  "Paid 20k for transport.",
  "Paid rent of 100k.",
  "Bought goods for 200k.",
  "Bought goods from ABC Supplies for 300k. I haven't paid.",
  "Paid my supplier 100k.",
  "John owes me 75k.",
  "I took 50k from the business.",
  "Put 200k into the business.",
  "How much do customers owe me?",
];
