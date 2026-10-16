import { eq } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { AppShell } from "@/components/app-shell";
import { db } from "@/db/client";
import { companies } from "@/db/schema";
import { dailyOverview } from "@/modules/attendance/queries";
import { requireHr } from "@/modules/identity/session";
import { CorrectShiftForm } from "./shift-form";

export const dynamic = "force-dynamic";
const links = [{ href: "/empresa", label: "Hoy" }, { href: "/empresa/marcajes", label: "Marcajes" }, { href: "/empresa/colaboradores", label: "Colaboradores" }, { href: "/empresa/departamentos", label: "Departamentos" }, { href: "/empresa/nomina", label: "Nómina y reportes" }];
const badge: Record<string, string> = { dentro: "bg-emerald-100 text-emerald-800", "sin salida": "bg-amber-100 text-amber-800", "sin marcar": "bg-slate-100 text-slate-700", completado: "bg-blue-100 text-blue-800" };

export default async function CompanyDashboard() {
  const actor = await requireHr();
  const company = (await db.select({ name: companies.name }).from(companies).where(eq(companies.id, actor.companyId)).limit(1))[0];
  const people = await dailyOverview();
  const counts = { dentro: people.filter((person) => person.status === "dentro").length, "sin salida": people.filter((person) => person.status === "sin salida").length, "sin marcar": people.filter((person) => person.status === "sin marcar").length, completado: people.filter((person) => person.status === "completado").length };
  return <AppShell title="Resumen de hoy" subtitle={company?.name ?? "Mi empresa"} links={links}><div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">{Object.entries(counts).map(([label, value]) => <div key={label} className="surface p-5"><p className="muted text-sm capitalize">{label}</p><p className="mt-2 text-3xl font-extrabold">{value}</p></div>)}</div><section className="surface p-5 sm:p-7"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Estado del equipo</h2><p className="muted mt-1 text-sm">Sin marcar indica ausencia de registro, no una falta laboral.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Hora de Caracas</span></div>{people.length ? <div className="grid gap-3">{people.map((person) => <article key={person.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-bold">{person.name}</h3><p className="muted text-sm">{person.cedula} · {person.department}</p>{person.lastShift && <p className="mt-1 text-xs text-slate-500">Última entrada: {formatInTimeZone(person.lastShift.checkinAt, "America/Caracas", "dd/MM/yyyy HH:mm")}</p>}</div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${badge[person.status]}`}>{person.status}</span>{person.lastShift && <CorrectShiftForm shiftId={person.lastShift.id} checkin={formatInTimeZone(person.lastShift.checkinAt, "America/Caracas", "yyyy-MM-dd'T'HH:mm")} checkout={person.lastShift.checkoutAt ? formatInTimeZone(person.lastShift.checkoutAt, "America/Caracas", "yyyy-MM-dd'T'HH:mm") : ""}/>}</div></article>)}</div> : <p className="muted rounded-xl bg-slate-50 p-6">Aún no hay colaboradores. Agrégalos para comenzar.</p>}</section></AppShell>;
}
