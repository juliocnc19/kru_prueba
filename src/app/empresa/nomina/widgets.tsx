"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { barY, defineChart } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { Chart } from "@tanstack/charts/react";
import { Download } from "lucide-react";
import { exportPayrollAction } from "@/modules/payroll/actions";
import type { PeriodType } from "@/modules/payroll/period";
import type { ReportRow } from "@/modules/payroll/report";

export function ReportControls({ type, anchor, departmentId, departments }: { type: PeriodType; anchor: string; departmentId: string; departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [downloadError, setDownloadError] = useState("");
  const onDownload = () => startTransition(async () => {
    setDownloadError("");
    try {
      const result = await exportPayrollAction(type, anchor, departmentId || undefined);
      const url = URL.createObjectURL(new Blob([result.content], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = result.filename; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch { setDownloadError("No se pudo generar el CSV. Reintenta."); }
  });
  return <div className="surface mb-6 p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-end"><form className="grid flex-1 gap-3 sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); router.push(`/empresa/nomina?${new URLSearchParams({ type: String(data.get("type")), date: String(data.get("date")), department: String(data.get("department")) })}`); }}><label><span className="label">Período</span><select className="field" name="type" defaultValue={type}><option value="week">Semana</option><option value="fortnight">Quincena</option></select></label><label><span className="label">Fecha de referencia</span><input className="field" name="date" type="date" defaultValue={anchor} required/></label><label><span className="label">Departamento</span><select className="field" name="department" defaultValue={departmentId}><option value="">Todos</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><button className="button-secondary sm:col-span-3 lg:w-fit" type="submit">Aplicar filtros</button></form><button type="button" onClick={onDownload} disabled={pending} className="button-primary lg:mb-0"><Download size={17}/> {pending ? "Generando…" : "Exportar CSV"}</button></div>{downloadError && <p role="alert" className="mt-3 text-sm text-rose-700">{downloadError}</p>}</div>;
}

export function PayrollChart({ rows }: { rows: { department: string; hours: number }[] }) {
  const chart = useMemo(() => defineChart({ marks: [barY(rows, { x: "department", y: "hours", fill: "#2f6ed3" })], scales: { x: { scale: () => scaleBand<string>().padding(0.2) }, y: { scale: scaleLinear, nice: true, grid: true } } }), [rows]);
  if (!rows.length) return <p className="muted mt-8 text-sm">No hay datos para graficar.</p>;
  return <div className="mt-5 min-w-0"><Chart definition={chart} height={260} ariaLabel="Horas trabajadas por departamento"/></div>;
}

export function PayrollTable({ rows }: { rows: ReportRow[] }) {
  if (!rows.length) return <p className="muted rounded-xl bg-slate-50 p-5 text-sm">No hay colaboradores para este período.</p>;
  return <><div className="space-y-3 md:hidden">{rows.map((row) => <article key={row.employeeId} className="rounded-xl border border-slate-200 p-4"><div className="mb-2 flex items-start justify-between gap-2"><div><h3 className="font-bold">{row.name}</h3><p className="muted text-xs">{row.cedula} · {row.department}</p></div><strong>{row.totalHours} h</strong></div><div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center text-xs"><span>Extra día<br/><strong>{row.overtimeDayHours}</strong></span><span>Extra noche<br/><strong>{row.overtimeNightHours}</strong></span><span>Noche normal<br/><strong>{row.nightShiftHours}</strong></span></div>{row.alertWeeks.length > 0 && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs font-bold text-amber-800">Alerta: más de 10 h extra en la semana {row.alertWeeks.join(", ")}</p>}</article>)}</div><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="py-3 pr-3">Colaborador</th><th className="px-2">Total</th><th className="px-2">Extra día</th><th className="px-2">Extra noche</th><th className="px-2">Noche normal</th></tr></thead><tbody>{rows.map((row) => <tr key={row.employeeId} className="border-b border-slate-100"><td className="py-3 pr-3"><strong>{row.name}</strong><p className="muted text-xs">{row.cedula} · {row.department}</p>{row.alertWeeks.length > 0 && <p className="text-xs font-bold text-amber-700">Alerta semanal: {row.alertWeeks.join(", ")}</p>}</td><td className="px-2">{row.totalHours}</td><td className="px-2">{row.overtimeDayHours}</td><td className="px-2">{row.overtimeNightHours}</td><td className="px-2">{row.nightShiftHours}</td></tr>)}</tbody></table></div></>;
}
