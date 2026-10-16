import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const ZONE = "America/Caracas";
export type PayrollPolicy = { ordinaryMinutes: number; nightStart: string; nightEnd: string; weeklyOvertimeAlertMinutes: number };
export type ShiftTotals = { totalMinutes: number; overtimeDayMinutes: number; overtimeNightMinutes: number; nightShiftMinutes: number };
export type PeriodShift = { employeeId: string; startsAt: Date; endsAt: Date; policy: PayrollPolicy };
export type PeriodRow = { employeeId: string; totalHours: string; overtimeDayHours: string; overtimeNightHours: string; nightShiftHours: string; overtimeMinutes: number; alertWeeks: string[] };

function localDate(date: Date): string {
  return formatInTimeZone(date, ZONE, "yyyy-MM-dd");
}

function addLocalDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isNight(date: Date, policy: PayrollPolicy): boolean {
  const time = formatInTimeZone(date, ZONE, "HH:mm");
  return policy.nightStart > policy.nightEnd
    ? time >= policy.nightStart || time < policy.nightEnd
    : time >= policy.nightStart && time < policy.nightEnd;
}

function mondayOf(day: string): string {
  const dayOfWeek = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addLocalDays(day, -((dayOfWeek + 6) % 7));
}

export function calculateShift(startsAt: Date, endsAt: Date, policy: PayrollPolicy): ShiftTotals {
  const start = startsAt.getTime();
  const end = endsAt.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("La salida debe ser posterior a la entrada");
  if (start % 60_000 !== 0 || end % 60_000 !== 0) throw new Error("Los marcajes deben tener precisión de minutos");
  const ordinaryCutoff = Math.min(start + policy.ordinaryMinutes * 60_000, end);
  const boundaries = new Set<number>([start, ordinaryCutoff, end]);
  for (let day = addLocalDays(localDate(startsAt), -1); day <= addLocalDays(localDate(endsAt), 1); day = addLocalDays(day, 1)) {
    for (const time of [policy.nightStart, policy.nightEnd]) {
      const value = fromZonedTime(`${day} ${time}:00`, ZONE).getTime();
      if (value > start && value < end) boundaries.add(value);
    }
  }
  const points = [...boundaries].sort((a, b) => a - b);
  const totals: ShiftTotals = { totalMinutes: (end - start) / 60_000, overtimeDayMinutes: 0, overtimeNightMinutes: 0, nightShiftMinutes: 0 };
  for (let index = 0; index < points.length - 1; index++) {
    const segmentStart = points[index]!;
    const segmentEnd = points[index + 1]!;
    const minutes = (segmentEnd - segmentStart) / 60_000;
    const night = isNight(new Date((segmentStart + segmentEnd) / 2), policy);
    if (segmentStart >= ordinaryCutoff) {
      if (night) totals.overtimeNightMinutes += minutes;
      else totals.overtimeDayMinutes += minutes;
    } else if (night) totals.nightShiftMinutes += minutes;
  }
  return totals;
}

const hours = (minutes: number) => (minutes / 60).toFixed(2);

export function aggregatePeriod(shifts: PeriodShift[], from: string, to: string): PeriodRow[] {
  if (from > to) throw new Error("Período inválido");
  const byEmployee = new Map<string, { total: number; overtimeDay: number; overtimeNight: number; nightShift: number; weekExtra: Map<string, number>; threshold: number }>();
  for (const shift of shifts) {
    const day = localDate(shift.startsAt);
    if (day < from || day > to) continue;
    const value = calculateShift(shift.startsAt, shift.endsAt, shift.policy);
    const row = byEmployee.get(shift.employeeId) ?? { total: 0, overtimeDay: 0, overtimeNight: 0, nightShift: 0, weekExtra: new Map<string, number>(), threshold: shift.policy.weeklyOvertimeAlertMinutes };
    row.total += value.totalMinutes;
    row.overtimeDay += value.overtimeDayMinutes;
    row.overtimeNight += value.overtimeNightMinutes;
    row.nightShift += value.nightShiftMinutes;
    const week = mondayOf(day);
    row.weekExtra.set(week, (row.weekExtra.get(week) ?? 0) + value.overtimeDayMinutes + value.overtimeNightMinutes);
    byEmployee.set(shift.employeeId, row);
  }
  return [...byEmployee.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([employeeId, row]) => ({
    employeeId,
    totalHours: hours(row.total),
    overtimeDayHours: hours(row.overtimeDay),
    overtimeNightHours: hours(row.overtimeNight),
    nightShiftHours: hours(row.nightShift),
    overtimeMinutes: row.overtimeDay + row.overtimeNight,
    alertWeeks: [...row.weekExtra.entries()].filter(([, extra]) => extra > row.threshold).map(([week]) => week).sort(),
  }));
}
