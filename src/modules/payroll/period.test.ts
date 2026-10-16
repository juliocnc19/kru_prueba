import { periodBounds, weekEnvelope } from "./period";
import { buildPayrollCsv } from "./csv";

describe("payroll periods and export", () => {
  it("selects the Caracas Monday–Sunday week", () => {
    expect(periodBounds("week", "2026-10-08")).toEqual({ from: "2026-10-05", to: "2026-10-11" });
  });

  it("selects the second half of a short month", () => {
    expect(periodBounds("fortnight", "2027-02-18")).toEqual({ from: "2027-02-16", to: "2027-02-28" });
  });

  it("rejects invalid dates and period names", () => {
    expect(() => periodBounds("week", "2026-02-30")).toThrow("Fecha inválida");
    expect(() => periodBounds("month" as never, "2026-10-01")).toThrow("Tipo de período inválido");
  });

  it("extends a quincena to full weeks for the overtime alert", () => {
    expect(weekEnvelope("2026-10-01", "2026-10-15")).toEqual({ from: "2026-09-28", to: "2026-10-18" });
  });

  it("exports exactly the required header and escapes a semicolon in a name", () => {
    expect(buildPayrollCsv([{ cedula: "12345678", name: "Ana; Pérez", overtimeDayHours: "2.00", overtimeNightHours: "2.50", nightShiftHours: "3.00" }], "2026-10-05", "2026-10-11")).toBe("cedula;nombre;periodo_desde;periodo_hasta;overtimeDayHours;overtimeNightHours;nightShiftHours\n12345678;\"Ana; Pérez\";2026-10-05;2026-10-11;2.00;2.50;3.00\n");
  });

  it("neutralizes spreadsheet formulas in CSV text cells", () => {
    expect(buildPayrollCsv([{ cedula: "=1+1", name: "-malicious", overtimeDayHours: "0.00", overtimeNightHours: "0.00", nightShiftHours: "0.00" }], "2026-10-05", "2026-10-11")).toContain("'=1+1;'-malicious;");
  });
});
