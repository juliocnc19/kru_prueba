import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lte } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { companies, memberships, sessions, users } from "@/db/schema";
import { type Actor, canAccessEmployee, canManageCompany, canManagePlatform } from "./authorization";
import { issueToken, readToken } from "./token";

const COOKIE_NAME = "kru_session";
const DAYS_30 = 30 * 24 * 60 * 60;
const hashSid = (sid: string) => createHash("sha256").update(sid).digest("hex");

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET no configurada correctamente");
  if (process.env.APP_ENV === "production" && value.startsWith("kru-local-only")) throw new Error("No se permite el secreto local en producción");
  return value;
}

export async function createSession(userId: string): Promise<void> {
  const sid = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DAYS_30 * 1000);
  await db.insert(sessions).values({ sidHash: hashSid(sid), userId, expiresAt });
  const token = await issueToken(sid, secret(), now);
  (await cookies()).set(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", secure: process.env.APP_ENV === "production", path: "/", maxAge: DAYS_30 });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    const sid = await readToken(token, secret());
    if (sid) await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.sidHash, hashSid(sid)));
  }
  cookieStore.delete(COOKIE_NAME);
}

export async function getActor(): Promise<Actor | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const sid = await readToken(token, secret());
  if (!sid) return null;
  const rows = await db.select({ session: sessions, user: users }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(and(eq(sessions.sidHash, hashSid(sid)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()), eq(users.active, true))).limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.user.isPlatformOwner) return { userId: row.user.id, role: "platform", companyId: null, membershipId: null };
  const activeMemberships = await db.select({ membership: memberships }).from(memberships).innerJoin(companies, eq(memberships.companyId, companies.id)).where(and(eq(memberships.userId, row.user.id), lte(memberships.startsAt, new Date()), isNull(memberships.endsAt), eq(companies.status, "active"))).limit(1);
  const membership = activeMemberships[0]?.membership;
  if (!membership) return null;
  return { userId: row.user.id, role: membership.role, companyId: membership.companyId, membershipId: membership.id };
}

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
}

export async function requirePlatform(): Promise<Actor> {
  const actor = await requireActor();
  if (!canManagePlatform(actor)) redirect("/sin-permiso");
  return actor;
}

export async function requireHr(): Promise<Actor & { companyId: string; membershipId: string }> {
  const actor = await requireActor();
  if (!actor.companyId || !actor.membershipId || !canManageCompany(actor, actor.companyId)) redirect("/sin-permiso");
  return actor as Actor & { companyId: string; membershipId: string };
}

export async function requireEmployee(): Promise<Actor & { companyId: string; membershipId: string }> {
  const actor = await requireActor();
  if (!actor.companyId || !actor.membershipId || !canAccessEmployee(actor, actor.membershipId)) redirect("/sin-permiso");
  return actor as Actor & { companyId: string; membershipId: string };
}
