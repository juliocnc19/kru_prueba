import { randomUUID } from "node:crypto";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("PostgreSQL tenant invariants", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
  });

  afterAll(async () => { await client?.end(); });

  it("allows the same cédula across companies but rejects it twice in one company", async () => {
    await client.query("BEGIN");
    try {
      const a = randomUUID(); const b = randomUUID();
      const u1 = randomUUID(); const u2 = randomUUID(); const u3 = randomUUID();
      const d1 = randomUUID(); const d2 = randomUUID();
      await client.query("INSERT INTO companies(id,name,code) VALUES ($1,'A',$3),($2,'B',$4)", [a, b, `a-${a}`, `b-${b}`]);
      await client.query("INSERT INTO users(id,name,password_hash) VALUES ($1,'A','hash'),($2,'B','hash'),($3,'C','hash')", [u1, u2, u3]);
      await client.query("INSERT INTO departments(id,company_id,name) VALUES ($1,$2,'General'),($3,$4,'General')", [d1, a, d2, b]);
      await client.query("INSERT INTO memberships(user_id,company_id,role,cedula,department_id) VALUES ($1,$2,'employee','12345678',$3),($4,$5,'employee','12345678',$6)", [u1, a, d1, u2, b, d2]);
      await expect(client.query("INSERT INTO memberships(user_id,company_id,role,cedula,department_id) VALUES ($1,$2,'employee','12345678',$3)", [u3, a, d1])).rejects.toMatchObject({ code: "23505" });
    } finally {
      await client.query("ROLLBACK");
    }
  });

  it("prevents two simultaneous open shifts for one collaborator", async () => {
    await client.query("BEGIN");
    try {
      const c = randomUUID(); const u = randomUUID(); const d = randomUUID(); const m = randomUUID(); const p = randomUUID();
      await client.query("INSERT INTO companies(id,name,code) VALUES ($1,'A',$2)", [c, `a-${c}`]);
      await client.query("INSERT INTO users(id,name,password_hash) VALUES ($1,'A','hash')", [u]);
      await client.query("INSERT INTO departments(id,company_id,name) VALUES ($1,$2,'General')", [d, c]);
      await client.query("INSERT INTO memberships(id,user_id,company_id,role,cedula,department_id) VALUES ($1,$2,$3,'employee','12345678',$4)", [m, u, c, d]);
      await client.query("INSERT INTO department_policy_versions(id,department_id,version) VALUES ($1,$2,1)", [p, d]);
      const args = [m, c, d, p, "2026-10-05T10:00:00Z"];
      await client.query("INSERT INTO shifts(employee_membership_id,company_id,department_id,policy_version_id,checkin_at) VALUES ($1,$2,$3,$4,$5)", args);
      await expect(client.query("INSERT INTO shifts(employee_membership_id,company_id,department_id,policy_version_id,checkin_at) VALUES ($1,$2,$3,$4,$5)", args)).rejects.toMatchObject({ code: "23505" });
    } finally {
      await client.query("ROLLBACK");
    }
  });

  it("allows one active company membership per user", async () => {
    await client.query("BEGIN");
    try {
      const a = randomUUID(); const b = randomUUID(); const user = randomUUID();
      await client.query("INSERT INTO companies(id,name,code) VALUES ($1,'A',$3),($2,'B',$4)", [a, b, `a-${a}`, `b-${b}`]);
      await client.query("INSERT INTO users(id,name,password_hash) VALUES ($1,'HR','hash')", [user]);
      await client.query("INSERT INTO memberships(user_id,company_id,role) VALUES ($1,$2,'hr')", [user, a]);
      await expect(client.query("INSERT INTO memberships(user_id,company_id,role) VALUES ($1,$2,'hr')", [user, b])).rejects.toMatchObject({ code: "23505" });
    } finally {
      await client.query("ROLLBACK");
    }
  });
});
