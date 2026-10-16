import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

jest.mock("server-only", () => ({}));
const mockRequireEmployee = jest.fn();
const mockRequireHr = jest.fn();
jest.mock("@/modules/identity/session", () => ({ requireEmployee: mockRequireEmployee, requireHr: mockRequireHr }));

const integration = process.env.DATABASE_URL ? describe : describe.skip;

integration("attendance read models", () => {
  const companyA = randomUUID();
  const companyB = randomUUID();
  const department = randomUUID();
  const policy = randomUUID();
  const users = Array.from({ length: 4 }, () => randomUUID());
  const memberships = Array.from({ length: 4 }, () => randomUUID());
  let today: string;
  let yesterday: string;
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    today = formatInTimeZone(new Date(), "America/Caracas", "yyyy-MM-dd");
    const prior = new Date(`${today}T00:00:00Z`);
    prior.setUTCDate(prior.getUTCDate() - 1);
    yesterday = prior.toISOString().slice(0, 10);
    await client.query("INSERT INTO companies(id,name,code,status) VALUES ($1,'Query A',$3,'active'),($2,'Query B',$4,'active')", [companyA, companyB, `query-${companyA}`, `query-${companyB}`]);
    await client.query("INSERT INTO departments(id,company_id,name) VALUES ($1,$2,'General')", [department, companyA]);
    await client.query("INSERT INTO department_policy_versions(id,department_id,version) VALUES ($1,$2,1)", [policy, department]);
    for (let i = 0; i < 4; i++) {
      await client.query("INSERT INTO users(id,name,password_hash) VALUES ($1,$2,'hash')", [users[i], ["Dentro", "Sin marcar", "Completado", "Sin salida"][i]]);
      await client.query("INSERT INTO memberships(id,user_id,company_id,role,cedula,department_id) VALUES ($1,$2,$3,'employee',$4,$5)", [memberships[i], users[i], companyA, `1000000${i}`, department]);
    }
    const at = (day: string, hour: string) => fromZonedTime(`${day} ${hour}:00`, "America/Caracas");
    await client.query("INSERT INTO shifts(employee_membership_id,company_id,department_id,policy_version_id,checkin_at) VALUES ($1,$2,$3,$4,$5),($6,$2,$3,$4,$7)", [memberships[0], companyA, department, policy, at(today, "08:00"), memberships[3], at(yesterday, "08:00")]);
    await client.query("INSERT INTO shifts(employee_membership_id,company_id,department_id,policy_version_id,checkin_at,checkout_at) VALUES ($1,$2,$3,$4,$5,$6)", [memberships[2], companyA, department, policy, at(today, "08:00"), at(today, "16:00")]);
    mockRequireHr.mockResolvedValue({ role: "hr", companyId: companyA, membershipId: randomUUID() });
    mockRequireEmployee.mockResolvedValue({ role: "employee", companyId: companyA, membershipId: memberships[0] });
  });

  afterAll(async () => {
    await client?.query("DELETE FROM shifts WHERE company_id=$1", [companyA]);
    await client?.query("DELETE FROM memberships WHERE company_id=$1", [companyA]);
    await client?.query("DELETE FROM department_policy_versions WHERE department_id=$1", [department]);
    await client?.query("DELETE FROM departments WHERE id=$1", [department]);
    await client?.query("DELETE FROM companies WHERE id IN ($1,$2)", [companyA, companyB]);
    for (const user of users) await client?.query("DELETE FROM users WHERE id=$1", [user]);
    await client?.end();
    const { pool } = await import("@/db/client");
    await pool.end();
  });

  it("classifies today's four states without treating no mark as a labor absence", async () => {
    const { dailyOverview } = await import("@/modules/attendance/queries");
    expect(Object.fromEntries((await dailyOverview()).map(({ name, status }) => [name, status]))).toEqual({ Dentro: "dentro", "Sin marcar": "sin marcar", Completado: "completado", "Sin salida": "sin salida" });
    mockRequireHr.mockResolvedValueOnce({ role: "hr", companyId: companyB, membershipId: randomUUID() });
    expect(await dailyOverview()).toEqual([]);
  });

  it("shows only the employee's own open shift and scopes history by local start day", async () => {
    const { employeeDashboard, shiftHistory } = await import("@/modules/attendance/queries");
    const panel = await employeeDashboard();
    expect(panel.member?.user.name).toBe("Dentro");
    expect(panel.open?.employeeMembershipId).toBe(memberships[0]);
    expect(panel.policy?.id).toBe(policy);
    expect(panel.markDepartment).toBe("General");
    expect(panel.recent).toHaveLength(1);
    expect((await shiftHistory(today)).map(({ employeeName }) => employeeName).sort()).toEqual(["Completado", "Dentro"]);
    expect((await shiftHistory(yesterday)).map(({ employeeName }) => employeeName)).toEqual(["Sin salida"]);
    mockRequireHr.mockResolvedValueOnce({ role: "hr", companyId: companyB, membershipId: randomUUID() });
    expect(await shiftHistory(today)).toEqual([]);
    await client.query("INSERT INTO department_policy_versions(department_id,version,geofence_required,latitude,longitude,radius_meters) VALUES ($1,2,true,10,-66,30)", [department]);
    const afterRuleChange = await employeeDashboard();
    expect(afterRuleChange.policy?.id).toBe(policy);
    expect(afterRuleChange.policy?.geofenceRequired).toBe(false);
  });
});
