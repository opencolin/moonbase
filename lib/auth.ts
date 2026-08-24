import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { ensurePersonalOrganization } from "@/lib/organizations";

const COOKIE = "luma_session";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(userId: string) {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + THIRTY_DAYS);
  await db.insert(sessions).values({ id: token, userId, expiresAt });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, token));
  jar.delete(COOKIE);
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const row = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, token))
    .get();

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, token));
    return null;
  }
  return row.user;
}

/**
 * Find-or-create a user by email (magic-link style, no password).
 *
 * This is the single funnel for user creation, so it's also where the
 * personal org is guaranteed. `ensurePersonalOrganization` is idempotent,
 * so existing users created before orgs existed get one on next sign-in.
 */
export async function findOrCreateUser(email: string, name?: string) {
  const normalized = email.trim().toLowerCase();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .get();
  if (existing) {
    await ensurePersonalOrganization(existing);
    return existing;
  }

  const fallbackName =
    name?.trim() ||
    normalized
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());

  const [created] = await db
    .insert(users)
    .values({ email: normalized, name: fallbackName })
    .returning();
  await ensurePersonalOrganization(created);
  return created;
}
