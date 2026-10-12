# SME FINANCE V0.5 — Your Business Accountant on WhatsApp

**Live prototype for Nigerian small-business owners.**
Record sales, expenses, customer debts and business finances in plain language — no accounting knowledge needed.

> Prototype for user testing. **Not a bank, lender, credit bureau, or financial institution.**

---

## 1. What this is

SME Finance V0.5 is a working bookkeeping prototype:

- Type plain language like **"Sold 3 shoes to Emeka for ₦150,000. He paid ₦100,000."**
- The app understands: Sale ₦150,000 · Paid ₦100,000 · Outstanding ₦50,000 · Customer Emeka
- You **confirm** before anything is posted
- Deterministic double-entry accounting creates **balanced journal entries** (debits = credits)
- Reports: Dashboard, P&L, Balance Sheet, Trial Balance, Ledger, Journal, Receivables, Payables, Audit Log

**Technology in this live build:** Next.js (App Router) + PostgreSQL + Drizzle ORM + Tailwind.
The accounting logic, database design, and assistant workflow are identical to the PHP/MySQL spec and can be ported 1:1 to shared hosting (see `database/` and section 9).

---

## 2. Quick start (this environment)

```bash
npm install
# .env already contains DATABASE_URL
npx drizzle-kit push
npm run build
npm start
```

Open `http://localhost:3000` → **Start Free** → create account → create business → record your first transaction in the Assistant.

To load demo data, tick **"Load example data"** on the business setup screen:
Business *Blessing Fashion Hub* · Customers Emeka, Ada, Chinedu · Suppliers ABC Fashion Supplies, Lagos Garments Ltd.

---

## 3. User journey (test this)

1. Landing page → **Start Free**
2. Register (name, email, phone, password)
3. Create business (name, type, category, city, state)
4. Dashboard → **Assistant** → type: `Sold 5 dresses to Ada for 250k. She paid 150k.`
5. Review confirmation (accounting preview) → **Confirm & Post**
6. Check Ledger, Customer balance, P&L, Balance Sheet
7. Record payment: `Emeka paid me 50k`
8. Record expense: `Paid 20k for transport`
9. Record purchase: `Bought goods from ABC Supplies for 300k. I haven't paid`
10. Pay supplier, owner withdrawal (`I took 50k from the business`)
11. Void a transaction → check reversing entry in Journal + Audit Log
12. Log out → log back in → data still there

---

## 4. Natural-language tests (Assistant)

| Say | Expected |
|---|---|
| `Sold 3 shoes for ₦150,000. Customer paid.` | Cash sale, paid |
| `Sold 5 dresses to Ada for 250k. She paid 150k.` | Sale 250k, paid 150k, owed 100k |
| `Emeka paid me 50k.` | Customer payment 50k |
| `Paid 20k for transport.` | Transportation expense 20k |
| `Paid rent of 100k.` | Rent expense 100k |
| `Bought goods for 200k.` | Asks: paid or on credit? (never guesses) |
| `Bought goods from ABC Supplies for 300k. I haven't paid.` | Purchase 300k, unpaid |
| `Paid my supplier 100k.` | Asks which supplier |
| `John owes me 75k.` | Credit sale 75k to John |
| `I took 50k from the business.` | Owner drawings (NOT expense) |
| `Put 200k into the business.` | Owner capital |
| `How much do customers owe me?` | Receivables answer |
| `What is my profit?` | P&L answer |

**Safety rule:** if an amount or party is missing, the app **asks** — it never invents figures.

---

## 5. Accounting engine (deterministic, never AI)

All posting goes through `src/lib/accounting.ts`:

- `postSale` — cash sale (DR Cash / CR Sales) or credit (DR AR / CR Sales) + payment leg (DR Cash / CR AR)
- `postCustomerPayment` — DR Cash / CR Accounts Receivable
- `postExpense` — DR Expense / CR Cash
- `postPurchase` — DR Inventory / CR Accounts Payable (+ payment leg if part-paid)
- `postSupplierPayment` — DR AP / CR Cash
- `postOwnerWithdrawal` — DR Owner Drawings / CR Cash (never an expense)
- `postOwnerCapital` — DR Cash / CR Owner Capital
- `voidTransaction` — creates **reversing journal entries**, marks `voided`, writes audit log
- `calculateTrialBalance` / `calculateProfitAndLoss` / `calculateBalanceSheet`
- Every journal entry validated: **SUM(debit) MUST = SUM(credit)**, else rejected.

Chart of accounts (auto-created per business): 1000 Cash, 1010 Bank, 1100 AR, 1200 Inventory, 2000 AP, 3000 Capital, 3100 Drawings, 3200 Retained, 4000 Sales, 4100 Other Income, 5000 COGS, 6000–6080 Expenses.

---

## 6. Project structure

```
src/
  app/
    page.tsx                  Landing page
    login/ register/ setup/   Auth + business setup
    (app)/                    Authenticated shell (sidebar, mobile nav)
      dashboard/ assistant/ sales/ expenses/
      customers/ suppliers/ transactions/ journal/
      accounts/ reports/ audit/ settings/
    api/
      auth/ business/ customers/ suppliers/
      transactions/ accounts/ journal/ dashboard/
      assistant/ reports/ audit/ backup/ health/
  db/ schema.ts index.ts      Drizzle schema + client
  lib/
    auth.ts                   sessions, password hashing, business access checks
    accounting.ts             deterministic posting + reports
    assistant.ts              interpretTransaction() + rule-based fallback
    utils.ts                  ₦ formatting
database/
  database.sql                Full schema (PostgreSQL; MySQL port notes inside)
  seed.sql                    Demo data (Blessing Fashion Hub)
```

---

## 7. Security

- Passwords hashed with bcrypt (`bcryptjs`), never plain text
- Session tokens in HttpOnly cookies, stored hashed-by-random in `sessions`
- Every business query filtered by `business_id` + membership check (`verifyBusinessAccess`)
- Changing IDs in URLs cannot leak another business's data
- Prepared statements via Drizzle everywhere; no raw string SQL with user input
- Friendly error messages; technical errors logged server-side only
- AI key (optional) lives in `AI_API_KEY` server env — never sent to browser

---

## 8. AI integration (abstraction layer)

`src/lib/assistant.ts` → `interpretTransaction(message)`:

1. If `AI_API_KEY` + `AI_API_URL` are set, it tries the AI endpoint (8s timeout) and **strictly validates** the JSON (allowed intents, positive numbers only).
2. On any failure/invalid output, it falls back to the built-in **rule-based parser** — the app always works offline.
3. If the result is incomplete (no amount, ambiguous payment), the UI **asks a question** instead of posting.
4. Posting always requires explicit **Confirm & Post**.

To enable AI later: set `AI_API_KEY` and `AI_API_URL` (endpoint accepting `{message, instruction}` returning `{intent, amount, amount_paid, customer, supplier, description, payment_status, category, confidence}`).

WhatsApp-ready: every transaction stores `source` (`assistant`/`manual`/`web`/`whatsapp`/`voice`/`receipt`). The accounting engine ignores source — future WhatsApp messages flow through the same `interpret → confirm → post` pipeline.

---

## 9. Shared-hosting / PHP port notes

This live build runs on Next.js + PostgreSQL for the prototype environment. The spec's PHP/MySQL target maps 1:1:

| Spec (PHP) | This build | Port |
|---|---|---|
| `includes/config.php` | `.env` (`DATABASE_URL`) | Copy values to `config.php` constants |
| `includes/database.php` (PDO) | `src/db/index.ts` (Drizzle) | Replace with PDO + prepared statements |
| `includes/auth.php` | `src/lib/auth.ts` | `password_hash`/`password_verify` + `$_SESSION` |
| `includes/accounting.php` | `src/lib/accounting.ts` | Same functions, same journal rules |
| `includes/ai.php` | `src/lib/assistant.ts` | Same `interpretTransaction()` contract |
| `database/database.sql` | `database/database.sql` + Drizzle | Import to MySQL (INT→INT, SERIAL→AUTO_INCREMENT, TIMESTAMP→DATETIME) |
| Pages `*.php` | `src/app/(app)/*/page.tsx` | Same screens, same fields |

`database/database.sql` is written to be easily convertible: each table lists MySQL equivalents in comments.

---

## 10. Common issues

- **"Not logged in"** → session expired; log in again.
- **Database connection error** → check `DATABASE_URL` in `.env`; ensure Postgres is running; re-run `npx drizzle-kit push`.
- **Trial Balance out of balance** → should never happen; every post is validated. Check Journal for the offending entry and void it.
- **Assistant asks instead of posting** → that's by design when info is missing. Answer the question (e.g. "paid in full" / amount).
- **Can't see another user's data** → correct. Business isolation is enforced on every query.

---

## 11. Test checklist (accounting)

- [ ] Cash sale ₦100,000 → Cash +100k, Sales +100k
- [ ] Credit sale ₦100,000 → AR +100k, Sales +100k
- [ ] Customer pays ₦40,000 → Cash +40k, AR −40k
- [ ] Expense ₦20,000 → Expense +20k, Cash −20k
- [ ] Credit purchase ₦200,000 → Inventory +200k, AP +200k
- [ ] Supplier payment ₦50,000 → AP −50k, Cash −50k
- [ ] Owner withdrawal ₦30,000 → Drawings +30k, Cash −30k (not expense)
- [ ] Every journal entry balanced
- [ ] User A cannot access User B's business
- [ ] Logout → login → data persists

---

*SME Finance V0.5 — built for testing with real Nigerian small businesses. Simple, trustworthy, mobile-first.*
