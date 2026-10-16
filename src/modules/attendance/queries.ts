import "server-only";
import { and, desc, eq, gte, isNull, lt, or } from "drizzle-orm";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { db } from "@/db/client";
import { departmentPolicyVersions, departments, memberships, shifts, users } from "@/db/schema";
import { requireEmployee, requireHr } from "@/modules/identity/session";

const zone = "America/Caracas";

export async function employeeDashboard() {
  const actor = await requireEmployee();
  const member = (await db.select({ member: memberships, user: users, department: departments }).from(memberships).innerJoin(users, eq(memberships.userId, users.id)).innerJoin(departments, eq(memberships.departmentId, departments.id)).where(and(eq(memberships.id, actor.membershipId), eq(memberships.companyId, actor.companyId))).limit(1))[0];
  const recent = await db.select().from(shifts).where(and(eq(shifts.employeeMembershipId, actor.membershipId), eq(shifts.companyId, actor.companyId))).orderBy(desc(shifts.checkinAt)).limit(10);
  const policy = member ? (await db.select().from(departmentPolicyVersions).where(eq(departmentPolicyVersions.departmentId, member.department.id)).orderBy(desc(departmentPolicyVersions.version)).limit(1))[0] : undefined;
  return { member, recent, policy, open: recent.find((shift) => !shift.checkoutAt) ?? null };
}

export async function dailyOverview() {
  const actor = await requireHr();
  const today = formatInTimeZone(new Date(), zone, "yyyy-MM-dd");
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const start = fromZonedTime(`${today} 00:00:00`, zone);
  const end = fromZonedTime(`${tomorrow.toISOString().slice(0, 10)} 00:00:00`, zone);
  const people = await db.select({ id: memberships.id, name: users.name, cedula: memberships.cedula, department: departments.name }).from(memberships).innerJoin(users, eq(memberships.userId, users.id)).innerJoin(departments, eq(memberships.departmentId, departments.id)).where(and(eq(memberships.companyId, actor.companyId), eq(memberships.role, "employee"), isNull(memberships.endsAt), eq(users.active, true))).orderBy(users.name);
  const dayShifts = await db.select().from(shifts).where(and(eq(shifts.companyId, actor.companyId), or(gte(shifts.checkinAt, start), isNull(shifts.checkoutAt)), lt(shifts.checkinAt, end))).orderBy(desc(shifts.checkinAt));
  return people.map((person) => {
    const own = dayShifts.filter((shift) => shift.employeeMembershipId === person.id);
    const open = own.find((shift) => !shift.checkoutAt);
    const status = open ? (open.checkinAt < start ? "sin salida" : "dentro") : own.some((shift) => shift.checkinAt >= start && shift.checkoutAt) ? "completado" : "sin marcar";
    return { ...person, status, lastShift: own[0] ?? null };
  });
}

export async function shiftHistory(localDay: string) {
  const actor = await requireHr();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDay)) throw new Error("Fecha inválida");
  const tomorrow = new Date(`${localDay}T00:00:00Z`);
  if (!Number.isFinite(tomorrow.getTime()) || tomorrow.toISOString().slice(0, 10) !== localDay) throw new Error("Fecha inválida");
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const start = fromZonedTime(`${localDay} 00:00:00`, zone);
  const end = fromZonedTime(`${tomorrow.toISOString().slice(0, 10)} 00:00:00`, zone);
  return db.select({ shift: shifts, employeeName: users.name, cedula: memberships.cedula, departmentName: departments.name }).from(shifts).innerJoin(memberships, eq(shifts.employeeMembershipId, memberships.id)).innerJoin(users, eq(memberships.userId, users.id)).innerJoin(departments, eq(shifts.departmentId, departments.id)).where(and(eq(shifts.companyId, actor.companyId), gte(shifts.checkinAt, start), lt(shifts.checkinAt, end))).orderBy(desc(shifts.checkinAt));
}
