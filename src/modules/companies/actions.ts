"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { companies, departmentPolicyVersions, departments, memberships, sessions, users } from "@/db/schema";
import { requirePlatform } from "@/modules/identity/session";
import { hashPassword } from "@/modules/identity/password";
import { companyRegistrationSchema } from "./validation";

export type ActionState = { error: string; success?: string };

export async function registerCompanyAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const parsed = companyRegistrationSchema.safeParse({
    companyName: form.get("companyName"), code: form.get("code"), adminName: form.get("adminName"), email: form.get("email"), password: form.get("password"),
  });
  if (!parsed.success) return { error: "Revisa el nombre, código, correo y contraseña (mínimo 10 caracteres, mayúscula, minúscula y número)." };
  const input = parsed.data;
  try {
    const passwordHash = await hashPassword(input.password);
    await db.transaction(async (tx) => {
      const [admin] = await tx.insert(users).values({ name: input.adminName, email: input.email, passwordHash }).returning({ id: users.id });
      const [company] = await tx.insert(companies).values({ name: input.companyName, code: input.code }).returning({ id: companies.id });
      const [department] = await tx.insert(departments).values({ companyId: company!.id, name: "General" }).returning({ id: departments.id });
      await tx.insert(departmentPolicyVersions).values({ departmentId: department!.id, version: 1 });
      await tx.insert(memberships).values({ userId: admin!.id, companyId: company!.id, role: "hr" });
    });
    return { error: "", success: "Solicitud recibida. Podrás iniciar sesión cuando el dueño apruebe tu empresa." };
  } catch {
    return { error: "El código de empresa o el correo ya están registrados." };
  }
}

export async function approveCompanyAction(form: FormData): Promise<void> {
  const owner = await requirePlatform();
  const companyId = String(form.get("companyId") ?? "");
  await db.update(companies).set({ status: "active", approvedAt: new Date(), approvedBy: owner.userId }).where(and(eq(companies.id, companyId), eq(companies.status, "pending")));
  revalidatePath("/plataforma");
}

export async function changeCompanyStatusAction(form: FormData): Promise<void> {
  await requirePlatform();
  const companyId = String(form.get("companyId") ?? "");
  const status = String(form.get("status") ?? "");
  if (status !== "suspended" && status !== "active" && status !== "rejected") throw new Error("Estado inválido");
  await db.update(companies).set({ status }).where(eq(companies.id, companyId));
  revalidatePath("/plataforma");
}

export async function createHrAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  await requirePlatform();
  const companyId = String(form.get("companyId") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!name || !/^[^@]+@[^@]+\.[^@]+$/.test(email) || password.length < 10) return { error: "Nombre, correo y contraseña de 10 caracteres son obligatorios." };
  const company = (await db.select({ id: companies.id }).from(companies).where(eq(companies.id, companyId)).limit(1))[0];
  if (!company) return { error: "Empresa no encontrada." };
  try {
    const passwordHash = await hashPassword(password);
    await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ name, email, passwordHash }).returning({ id: users.id });
      await tx.insert(memberships).values({ userId: user!.id, companyId, role: "hr" });
    });
    revalidatePath("/plataforma");
    return { error: "", success: "Cuenta de RRHH creada." };
  } catch {
    return { error: "No se pudo crear la cuenta. Comprueba si el correo ya existe." };
  }
}

export async function changeHrStatusAction(form: FormData): Promise<void> {
  await requirePlatform();
  const membershipId = String(form.get("membershipId") ?? "");
  const activeValue = String(form.get("active") ?? "");
  if (activeValue !== "true" && activeValue !== "false") throw new Error("Estado inválido");
  const member = (await db.select({ userId: memberships.userId }).from(memberships).where(and(eq(memberships.id, membershipId), eq(memberships.role, "hr"))).limit(1))[0];
  if (!member) throw new Error("Cuenta de RRHH no encontrada");
  await db.transaction(async (tx) => {
    await tx.update(users).set({ active: activeValue === "true" }).where(eq(users.id, member.userId));
    if (activeValue === "false") await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, member.userId));
  });
  revalidatePath("/plataforma");
}
