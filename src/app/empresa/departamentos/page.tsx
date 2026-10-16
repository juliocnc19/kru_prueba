import { and, desc, eq } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { db } from "@/db/client";
import { departmentPolicyVersions, departments } from "@/db/schema";
import { requireHr } from "@/modules/identity/session";
import { CreateDepartmentForm, PolicyForm } from "./forms";

export default async function DepartmentsPage() {
  const actor = await requireHr();
  const items = await db.select().from(departments).where(eq(departments.companyId, actor.companyId)).orderBy(departments.name);
  const versions = await db.select().from(departmentPolicyVersions).innerJoin(departments, and(eq(departmentPolicyVersions.departmentId, departments.id), eq(departments.companyId, actor.companyId))).orderBy(desc(departmentPolicyVersions.version));
  const latest = new Map<string, typeof departmentPolicyVersions.$inferSelect>();
  for (const version of versions) if (!latest.has(version.department_policy_versions.departmentId)) latest.set(version.department_policy_versions.departmentId, version.department_policy_versions);
  return <AppShell title="Departamentos" subtitle="Mi empresa" links={[{ href: "/empresa", label: "Hoy" }, { href: "/empresa/marcajes", label: "Marcajes" }, { href: "/empresa/colaboradores", label: "Colaboradores" }, { href: "/empresa/departamentos", label: "Departamentos" }, { href: "/empresa/nomina", label: "Nómina y reportes" }]}><div className="grid gap-6 xl:grid-cols-[1fr_330px]"><div className="space-y-5">{items.map((department) => <section key={department.id} className="surface p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-bold">{department.name}</h2><p className="muted text-sm">Versión {latest.get(department.id)?.version ?? 1} · {latest.get(department.id)?.geofenceRequired ? "Ubicación requerida" : "Marcaje remoto permitido"}</p></div></div><PolicyForm departmentId={department.id} policy={latest.get(department.id)!}/></section>)}</div><section className="surface h-fit p-5 sm:p-7"><h2 className="text-lg font-bold">Nuevo departamento</h2><p className="muted mt-1 text-sm">Para empresas pequeñas, General es suficiente.</p><CreateDepartmentForm/></section></div></AppShell>;
}
