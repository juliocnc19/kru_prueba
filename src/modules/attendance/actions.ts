"use server";

import { and, desc, eq, gt, isNull, lt, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";
import { db } from "@/db/client";
import { departmentPolicyVersions, memberships, shiftCorrections, shifts } from "@/db/schema";
import { requireEmployee, requireHr } from "@/modules/identity/session";
import { type LocationReading, validateLocation } from "./geofence";

export type ClockState = { error: string; success?: string };
const minuteNow = () => new Date(Math.floor(Date.now() / 60_000) * 60_000);

function locationError(reason?: string): string {
  if (reason === "missing") return "Activa la ubicación para marcar en este departamento.";
  if (reason === "stale") return "La ubicación es antigua. Vuelve a obtenerla.";
  if (reason === "accuracy") return "La ubicación no es suficientemente precisa. Acércate y reintenta.";
  if (reason === "outside") return "No te encuentras dentro del radio permitido del departamento.";
  return "No se pudo validar la ubicación.";
}

export async function clockInAction(reading: LocationReading | null): Promise<ClockState> {
  const actor = await requireEmployee();
  const member = (await db.select().from(memberships).where(and(eq(memberships.id, actor.membershipId), eq(memberships.companyId, actor.companyId))).limit(1))[0];
  if (!member?.departmentId) return { error: "No tienes un departamento activo." };
  const policy = (await db.select().from(departmentPolicyVersions).where(eq(departmentPolicyVersions.departmentId, member.departmentId)).orderBy(desc(departmentPolicyVersions.version)).limit(1))[0];
  if (!policy) return { error: "El departamento no tiene reglas configuradas." };
  const now = minuteNow();
  const location = validateLocation({ required: policy.geofenceRequired, latitude: policy.latitude ?? 0, longitude: policy.longitude ?? 0, radiusMeters: policy.radiusMeters as 20 | 30 | 40 | null }, reading, new Date());
  if (!location.allowed) return { error: locationError(location.reason) };
  try {
    await db.insert(shifts).values({ employeeMembershipId: actor.membershipId, companyId: actor.companyId, departmentId: member.departmentId, policyVersionId: policy.id, checkinAt: now, checkinLocation: location.distanceMeters === null ? null : { distanceMeters: location.distanceMeters, accuracyMeters: location.accuracyMeters! } });
    revalidatePath("/marcar");
    return { error: "", success: "Entrada registrada." };
  } catch (error) {
    const cause = typeof error === "object" && error !== null && "cause" in error ? error.cause : error;
    if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505") return { error: "Ya tienes una entrada abierta. Actualiza la página." };
    throw error;
  }
}

export async function clockOutAction(reading: LocationReading | null): Promise<ClockState> {
  const actor = await requireEmployee();
  const open = (await db.select({ shift: shifts, policy: departmentPolicyVersions }).from(shifts).innerJoin(departmentPolicyVersions, eq(shifts.policyVersionId, departmentPolicyVersions.id)).where(and(eq(shifts.employeeMembershipId, actor.membershipId), eq(shifts.companyId, actor.companyId), isNull(shifts.checkoutAt))).limit(1))[0];
  if (!open) return { error: "No tienes una entrada pendiente de salida." };
  const now = minuteNow();
  if (now <= open.shift.checkinAt) return { error: "Espera al siguiente minuto para registrar la salida." };
  const policy = open.policy;
  const location = validateLocation({ required: policy.geofenceRequired, latitude: policy.latitude ?? 0, longitude: policy.longitude ?? 0, radiusMeters: policy.radiusMeters as 20 | 30 | 40 | null }, reading, new Date());
  if (!location.allowed) return { error: locationError(location.reason) };
  const updated = await db.update(shifts).set({ checkoutAt: now, checkoutLocation: location.distanceMeters === null ? null : { distanceMeters: location.distanceMeters, accuracyMeters: location.accuracyMeters! } }).where(and(eq(shifts.id, open.shift.id), eq(shifts.companyId, actor.companyId), isNull(shifts.checkoutAt))).returning({ id: shifts.id });
  if (!updated.length) return { error: "La salida ya fue registrada. Actualiza la página." };
  revalidatePath("/marcar");
  return { error: "", success: "Salida registrada." };
}

export async function correctShiftAction(_previous: ClockState, form: FormData): Promise<ClockState> {
  const actor = await requireHr();
  const shiftId = String(form.get("shiftId") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  const checkinLocal = String(form.get("checkinAt") ?? "");
  const checkoutLocal = String(form.get("checkoutAt") ?? "");
  const checkinAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(checkinLocal) ? fromZonedTime(checkinLocal, "America/Caracas") : new Date(NaN);
  const checkoutAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(checkoutLocal) ? fromZonedTime(checkoutLocal, "America/Caracas") : new Date(NaN);
  if (!reason) return { error: "El motivo de la corrección es obligatorio." };
  if (!Number.isFinite(checkinAt.getTime()) || !Number.isFinite(checkoutAt.getTime()) || checkoutAt <= checkinAt) return { error: "La salida debe ser posterior a la entrada." };
  if (checkinAt.getTime() % 60_000 || checkoutAt.getTime() % 60_000) return { error: "Indica horarios con precisión de minutos." };
  const original = (await db.select().from(shifts).where(and(eq(shifts.id, shiftId), eq(shifts.companyId, actor.companyId))).limit(1))[0];
  if (!original) return { error: "Marcaje no encontrado." };
  const overlaps = await db.select({ id: shifts.id }).from(shifts).where(and(eq(shifts.employeeMembershipId, original.employeeMembershipId), eq(shifts.companyId, actor.companyId), ne(shifts.id, shiftId), lt(shifts.checkinAt, checkoutAt), or(isNull(shifts.checkoutAt), gt(shifts.checkoutAt, checkinAt)))).limit(1);
  if (overlaps.length) return { error: "El horario se solapa con otro turno." };
  await db.transaction(async (tx) => {
    await tx.update(shifts).set({ checkinAt, checkoutAt }).where(and(eq(shifts.id, shiftId), eq(shifts.companyId, actor.companyId)));
    await tx.insert(shiftCorrections).values({ shiftId, actorMembershipId: actor.membershipId, reason, beforeCheckinAt: original.checkinAt, beforeCheckoutAt: original.checkoutAt, afterCheckinAt: checkinAt, afterCheckoutAt: checkoutAt });
  });
  revalidatePath("/empresa");
  revalidatePath("/empresa/marcajes");
  revalidatePath("/empresa/nomina");
  return { error: "", success: "Marcaje corregido y auditado." };
}
