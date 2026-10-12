import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, businesses, businessUsers, sessions } from "@/db/schema";

const SESSION_COOKIE = "sme_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: number, remember = true): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const days = remember ? SESSION_DAYS : 1;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ userId, token, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: days * 24 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });
  return token;
}

export async function destroySession(): Promise<void> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) {
      await db.delete(sessions).where(eq(sessions.token, token));
    }
    jar.delete(SESSION_COOKIE);
  } catch {
    // ignore
  }
}

export async function getSessionToken(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const token = await getSessionToken();
  if (!token) return null;
  const rows = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1);
  if (rows.length === 0) return null;
  const sess = rows[0];
  if (new Date(sess.expiresAt) < new Date()) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return null;
  }
  const urows = await db.select().from(users).where(eq(users.id, sess.userId)).limit(1);
  if (urows.length === 0) return null;
  const user = urows[0];
  if (user.status !== "active") return null;
  return { user, session: sess };
}

export async function getCurrentBusiness(userId: number) {
  const links = await db
    .select()
    .from(businessUsers)
    .where(eq(businessUsers.userId, userId));
  if (links.length === 0) return null;
  const bizId = links[0].businessId;
  const brows = await db.select().from(businesses).where(eq(businesses.id, bizId)).limit(1);
  if (brows.length === 0) return null;
  return { business: brows[0], role: links[0].role, memberships: links };
}

export async function requireAuth() {
  const sess = await getSessionUser();
  if (!sess) return { user: null, business: null, role: null } as const;
  const biz = await getCurrentBusiness(sess.user.id);
  return {
    user: sess.user,
    session: sess.session,
    business: biz?.business ?? null,
    role: biz?.role ?? null,
  } as const;
}

export async function verifyBusinessAccess(userId: number, businessId: number): Promise<boolean> {
  const rows = await db
    .select()
    .from(businessUsers)
    .where(and(eq(businessUsers.userId, userId), eq(businessUsers.businessId, businessId)))
    .limit(1);
  return rows.length > 0;
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
