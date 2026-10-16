import { aggregatePeriod, calculateShift, type PayrollPolicy } from "./calculate";

const policy: PayrollPolicy = { ordinaryMinutes: 480, nightStart: "19:00", nightEnd: "05:00", weeklyOvertimeAlertMinutes: 600 };
const utc = (value: string) => new Date(value);

describe("Caracas payroll calculation", () => {
  it("classifies the 06:00–16:00 example as two daytime overtime hours", () => {
    expect(calculateShift(utc("2026-10-05T10:00:00Z"), utc("2026-10-05T20:00:00Z"), policy)).toEqual({ totalMinutes: 600, overtimeDayMinutes: 120, overtimeNightMinutes: 0, nightShiftMinutes: 0 });
  });

  it("classifies the 14:00–00:30 example as 2.5 nighttime overtime and 3 ordinary night hours", () => {
    expect(calculateShift(utc("2026-10-06T18:00:00Z"), utc("2026-10-07T04:30:00Z"), policy)).toEqual({ totalMinutes: 630, overtimeDayMinutes: 0, overtimeNightMinutes: 150, nightShiftMinutes: 180 });
  });

  it("assigns an overnight shift to its start day and rounds only after aggregating", () => {
    const rows = aggregatePeriod([
      { employeeId: "ana", startsAt: utc("2026-10-05T22:00:00Z"), endsAt: utc("2026-10-06T06:01:00Z"), policy },
      { employeeId: "ana", startsAt: utc("2026-10-06T22:00:00Z"), endsAt: utc("2026-10-07T06:01:00Z"), policy },
    ], "2026-10-05", "2026-10-11");
    expect(rows).toEqual([{ employeeId: "ana", totalHours: "16.03", overtimeDayHours: "0.00", overtimeNightHours: "0.03", nightShiftHours: "14.00", overtimeMinutes: 2, alertWeeks: [] }]);
  });

  it("alerts only when weekly overtime exceeds 600 minutes", () => {
    const atLimit = aggregatePeriod([{ employeeId: "a", startsAt: utc("2026-10-05T10:00:00Z"), endsAt: utc("2026-10-06T04:00:00Z"), policy }], "2026-10-05", "2026-10-11");
    expect(atLimit[0]?.alertWeeks).toEqual([]);
    const over = aggregatePeriod([{ employeeId: "a", startsAt: utc("2026-10-05T10:00:00Z"), endsAt: utc("2026-10-06T04:01:00Z"), policy }], "2026-10-05", "2026-10-11");
    expect(over[0]?.alertWeeks).toEqual(["2026-10-05"]);
  });

  it("rejects a shift whose end is not after its start", () => {
    expect(() => calculateShift(utc("2026-10-05T10:00:00Z"), utc("2026-10-05T10:00:00Z"), policy)).toThrow("La salida debe ser posterior");
  });
});
