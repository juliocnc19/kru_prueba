import { and, eq, isNull } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { db } from "@/db/client";
import { departments, memberships, users } from "@/db/schema";
import { requireHr } from "@/modules/identity/session";
import { EmployeeForm, MoveEmployeeForm } from "./forms";

export default async function EmployeesPage() {
  const actor = await requireHr();
  const allDepartments = await db.select().from(departments).where(and(eq(departments.companyId, actor.companyId), eq(departments.active, true)));
  const employees = await db.select({ id: memberships.id, name: users.name, cedula: memberships.cedula, departmentId: memberships.departmentId, department: departments.name }).from(memberships).innerJoin(users, eq(memberships.userId, users.id)).innerJoin(departments, eq(memberships.departmentId, departments.id)).where(and(eq(memberships.companyId, actor.companyId), eq(memberships.role, "employee"), isNull(memberships.endsAt))).orderBy(users.name);
  return <AppShell title="Colaboradores" subtitle="Mi empresa" links={[{ href: "/empresa", label: "Hoy" }, { href: "/empresa/marcajes", label: "Marcajes" }, { href: "/empresa/colaboradores", label: "Colaboradores" }, { href: "/empresa/departamentos", label: "Departamentos" }, { href: "/empresa/nomina", label: "Nómina y reportes" }]}><div className="grid gap-6 xl:grid-cols-[1fr_360px]"><section className="surface p-5 sm:p-7"><h2 className="text-xl font-bold">Equipo activo</h2><p className="muted mt-1 text-sm">{employees.length} colaboradores en la empresa</p><div className="mt-5 space-y-3">{employees.length ? employees.map((employee) => <article key={employee.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"><div><h3 className="font-bold">{employee.name}</h3><p className="muted text-sm">C.I. {employee.cedula} · {employee.department}</p></div><MoveEmployeeForm employeeId={employee.id} currentDepartmentId={employee.departmentId ?? ""} departments={allDepartments.map(({ id, name }) => ({ id, name }))}/></article>) : <p className="muted rounded-xl bg-slate-50 p-5">No hay colaboradores. Usa el formulario para agregar el primero.</p>}</div></section><section className="surface h-fit p-5 sm:p-7"><h2 className="text-xl font-bold">Agregar colaborador</h2><p className="muted mt-1 text-sm">Le entregarás su código de empresa, cédula y contraseña.</p><EmployeeForm departments={allDepartments.map(({ id, name }) => ({ id, name }))}/></section></div></AppShell>;
}
