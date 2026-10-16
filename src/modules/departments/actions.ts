"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { departmentPolicyVersions, departments } from "@/db/schema";
import { requireHr } from "@/modules/identity/session";
import { policySchema } from "@/modules/companies/validation";
import type { ActionState } from "@/modules/companies/actions";

export async function createDepartmentAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requireHr();
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 140) return { error: "El nombre debe tener entre 2 y 140 caracteres." };
  try {
    await db.transaction(async (tx) => {
      const [department] = await tx.insert(departments).values({ companyId: actor.companyId, name }).returning({ id: departments.id });
      await tx.insert(departmentPolicyVersions).values({ departmentId: department!.id, version: 1 });
    });
    revalidatePath("/empresa/departamentos");
    return { error: "", success: "Departamento creado." };
  } catch {
    return { error: "Ya existe un departamento con ese nombre." };
  }
}

export async function updatePolicyAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requireHr();
  const departmentId = String(form.get("departmentId") ?? "");
  const department = (await db.select({ id: departments.id }).from(departments).where(and(eq(departments.id, departmentId), eq(departments.companyId, actor.companyId))).limit(1))[0];
  if (!department) return { error: "Departamento no encontrado." };
  const required = form.get("geofenceRequired") === "on";
  const parsed = policySchema.safeParse({
    ordinaryMinutes: Number(form.get("ordinaryMinutes") ?? 480),
    nightStart: String(form.get("nightStart") ?? "19:00"), nightEnd: String(form.get("nightEnd") ?? "05:00"),
    weeklyOvertimeAlertMinutes: Number(form.get("weeklyOvertimeAlertMinutes") ?? 600),
    geofenceRequired: required,
    latitude: required && form.get("latitude") !== "" && form.get("latitude") !== null ? Number(form.get("latitude")) : null,
    longitude: required && form.get("longitude") !== "" && form.get("longitude") !== null ? Number(form.get("longitude")) : null,
    radiusMeters: required && form.get("radiusMeters") !== "" && form.get("radiusMeters") !== null ? Number(form.get("radiusMeters")) : null,
  });
  if (!parsed.success) return { error: "Configuración inválida: revisa horarios, coordenadas y radio." };
  const latest = (await db.select({ version: departmentPolicyVersions.version }).from(departmentPolicyVersions).where(eq(departmentPolicyVersions.departmentId, departmentId)).orderBy(desc(departmentPolicyVersions.version)).limit(1))[0];
  await db.insert(departmentPolicyVersions).values({ departmentId, version: (latest?.version ?? 0) + 1, ...parsed.data });
  revalidatePath("/empresa/departamentos");
  return { error: "", success: "Reglas actualizadas." };
}
