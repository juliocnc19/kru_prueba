"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { departments, memberships, users } from "@/db/schema";
import { employeeSchema } from "@/modules/companies/validation";
import type { ActionState } from "@/modules/companies/actions";
import { hashPassword } from "@/modules/identity/password";
import { requireHr } from "@/modules/identity/session";

export async function createEmployeeAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requireHr();
  const parsed = employeeSchema.safeParse({ name: form.get("name"), cedula: form.get("cedula"), departmentId: form.get("departmentId"), password: form.get("password") });
  if (!parsed.success) return { error: "Revisa nombre, cédula, departamento y contraseña." };
  const input = parsed.data;
  const department = (await db.select({ id: departments.id }).from(departments).where(and(eq(departments.id, input.departmentId), eq(departments.companyId, actor.companyId), eq(departments.active, true))).limit(1))[0];
  if (!department) return { error: "Departamento no válido para tu empresa." };
  try {
    const passwordHash = await hashPassword(input.password);
    await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ name: input.name, passwordHash }).returning({ id: users.id });
      await tx.insert(memberships).values({ userId: user!.id, companyId: actor.companyId, role: "employee", cedula: input.cedula.toUpperCase(), departmentId: input.departmentId });
    });
    revalidatePath("/empresa/colaboradores");
    return { error: "", success: "Colaborador creado." };
  } catch {
    return { error: "La cédula ya existe en esta empresa." };
  }
}

export async function moveEmployeeAction(form: FormData): Promise<void> {
  const actor = await requireHr();
  const employeeId = String(form.get("employeeId") ?? "");
  const departmentId = String(form.get("departmentId") ?? "");
  const department = (await db.select({ id: departments.id }).from(departments).where(and(eq(departments.id, departmentId), eq(departments.companyId, actor.companyId))).limit(1))[0];
  if (!department) throw new Error("Departamento no válido");
  await db.update(memberships).set({ departmentId }).where(and(eq(memberships.id, employeeId), eq(memberships.companyId, actor.companyId), eq(memberships.role, "employee")));
  revalidatePath("/empresa/colaboradores");
}
