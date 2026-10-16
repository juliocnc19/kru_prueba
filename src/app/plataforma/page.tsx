import { and, desc, eq } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { db } from "@/db/client";
import { companies, memberships, users } from "@/db/schema";
import { requirePlatform } from "@/modules/identity/session";
import { PlatformCompanies } from "./table";

export default async function PlatformPage() {
  await requirePlatform();
  const rows = await db.select({ company: companies, hrName: users.name, hrEmail: users.email }).from(companies).leftJoin(memberships, and(eq(memberships.companyId, companies.id), eq(memberships.role, "hr"))).leftJoin(users, eq(users.id, memberships.userId)).orderBy(desc(companies.createdAt));
  const byId = new Map<string, { id: string; name: string; code: string; status: "pending" | "active" | "rejected" | "suspended"; createdAt: string; admins: string[] }>();
  for (const row of rows) {
    const item = byId.get(row.company.id) ?? { id: row.company.id, name: row.company.name, code: row.company.code, status: row.company.status, createdAt: row.company.createdAt.toISOString().slice(0, 10), admins: [] };
    if (row.hrEmail) item.admins.push(`${row.hrName} · ${row.hrEmail}`);
    byId.set(item.id, item);
  }
  const companiesList = [...byId.values()];
  const pending = companiesList.filter((company) => company.status === "pending").length;
  return <AppShell title="Empresas" subtitle="Administración de plataforma" links={[{ href: "/plataforma", label: "Empresas y solicitudes" }]}><div className="mb-7 grid gap-4 sm:grid-cols-3"><div className="surface p-5"><p className="muted text-sm">Empresas registradas</p><p className="mt-2 text-3xl font-bold">{companiesList.length}</p></div><div className="surface p-5"><p className="muted text-sm">Pendientes de aprobar</p><p className="mt-2 text-3xl font-bold text-amber-700">{pending}</p></div><div className="surface p-5"><p className="muted text-sm">Empresas activas</p><p className="mt-2 text-3xl font-bold text-emerald-700">{companiesList.filter((company) => company.status === "active").length}</p></div></div><div className="surface p-5 sm:p-7"><div className="mb-5"><h2 className="text-xl font-bold">Solicitudes y cuentas RRHH</h2><p className="muted mt-1 text-sm">Gestiona el acceso de cada empresa. Los marcajes son privados para RRHH.</p></div><PlatformCompanies rows={companiesList}/></div></AppShell>;
}
