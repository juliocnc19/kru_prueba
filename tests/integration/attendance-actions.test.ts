import { randomUUID } from "node:crypto";
import { Client } from "pg";

jest.mock("server-only", () => ({}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireEmployee = jest.fn();
const mockRequireHr = jest.fn();
jest.mock("@/modules/identity/session", () => ({ requireEmployee: mockRequireEmployee, requireHr: mockRequireHr }));

const integration = process.env.DATABASE_URL ? describe : describe.skip;

integration("attendance actions", () => {
  const companyA = randomUUID();
  const companyB = randomUUID();
  const user = randomUUID();
  const hrUser = randomUUID();
  const hrMembership = randomUUID();
  const department = randomUUID();
  const membership = randomUUID();
  const policy = randomUUID();
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query("INSERT INTO companies(id,name,code,status) VALUES ($1,'Action A',$3,'active'),($2,'Action B',$4,'active')", [companyA, companyB, `action-${companyA}`, `action-${companyB}`]);
    await client.query("INSERT INTO users(id,name,password_hash) VALUES ($1,'Action Employee','hash'),($2,'Action HR','hash')", [user, hrUser]);
    await client.query("INSERT INTO departments(id,company_id,name) VALUES ($1,$2,'General')", [department, companyA]);
    await client.query("INSERT INTO memberships(id,user_id,company_id,role,cedula,department_id) VALUES ($1,$2,$3,'employee','88776655',$4)", [membership, user, companyA, department]);
    await client.query("INSERT INTO memberships(id,user_id,company_id,role) VALUES ($1,$2,$3,'hr')", [hrMembership, hrUser, companyA]);
    await client.query("INSERT INTO department_policy_versions(id,department_id,version) VALUES ($1,$2,1)", [policy, department]);
    mockRequireEmployee.mockResolvedValue({ role: "employee", companyId: companyA, membershipId: membership });
    mockRequireHr.mockResolvedValue({ role: "hr", companyId: companyA, membershipId: hrMembership });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await client?.query("DELETE FROM shift_corrections WHERE shift_id IN (SELECT id FROM shifts WHERE employee_membership_id=$1)", [membership]);
    await client?.query("DELETE FROM shifts WHERE employee_membership_id=$1", [membership]);
    await client?.query("DELETE FROM department_policy_versions WHERE department_id=$1", [department]);
    await client?.query("DELETE FROM memberships WHERE id IN ($1,$2)", [membership, hrMembership]);
    await client?.query("DELETE FROM departments WHERE id=$1", [department]);
    await client?.query("DELETE FROM companies WHERE id IN ($1,$2)", [companyA, companyB]);
    await client?.query("DELETE FROM users WHERE id IN ($1,$2)", [user, hrUser]);
    await client?.end();
    const { pool } = await import("@/db/client");
    await pool.end();
  });

  it("opens one shift, rejects duplicate entry, then closes it using server time", async () => {
    const { clockInAction, clockOutAction } = await import("@/modules/attendance/actions");
    const now = jest.spyOn(Date, "now").mockReturnValue(new Date("2026-10-20T10:00:25Z").getTime());
    expect(await clockInAction(null)).toMatchObject({ success: "Entrada registrada." });
    expect(await clockInAction(null)).toMatchObject({ error: expect.stringContaining("entrada abierta") });
    expect(await clockOutAction(null)).toMatchObject({ error: expect.stringContaining("siguiente minuto") });
    now.mockReturnValue(new Date("2026-10-20T10:01:10Z").getTime());
    expect(await clockOutAction(null)).toMatchObject({ success: "Salida registrada." });
    const rows = await client.query("SELECT checkin_at,checkout_at FROM shifts WHERE employee_membership_id=$1", [membership]);
    expect(rows.rows).toEqual([expect.objectContaining({ checkin_at: new Date("2026-10-20T10:00:00Z"), checkout_at: new Date("2026-10-20T10:01:00Z") })]);
    now.mockRestore();
  });

  it("requires a reason, records an audit and hides a foreign shift", async () => {
    const { correctShiftAction } = await import("@/modules/attendance/actions");
    const shiftId = (await client.query("SELECT id FROM shifts WHERE employee_membership_id=$1", [membership])).rows[0].id as string;
    const form = new FormData();
    form.set("shiftId", shiftId);
    form.set("checkinAt", "2026-10-20T06:00");
    form.set("checkoutAt", "2026-10-20T06:02");
    expect(await correctShiftAction({ error: "" }, form)).toMatchObject({ error: expect.stringContaining("motivo") });
    form.set("reason", "Corrección de prueba");
    mockRequireHr.mockResolvedValueOnce({ role: "hr", companyId: companyB, membershipId: randomUUID() });
    expect(await correctShiftAction({ error: "" }, form)).toMatchObject({ error: "Marcaje no encontrado." });
    expect(await correctShiftAction({ error: "" }, form)).toMatchObject({ success: expect.stringContaining("auditado") });
    const audit = await client.query("SELECT reason,before_checkout_at,after_checkout_at FROM shift_corrections WHERE shift_id=$1", [shiftId]);
    expect(audit.rows).toEqual([expect.objectContaining({ reason: "Corrección de prueba", before_checkout_at: new Date("2026-10-20T10:01:00Z"), after_checkout_at: new Date("2026-10-20T10:02:00Z") })]);
  });

  it("blocks a geofenced entry when the browser provides no location", async () => {
    await client.query("INSERT INTO department_policy_versions(department_id,version,geofence_required,latitude,longitude,radius_meters) VALUES ($1,2,true,10,-66,30)", [department]);
    const { clockInAction } = await import("@/modules/attendance/actions");
    expect(await clockInAction(null)).toMatchObject({ error: expect.stringContaining("ubicación") });
    const capturedAt = new Date().toISOString();
    expect(await clockInAction({ latitude: 10.001, longitude: -66, accuracyMeters: 5, capturedAt })).toMatchObject({ error: expect.stringContaining("radio") });
    const now = jest.spyOn(Date, "now").mockReturnValue(new Date("2026-10-21T10:00:00Z").getTime());
    expect(await clockInAction({ latitude: 10, longitude: -66, accuracyMeters: 5, capturedAt })).toMatchObject({ success: "Entrada registrada." });
    now.mockRestore();
  });
});
