import { formatInTimeZone } from "date-fns-tz";
import { AppShell } from "@/components/app-shell";
import { getPayrollReport } from "@/modules/payroll/report";
import type { PeriodType } from "@/modules/payroll/period";
import { PayrollChart, PayrollTable, ReportControls } from "./widgets";

export const dynamic = "force-dynamic";

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ type?: string; date?: string; department?: string }> }) {
  const params = await searchParams;
  const type: PeriodType = params.type === "fortnight" ? "fortnight" : "week";
  const anchor = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : formatInTimeZone(new Date(), "America/Caracas", "yyyy-MM-dd");
  const report = await getPayrollReport(type, anchor, params.department || undefined);
  const totalHours = report.rows.reduce((sum, row) => sum + Number(row.totalHours), 0);
  const overtimeHours = report.rows.reduce((sum, row) => sum + Number(row.overtimeDayHours) + Number(row.overtimeNightHours), 0);
  const alertCount = report.rows.filter((row) => row.alertWeeks.length).length;
  const byDepartment = report.departmentHours;
  return <AppShell title="Nómina y reportes" subtitle="Mi empresa" links={[{ href: "/empresa", label: "Hoy" }, { href: "/empresa/marcajes", label: "Marcajes" }, { href: "/empresa/colaboradores", label: "Colaboradores" }, { href: "/empresa/departamentos", label: "Departamentos" }, { href: "/empresa/nomina", label: "Nómina y reportes" }]}><ReportControls type={type} anchor={anchor} departmentId={params.department ?? ""} departments={report.departments.map(({ id, name }) => ({ id, name }))}/><div className="mb-6 grid gap-4 sm:grid-cols-3"><div className="surface p-5"><p className="muted text-sm">Horas totales</p><p className="mt-2 text-3xl font-bold">{totalHours.toFixed(2)}</p></div><div className="surface p-5"><p className="muted text-sm">Horas extra</p><p className="mt-2 text-3xl font-bold text-blue-700">{overtimeHours.toFixed(2)}</p></div><div className="surface p-5"><p className="muted text-sm">Alertas semanales</p><p className="mt-2 text-3xl font-bold text-amber-700">{alertCount}</p></div></div><div className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]"><section className="surface p-5 sm:p-7"><h2 className="text-xl font-bold">Horas por departamento</h2><p className="muted mt-1 text-sm">Resumen visual del período</p><PayrollChart rows={byDepartment}/></section><section className="surface min-w-0 p-5 sm:p-7"><div className="mb-4"><h2 className="text-xl font-bold">Detalle para nómina</h2><p className="muted mt-1 text-sm">{report.from} al {report.to} · hora de Caracas</p></div><PayrollTable rows={report.rows}/></section></div></AppShell>;
}
