import "server-only";
import { and, eq, gte, isNotNull, isNull, lt, or } from "drizzle-orm";
import { fromZonedTime } from "date-fns-tz";
import { db } from "@/db/client";
import { departmentPolicyVersions, departments, memberships, shifts, users } from "@/db/schema";
import { requireHr } from "@/modules/identity/session";
import { aggregatePeriod, calculateShift, type PeriodShift } from "./calculate";
import { periodBounds, weekEnvelope, type PeriodType } from "./period";
import { buildPayrollCsv } from "./csv";

const ZONE = "America/Caracas";
export type ReportRow = { employeeId: string; cedula: string; name: string; departmentId: string; department: string; totalHours: string; overtimeDayHours: string; overtimeNightHours: string; nightShiftHours: string; overtimeMinutes: number; alertWeeks: string[] };

export async function getPayrollReport(type: PeriodType, anchor: string, departmentId?: string) {
  const actor = await requireHr();
  const { from, to } = periodBounds(type, anchor);
  const after = new Date(`${to}T00:00:00Z`);
  after.setUTCDate(after.getUTCDate() + 1);
  const startsAt = fromZonedTime(`${from} 00:00:00`, ZONE);
  const endsAt = fromZonedTime(`${after.toISOString().slice(0, 10)} 00:00:00`, ZONE);
  const alertEnvelope = weekEnvelope(from, to);
  const alertAfter = new Date(`${alertEnvelope.to}T00:00:00Z`);
  alertAfter.setUTCDate(alertAfter.getUTCDate() + 1);
  const alertStartsAt = fromZonedTime(`${alertEnvelope.from} 00:00:00`, ZONE);
  const alertEndsAt = fromZonedTime(`${alertAfter.toISOString().slice(0, 10)} 00:00:00`, ZONE);
  const allDepartments = await db.select().from(departments).where(eq(departments.companyId, actor.companyId));
  if (departmentId && !allDepartments.some((department) => department.id === departmentId)) throw new Error("Departamento no válido");
  const employees = await db.select({ membership: memberships, user: users, department: departments }).from(memberships).innerJoin(users, eq(memberships.userId, users.id)).innerJoin(departments, eq(memberships.departmentId, departments.id)).where(and(eq(memberships.companyId, actor.companyId), eq(memberships.role, "employee"), lt(memberships.startsAt, endsAt), or(isNull(memberships.endsAt), gte(memberships.endsAt, startsAt))));
  const records = await db.select({ shift: shifts, policy: departmentPolicyVersions }).from(shifts).innerJoin(departmentPolicyVersions, eq(shifts.policyVersionId, departmentPolicyVersions.id)).where(and(eq(shifts.companyId, actor.companyId), gte(shifts.checkinAt, startsAt), lt(shifts.checkinAt, endsAt), isNotNull(shifts.checkoutAt), ...(departmentId ? [eq(shifts.departmentId, departmentId)] : [])));
  const periodShifts: PeriodShift[] = records.map(({ shift, policy }) => ({ employeeId: shift.employeeMembershipId, startsAt: shift.checkinAt, endsAt: shift.checkoutAt!, policy: { ordinaryMinutes: policy.ordinaryMinutes, nightStart: policy.nightStart, nightEnd: policy.nightEnd, weeklyOvertimeAlertMinutes: policy.weeklyOvertimeAlertMinutes } }));
  const departmentMinutes = new Map<string, number>();
  for (const { shift, policy } of records) {
    const minutes = calculateShift(shift.checkinAt, shift.checkoutAt!, policy).totalMinutes;
    departmentMinutes.set(shift.departmentId, (departmentMinutes.get(shift.departmentId) ?? 0) + minutes);
  }
  const calculated = new Map(aggregatePeriod(periodShifts, from, to).map((row) => [row.employeeId, row]));
  const alertRecords = await db.select({ shift: shifts, policy: departmentPolicyVersions }).from(shifts).innerJoin(departmentPolicyVersions, eq(shifts.policyVersionId, departmentPolicyVersions.id)).where(and(eq(shifts.companyId, actor.companyId), gte(shifts.checkinAt, alertStartsAt), lt(shifts.checkinAt, alertEndsAt), isNotNull(shifts.checkoutAt)));
  const alertShifts: PeriodShift[] = alertRecords.map(({ shift, policy }) => ({ employeeId: shift.employeeMembershipId, startsAt: shift.checkinAt, endsAt: shift.checkoutAt!, policy: { ordinaryMinutes: policy.ordinaryMinutes, nightStart: policy.nightStart, nightEnd: policy.nightEnd, weeklyOvertimeAlertMinutes: policy.weeklyOvertimeAlertMinutes } }));
  const alerts = new Map(aggregatePeriod(alertShifts, alertEnvelope.from, alertEnvelope.to).map((row) => [row.employeeId, row.alertWeeks]));
  const rows: ReportRow[] = employees.filter(({ membership }) => !departmentId || membership.departmentId === departmentId || calculated.has(membership.id)).map(({ membership, user, department }) => {
    const total = calculated.get(membership.id);
    return { employeeId: membership.id, cedula: membership.cedula ?? "", name: user.name, departmentId: department.id, department: department.name, totalHours: total?.totalHours ?? "0.00", overtimeDayHours: total?.overtimeDayHours ?? "0.00", overtimeNightHours: total?.overtimeNightHours ?? "0.00", nightShiftHours: total?.nightShiftHours ?? "0.00", overtimeMinutes: total?.overtimeMinutes ?? 0, alertWeeks: alerts.get(membership.id) ?? [] };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { from, to, type, rows, departments: allDepartments, departmentHours: allDepartments.map(({ id, name }) => ({ department: name, hours: Number(((departmentMinutes.get(id) ?? 0) / 60).toFixed(2)) })), csv: buildPayrollCsv(rows, from, to) };
}
