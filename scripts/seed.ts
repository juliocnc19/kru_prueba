import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { hashPassword } from "../src/modules/identity/password";
import { companies, departmentPolicyVersions, departments, memberships, shifts, users } from "../src/db/schema";

const url = process.env.DATABASE_URL ?? "postgresql://kru:kru@localhost:5433/kru_marcaje";
const pool = new Pool({ connectionString: url });
const db = drizzle({ client: pool });

async function main() {
  const local = process.env.APP_ENV !== "production";
  const demo = local || process.env.SEED_DEMO === "true";
  const email = process.env.PLATFORM_ADMIN_EMAIL ?? (local ? "owner@kru.demo" : undefined);
  const password = process.env.PLATFORM_ADMIN_PASSWORD ?? (local ? "Demo12345!" : undefined);
  if (!email || !password) throw new Error("PLATFORM_ADMIN_EMAIL y PLATFORM_ADMIN_PASSWORD son obligatorios para la semilla de producción");
  let owner = (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0];
  if (!owner) {
    owner = (await db.insert(users).values({ name: "Dueño de la plataforma", email, passwordHash: await hashPassword(password), isPlatformOwner: true }).returning({ id: users.id }))[0];
  }
  if (!demo) {
    console.log("Cuenta de plataforma lista");
    return;
  }
  const demoPassword = process.env.DEMO_PASSWORD ?? (local ? "Demo12345!" : undefined);
  if (!demoPassword) throw new Error("DEMO_PASSWORD es obligatoria al habilitar la semilla de demostración en producción");
  for (const fixture of [
    { code: "empresa-a", name: "Empresa A", hrEmail: "rrhh@empresa-a.demo", hrName: "RRHH Empresa A", employee: true },
    { code: "empresa-b", name: "Empresa B", hrEmail: "rrhh@empresa-b.demo", hrName: "RRHH Empresa B", employee: false },
  ]) {
    const exists = (await db.select({ id: companies.id }).from(companies).where(eq(companies.code, fixture.code)).limit(1))[0];
    if (exists) continue;
    await db.transaction(async (tx) => {
      const [company] = await tx.insert(companies).values({ code: fixture.code, name: fixture.name, status: "active", approvedBy: owner!.id, approvedAt: new Date() }).returning({ id: companies.id });
      const [department] = await tx.insert(departments).values({ companyId: company!.id, name: "General" }).returning({ id: departments.id });
      const [policy] = await tx.insert(departmentPolicyVersions).values({ departmentId: department!.id, version: 1 }).returning({ id: departmentPolicyVersions.id });
      const [hr] = await tx.insert(users).values({ name: fixture.hrName, email: fixture.hrEmail, passwordHash: await hashPassword(demoPassword) }).returning({ id: users.id });
      await tx.insert(memberships).values({ userId: hr!.id, companyId: company!.id, role: "hr" });
      if (fixture.employee) {
        const [employee] = await tx.insert(users).values({ name: "Ana Pérez", passwordHash: await hashPassword(demoPassword) }).returning({ id: users.id });
        const [membership] = await tx.insert(memberships).values({ userId: employee!.id, companyId: company!.id, departmentId: department!.id, role: "employee", cedula: "12345678", startsAt: new Date("2026-10-01T04:00:00Z") }).returning({ id: memberships.id });
        await tx.insert(shifts).values({ employeeMembershipId: membership!.id, companyId: company!.id, departmentId: department!.id, policyVersionId: policy!.id, checkinAt: new Date("2026-10-05T10:00:00Z"), checkoutAt: new Date("2026-10-05T20:00:00Z") });
      }
    });
  }
  console.log("Datos de demostración listos");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await pool.end(); });
