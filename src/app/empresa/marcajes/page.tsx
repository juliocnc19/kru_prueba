import { formatInTimeZone } from "date-fns-tz";
import { AppShell } from "@/components/app-shell";
import { shiftHistory } from "@/modules/attendance/queries";
import { CorrectShiftForm } from "../shift-form";

export const dynamic = "force-dynamic";

export default async function ShiftHistoryPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const day = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : formatInTimeZone(new Date(), "America/Caracas", "yyyy-MM-dd");
  const rows = await shiftHistory(day);
  return <AppShell title="Historial de marcajes" subtitle="Mi empresa" links={[{ href: "/empresa", label: "Hoy" }, { href: "/empresa/marcajes", label: "Marcajes" }, { href: "/empresa/colaboradores", label: "Colaboradores" }, { href: "/empresa/departamentos", label: "Departamentos" }, { href: "/empresa/nomina", label: "Nómina y reportes" }]}><div className="surface p-5 sm:p-7"><form className="mb-6 flex flex-wrap items-end gap-3" method="get"><label><span className="label">Día de entrada · Caracas</span><input className="field" name="date" type="date" defaultValue={day} required/></label><button className="button-secondary" type="submit">Ver marcajes</button></form>{rows.length ? <div className="grid gap-3">{rows.map(({ shift, employeeName, cedula, departmentName }) => <article key={shift.id} className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 p-4 md:flex-row md:items-start"><div><h2 className="font-bold">{employeeName}</h2><p className="muted text-sm">{cedula} · {departmentName}</p><p className="mt-2 text-sm">Entrada: {formatInTimeZone(shift.checkinAt, "America/Caracas", "dd/MM/yyyy HH:mm")}</p><p className="text-sm">Salida: {shift.checkoutAt ? formatInTimeZone(shift.checkoutAt, "America/Caracas", "dd/MM/yyyy HH:mm") : "Pendiente"}</p></div><CorrectShiftForm shiftId={shift.id} checkin={formatInTimeZone(shift.checkinAt, "America/Caracas", "yyyy-MM-dd'T'HH:mm")} checkout={shift.checkoutAt ? formatInTimeZone(shift.checkoutAt, "America/Caracas", "yyyy-MM-dd'T'HH:mm") : ""}/></article>)}</div> : <p className="muted rounded-xl bg-slate-50 p-6">No hay marcajes cuya entrada sea de este día.</p>}</div></AppShell>;
}
