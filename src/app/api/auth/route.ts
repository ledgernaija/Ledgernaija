import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, businesses, businessUsers } from "@/db/schema";
import { hashPassword, verifyPassword, createSession, destroySession, getSessionUser, getCurrentBusiness, validateEmail } from "@/lib/auth";
import { createDefaultAccounts, audit } from "@/lib/accounting";

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "me";
  if (action === "me") {
    const sess = await getSessionUser();
    if (!sess) return NextResponse.json({ user: null }, { status: 401 });
    const biz = await getCurrentBusiness(sess.user.id);
    return NextResponse.json({
      user: { id: sess.user.id, fullName: sess.user.fullName, email: sess.user.email, phone: sess.user.phone },
      business: biz?.business ?? null,
      role: biz?.role ?? null,
    });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");
  try {
    const body = await req.json().catch(() => ({}));

    if (action === "register") {
      const { fullName, email, phone, password, confirmPassword } = body;
      if (!fullName || !email || !password) return NextResponse.json({ error: "Full name, email and password are required." }, { status: 400 });
      if (!validateEmail(email)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
      if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
      if (password !== confirmPassword) return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
      const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
      if (existing.length > 0) return NextResponse.json({ error: "An account with this email already exists. Please log in." }, { status: 400 });
      const passwordHash = await hashPassword(password);
      const inserted = await db.insert(users).values({
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        passwordHash,
      }).returning({ id: users.id });
      const userId = inserted[0].id;
      await audit(userId, null, "User registered", "user", userId, null, { email });
      await createSession(userId, true);
      return NextResponse.json({ ok: true, userId });
    }

    if (action === "login") {
      const { email, password, remember } = body;
      if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
      const rows = await db.select().from(users).where(eq(users.email, String(email).toLowerCase().trim())).limit(1);
      if (rows.length === 0) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      const user = rows[0];
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      if (user.status !== "active") return NextResponse.json({ error: "This account has been suspended." }, { status: 403 });
      await createSession(user.id, remember !== false);
      const biz = await getCurrentBusiness(user.id);
      return NextResponse.json({ ok: true, hasBusiness: !!biz });
    }

    if (action === "logout") {
      await destroySession();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("auth error", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
