import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { hashPassword } from "@/modules/identity/password";

jest.mock("server-only", () => ({}));
const mockCookies = jest.fn();
const mockRedirect = jest.fn((path: string) => { throw new Error(`REDIRECT:${path}`); });
jest.mock("next/headers", () => ({ cookies: mockCookies }));
jest.mock("next/navigation", () => ({ redirect: mockRedirect }));

const integration = process.env.DATABASE_URL ? describe : describe.skip;

integration("server sessions and login", () => {
  const owner = randomUUID();
  const hr = randomUUID();
  const employee = randomUUID();
  const company = randomUUID();
  const department = randomUUID();
  const hrMembership = randomUUID();
  const employeeMembership = randomUUID();
  const suffix = owner.slice(0, 8);
  const cookies = new Map<string, string>();
  const cookieStore = { get: (name: string) => cookies.has(name) ? { value: cookies.get(name)! } : undefined, set: (name: string, value: string) => { cookies.set(name, value); }, delete: (name: string) => { cookies.delete(name); } };
  let client: Client;

  beforeAll(async () => {
    process.env.SESSION_SECRET = "integration-secret-with-more-than-thirty-two-characters";
    process.env.APP_ENV = "local";
    mockCookies.mockResolvedValue(cookieStore);
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const passwordHash = await hashPassword("Demo12345!");
    await client.query("INSERT INTO users(id,name,email,password_hash,is_platform_owner) VALUES ($1,'Owner',$4,$6,true),($2,'HR',$5,$6,false),($3,'Employee',NULL,$6,false)", [owner, hr, employee, `owner-${suffix}@example.test`, `hr-${suffix}@example.test`, passwordHash]);
    await client.query("INSERT INTO companies(id,name,code,status) VALUES ($1,'Identity Company',$2,'pending')", [company, `identity-${suffix}`]);
    await client.query("INSERT INTO departments(id,company_id,name) VALUES ($1,$2,'General')", [department, company]);
    await client.query("INSERT INTO memberships(id,user_id,company_id,role) VALUES ($1,$2,$3,'hr')", [hrMembership, hr, company]);
    await client.query("INSERT INTO memberships(id,user_id,company_id,role,cedula,department_id) VALUES ($1,$2,$3,'employee','66778899',$4)", [employeeMembership, employee, company, department]);
  });

  afterAll(async () => {
    await client?.query("DELETE FROM sessions WHERE user_id IN ($1,$2,$3)", [owner, hr, employee]);
    await client?.query("DELETE FROM memberships WHERE company_id=$1", [company]);
    await client?.query("DELETE FROM departments WHERE id=$1", [department]);
    await client?.query("DELETE FROM companies WHERE id=$1", [company]);
    await client?.query("DELETE FROM users WHERE id IN ($1,$2,$3)", [owner, hr, employee]);
    await client?.end();
    const { pool } = await import("@/db/client");
    await pool.end();
    cookies.clear();
  });

  it("does not reveal a pending company before checking the password", async () => {
    const { loginAction } = await import("@/modules/identity/actions");
    const form = new FormData();
    form.set("kind", "admin");
    form.set("email", `hr-${suffix}@example.test`);
    form.set("password", "Incorrecta123!");
    expect(await loginAction({ error: "" }, form)).toMatchObject({ error: "Credenciales inválidas o cuenta inactiva." });
    form.set("password", "Demo12345!");
    expect(await loginAction({ error: "" }, form)).toMatchObject({ error: "Tu empresa aún espera aprobación." });
    await client.query("UPDATE companies SET status='active' WHERE id=$1", [company]);
    await expect(loginAction({ error: "" }, form)).rejects.toThrow("REDIRECT:/empresa");
  });

  it("loads current HR permissions from the database and honors suspension", async () => {
    const { getActor, requireHr, requirePlatform } = await import("@/modules/identity/session");
    expect(await getActor()).toMatchObject({ role: "hr", companyId: company, membershipId: hrMembership });
    expect(await requireHr()).toMatchObject({ role: "hr", companyId: company });
    await expect(requirePlatform()).rejects.toThrow("REDIRECT:/sin-permiso");
    await client.query("UPDATE memberships SET starts_at=now()+interval '1 day' WHERE id=$1", [hrMembership]);
    expect(await getActor()).toBeNull();
    await client.query("UPDATE memberships SET starts_at=now()-interval '1 day' WHERE id=$1", [hrMembership]);
    await client.query("UPDATE companies SET status='suspended' WHERE id=$1", [company]);
    expect(await getActor()).toBeNull();
    await client.query("UPDATE companies SET status='active' WHERE id=$1", [company]);
  });

  it("keeps the owner outside company data, and employee login uses company plus cédula", async () => {
    const { loginAction } = await import("@/modules/identity/actions");
    const { getActor, requireEmployee, requireHr } = await import("@/modules/identity/session");
    const ownerForm = new FormData();
    ownerForm.set("email", `owner-${suffix}@example.test`);
    ownerForm.set("password", "Demo12345!");
    await expect(loginAction({ error: "" }, ownerForm)).rejects.toThrow("REDIRECT:/plataforma");
    expect(await getActor()).toMatchObject({ role: "platform", companyId: null });
    await expect(requireHr()).rejects.toThrow("REDIRECT:/sin-permiso");
    const employeeForm = new FormData();
    employeeForm.set("kind", "employee");
    employeeForm.set("companyCode", `identity-${suffix}`);
    employeeForm.set("cedula", "66778899");
    employeeForm.set("password", "Demo12345!");
    await expect(loginAction({ error: "" }, employeeForm)).rejects.toThrow("REDIRECT:/marcar");
    expect(await requireEmployee()).toMatchObject({ role: "employee", membershipId: employeeMembership });
  });

  it("revokes the cookie session on logout and rejects expired database sessions", async () => {
    const { createSession, destroySession, getActor } = await import("@/modules/identity/session");
    await createSession(hr);
    expect(await getActor()).toMatchObject({ role: "hr" });
    await destroySession();
    expect(cookies.has("kru_session")).toBe(false);
    expect(await getActor()).toBeNull();
    await createSession(hr);
    await client.query("UPDATE sessions SET expires_at=now()-interval '1 day' WHERE user_id=$1", [hr]);
    expect(await getActor()).toBeNull();
  });
});
