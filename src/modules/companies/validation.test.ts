import { companyRegistrationSchema, employeeSchema, policySchema } from "./validation";

describe("organization input validation", () => {
  it("normalizes the public company code and rejects weak credentials", () => {
    expect(companyRegistrationSchema.parse({ companyName: "Acme", code: " ACME-01 ", adminName: "Ana", email: "ANA@ACME.COM", password: "Correcta123!" }).code).toBe("acme-01");
    expect(companyRegistrationSchema.safeParse({ companyName: "Acme", code: "A", adminName: "Ana", email: "bad", password: "123" }).success).toBe(false);
  });

  it("requires employee identity and a valid department", () => {
    expect(employeeSchema.safeParse({ name: "Ana", cedula: "", departmentId: "bad", password: "Correcta123!" }).success).toBe(false);
  });

  it("requires coordinates and a supported radius when location is enabled", () => {
    expect(policySchema.safeParse({ geofenceRequired: true, radiusMeters: 20, latitude: null, longitude: null }).success).toBe(false);
    expect(policySchema.safeParse({ geofenceRequired: true, radiusMeters: 30, latitude: 10.48, longitude: -66.9 }).success).toBe(true);
  });
});
