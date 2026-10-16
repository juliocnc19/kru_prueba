import { randomUUID } from "node:crypto";
import { Client } from "pg";

jest.mock("server-only", () => ({}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireHr = jest.fn();
const mockRequirePlatform = jest.fn();
jest.mock("@/modules/identity/session", () => ({ requireHr: mockRequireHr, requirePlatform: mockRequirePlatform }));

const integration = process.env.DATABASE_URL ? describe : describe.skip;

integration("company, department and employee actions", () => {
  const suffix = randomUUID().slice(0, 8);
  const owner = randomUUID();
  const companyName = `Acción ${suffix}`;
  const companyCode = `accion-${suffix}`;
  let companyId: string;
  let generalId: string;
  let secondId: string;
  let employeeId: string;
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query("INSERT INTO users(id,name,email,password_hash,is_platform_owner) VALUES ($1,'Owner',$2,'hash',true)", [owner, `owner-${suffix}@example.test`]);
    mockRequirePlatform.mockResolvedValue({ userId: owner, role: "platform", companyId: null, membershipId: null });
  });

  afterAll(async () => {
    if (companyId) {
      const users = await client.query("SELECT user_id FROM memberships WHERE company_id=$1", [companyId]);
      await client.query("DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM memberships WHERE company_id=$1)", [companyId]);
      await client.query("DELETE FROM shift_corrections WHERE shift_id IN (SELECT id FROM shifts WHERE company_id=$1)", [companyId]);
      await client.query("DELETE FROM shifts WHERE company_id=$1", [companyId]);
      await client.query("DELETE FROM memberships WHERE company_id=$1", [companyId]);
      await client.query("DELETE FROM department_policy_versions WHERE department_id IN (SELECT id FROM departments WHERE company_id=$1)", [companyId]);
      await client.query("DELETE FROM departments WHERE company_id=$1", [companyId]);
      await client.query("DELETE FROM companies WHERE id=$1", [companyId]);
      for (const row of users.rows) await client.query("DELETE FROM users WHERE id=$1", [row.user_id]);
    }
    await client?.query("DELETE FROM users WHERE id=$1", [owner]);
    await client?.end();
    const { pool } = await import("@/db/client");
    await pool.end();
  });

  it("registers a pending company with a General department and requires owner approval", async () => {
    const { registerCompanyAction, approveCompanyAction } = await import("@/modules/companies/actions");
    const form = new FormData();
    form.set("companyName", companyName);
    form.set("code", companyCode);
    form.set("adminName", "Administración inicial");
    form.set("email", `hr-${suffix}@example.test`);
    form.set("password", "Demo12345!");
    expect(await registerCompanyAction({ error: "" }, form)).toMatchObject({ success: expect.stringContaining("Solicitud recibida") });
    expect(await registerCompanyAction({ error: "" }, form)).toMatchObject({ error: expect.stringContaining("registrados") });
    const company = (await client.query("SELECT id,status FROM companies WHERE code=$1", [companyCode])).rows[0];
    companyId = company.id;
    expect(company.status).toBe("pending");
    const general = (await client.query("SELECT id FROM departments WHERE company_id=$1 AND name='General'", [companyId])).rows[0];
    generalId = general.id;
    const approval = new FormData();
    approval.set("companyId", companyId);
    await approveCompanyAction(approval);
    expect((await client.query("SELECT status,approved_by FROM companies WHERE id=$1", [companyId])).rows[0]).toMatchObject({ status: "active", approved_by: owner });
    const hr = (await client.query("SELECT id FROM memberships WHERE company_id=$1 AND role='hr'", [companyId])).rows[0];
    mockRequireHr.mockResolvedValue({ userId: randomUUID(), role: "hr", companyId, membershipId: hr.id });
  });

  it("creates versioned department policies and rejects missing geofence coordinates", async () => {
    const { createDepartmentAction, updatePolicyAction } = await import("@/modules/departments/actions");
    const create = new FormData();
    create.set("name", "Operaciones");
    expect(await createDepartmentAction({ error: "" }, create)).toMatchObject({ success: "Departamento creado." });
    secondId = (await client.query("SELECT id FROM departments WHERE company_id=$1 AND name='Operaciones'", [companyId])).rows[0].id;
    const policy = new FormData();
    policy.set("departmentId", secondId);
    policy.set("geofenceRequired", "on");
    expect(await updatePolicyAction({ error: "" }, policy)).toMatchObject({ error: expect.stringContaining("inválida") });
    policy.set("latitude", "10.5");
    policy.set("longitude", "-66.9");
    policy.set("radiusMeters", "30");
    expect(await updatePolicyAction({ error: "" }, policy)).toMatchObject({ success: "Reglas actualizadas." });
    expect((await client.query("SELECT version,geofence_required,radius_meters FROM department_policy_versions WHERE department_id=$1 ORDER BY version", [secondId])).rows).toEqual([
      expect.objectContaining({ version: 1, geofence_required: false }),
      expect.objectContaining({ version: 2, geofence_required: true, radius_meters: 30 }),
    ]);
  });

  it("scopes employee creation and department moves to HR's company", async () => {
    const { createEmployeeAction, moveEmployeeAction } = await import("@/modules/employees/actions");
    const create = new FormData();
    create.set("name", "Colaborador de prueba");
    create.set("cedula", "77889900");
    create.set("password", "Demo12345!");
    create.set("departmentId", randomUUID());
    expect(await createEmployeeAction({ error: "" }, create)).toMatchObject({ error: "Departamento no válido para tu empresa." });
    create.set("departmentId", generalId);
    expect(await createEmployeeAction({ error: "" }, create)).toMatchObject({ success: "Colaborador creado." });
    expect(await createEmployeeAction({ error: "" }, create)).toMatchObject({ error: expect.stringContaining("cédula") });
    employeeId = (await client.query("SELECT id FROM memberships WHERE company_id=$1 AND cedula='77889900'", [companyId])).rows[0].id;
    const move = new FormData();
    move.set("employeeId", employeeId);
    move.set("departmentId", randomUUID());
    await expect(moveEmployeeAction(move)).rejects.toThrow("Departamento no válido");
    move.set("departmentId", secondId);
    await moveEmployeeAction(move);
    expect((await client.query("SELECT department_id FROM memberships WHERE id=$1", [employeeId])).rows[0].department_id).toBe(secondId);
  });

  it("lets only the platform workflow add HR accounts and suspend or reactivate a company", async () => {
    const { createHrAction, changeCompanyStatusAction, changeHrStatusAction } = await import("@/modules/companies/actions");
    const form = new FormData();
    form.set("companyId", companyId);
    form.set("name", "Segundo administrador");
    form.set("email", `hr2-${suffix}@example.test`);
    form.set("password", "Demo12345!");
    expect(await createHrAction({ error: "" }, form)).toMatchObject({ success: "Cuenta de RRHH creada." });
    expect(await createHrAction({ error: "" }, form)).toMatchObject({ error: expect.stringContaining("correo") });
    expect((await client.query("SELECT COUNT(*)::int AS count FROM memberships WHERE company_id=$1 AND role='hr'", [companyId])).rows[0].count).toBe(2);
    const secondHr = (await client.query("SELECT m.id,m.user_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.company_id=$1 AND u.email=$2", [companyId, `hr2-${suffix}@example.test`])).rows[0];
    await client.query("INSERT INTO sessions(sid_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '1 day')", [randomUUID().replaceAll("-", ""), secondHr.user_id]);
    const hrStatus = new FormData();
    hrStatus.set("membershipId", employeeId);
    hrStatus.set("active", "false");
    await expect(changeHrStatusAction(hrStatus)).rejects.toThrow("Cuenta de RRHH no encontrada");
    hrStatus.set("membershipId", secondHr.id);
    await changeHrStatusAction(hrStatus);
    expect((await client.query("SELECT active FROM users WHERE id=$1", [secondHr.user_id])).rows[0].active).toBe(false);
    expect((await client.query("SELECT revoked_at FROM sessions WHERE user_id=$1", [secondHr.user_id])).rows[0].revoked_at).not.toBeNull();
    hrStatus.set("active", "true");
    await changeHrStatusAction(hrStatus);
    expect((await client.query("SELECT active FROM users WHERE id=$1", [secondHr.user_id])).rows[0].active).toBe(true);
    const status = new FormData();
    status.set("companyId", companyId);
    status.set("status", "invalid");
    await expect(changeCompanyStatusAction(status)).rejects.toThrow("Estado inválido");
    status.set("status", "suspended");
    await changeCompanyStatusAction(status);
    expect((await client.query("SELECT status FROM companies WHERE id=$1", [companyId])).rows[0].status).toBe("suspended");
    status.set("status", "active");
    await changeCompanyStatusAction(status);
    expect((await client.query("SELECT status FROM companies WHERE id=$1", [companyId])).rows[0].status).toBe("active");
  });
});
