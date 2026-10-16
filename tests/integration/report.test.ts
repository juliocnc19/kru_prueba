import { randomUUID } from "node:crypto";
import { Client } from "pg";

jest.mock("server-only", () => ({}));
const mockRequireHr = jest.fn();
jest.mock("@/modules/identity/session", () => ({ requireHr: mockRequireHr }));

const integration = process.env.DATABASE_URL ? describe : describe.skip;

integration("payroll report isolation and full-week alerts", () => {
  const companyA = randomUUID();
  const companyB = randomUUID();
  const userA = randomUUID();
  const departmentA = randomUUID();
  const membershipA = randomUUID();
  const policyA = randomUUID();
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query("INSERT INTO companies(id,name,code,status) VALUES ($1,'Report A',$3,'active'),($2,'Report B',$4,'active')", [companyA, companyB, `report-${companyA}`, `report-${companyB}`]);
    await client.query("INSERT INTO users(id,name,password_hash) VALUES ($1,'Report Employee','hash')", [userA]);
    await client.query("INSERT INTO departments(id,company_id,name) VALUES ($1,$2,'General')", [departmentA, companyA]);
    await client.query("INSERT INTO memberships(id,user_id,company_id,role,cedula,department_id,starts_at) VALUES ($1,$2,$3,'employee','99887766',$4,'2026-09-01T00:00:00Z')", [membershipA, userA, companyA, departmentA]);
    await client.query("INSERT INTO department_policy_versions(id,department_id,version) VALUES ($1,$2,1)", [policyA, departmentA]);
    await client.query("INSERT INTO shifts(employee_membership_id,company_id,department_id,policy_version_id,checkin_at,checkout_at) VALUES ($1,$2,$3,$4,$5,$6),($1,$2,$3,$4,$7,$8)", [membershipA, companyA, departmentA, policyA, "2026-09-29T10:00:00Z", "2026-09-29T20:00:00Z", "2026-10-01T10:00:00Z", "2026-10-02T04:00:00Z"]);
  });

  afterAll(async () => {
    await client?.query("DELETE FROM shifts WHERE employee_membership_id=$1", [membershipA]);
    await client?.query("DELETE FROM department_policy_versions WHERE id=$1", [policyA]);
    await client?.query("DELETE FROM memberships WHERE id=$1", [membershipA]);
    await client?.query("DELETE FROM departments WHERE id=$1", [departmentA]);
    await client?.query("DELETE FROM companies WHERE id IN ($1,$2)", [companyA, companyB]);
    await client?.query("DELETE FROM users WHERE id=$1", [userA]);
    await client?.end();
    const { pool } = await import("@/db/client");
    await pool.end();
  });

  it("counts only shifts in the quincena but alerts using the whole week", async () => {
    mockRequireHr.mockResolvedValue({ companyId: companyA, membershipId: randomUUID(), role: "hr" });
    const { getPayrollReport } = await import("@/modules/payroll/report");
    const report = await getPayrollReport("fortnight", "2026-10-01");
    expect(report.rows).toEqual([expect.objectContaining({ cedula: "99887766", totalHours: "18.00", overtimeMinutes: 600, alertWeeks: ["2026-09-28"] })]);
    expect(report.departmentHours).toEqual([{ department: "General", hours: 18 }]);
    expect(report.csv).toContain("99887766;Report Employee;2026-10-01;2026-10-15");
    const { exportPayrollAction } = await import("@/modules/payroll/actions");
    expect(await exportPayrollAction("fortnight", "2026-10-01")).toMatchObject({ filename: "kru-marcaje-2026-10-01-2026-10-15.csv", content: expect.stringContaining("99887766;Report Employee") });
  });

  it("rejects another company's department and returns no employees for that company", async () => {
    mockRequireHr.mockResolvedValue({ companyId: companyB, membershipId: randomUUID(), role: "hr" });
    const { getPayrollReport } = await import("@/modules/payroll/report");
    await expect(getPayrollReport("fortnight", "2026-10-01", departmentA)).rejects.toThrow("Departamento no válido");
    expect((await getPayrollReport("fortnight", "2026-10-01")).rows).toEqual([]);
  });
});
