"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { companies, memberships, users } from "@/db/schema";
import { createSession, destroySession } from "./session";
import { verifyPassword } from "./password";

export type LoginState = { error: string };

export async function loginAction(_previous: LoginState, data: FormData): Promise<LoginState> {
  const kind = String(data.get("kind") ?? "admin");
  const password = String(data.get("password") ?? "");
  let user: typeof users.$inferSelect | undefined;
  let role: "platform" | "hr" | "employee" | undefined;
  let pending = false;
  if (kind === "employee") {
    const code = String(data.get("companyCode") ?? "").trim().toLowerCase();
    const cedula = String(data.get("cedula") ?? "").trim();
    const rows = await db.select({ user: users, company: companies, membership: memberships }).from(memberships).innerJoin(users, eq(memberships.userId, users.id)).innerJoin(companies, eq(memberships.companyId, companies.id)).where(and(eq(companies.code, code), eq(memberships.cedula, cedula), eq(memberships.role, "employee"), isNull(memberships.endsAt))).limit(1);
    user = rows[0]?.user;
    if (rows[0]?.company.status === "active") role = "employee";
  } else {
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    if (user?.isPlatformOwner) role = "platform";
    else if (user) {
      const rows = await db.select({ company: companies }).from(memberships).innerJoin(companies, eq(memberships.companyId, companies.id)).where(and(eq(memberships.userId, user.id), eq(memberships.role, "hr"), isNull(memberships.endsAt))).limit(1);
      if (rows[0]?.company.status === "pending") pending = true;
      if (rows[0]?.company.status === "active") role = "hr";
    }
  }
  if (!user?.active || !password || !(await verifyPassword(password, user.passwordHash))) return { error: "Credenciales inválidas o cuenta inactiva." };
  if (pending) return { error: "Tu empresa aún espera aprobación." };
  if (!role) return { error: "Credenciales inválidas o cuenta inactiva." };
  await createSession(user.id);
  redirect(role === "platform" ? "/plataforma" : role === "hr" ? "/empresa" : "/marcar");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
