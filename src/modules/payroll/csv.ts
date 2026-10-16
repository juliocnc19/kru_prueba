export type CsvEmployeeRow = { cedula: string; name: string; overtimeDayHours: string; overtimeNightHours: string; nightShiftHours: string };
const HEADER = "cedula;nombre;periodo_desde;periodo_hasta;overtimeDayHours;overtimeNightHours;nightShiftHours";

function csvCell(value: string): string {
  const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function buildPayrollCsv(rows: CsvEmployeeRow[], from: string, to: string): string {
  return `${HEADER}\n${rows.map((row) => [row.cedula, row.name, from, to, row.overtimeDayHours, row.overtimeNightHours, row.nightShiftHours].map(csvCell).join(";")).join("\n")}${rows.length ? "\n" : ""}`;
}
