import { hashPassword, verifyPassword } from "./password";
import { issueToken, readToken } from "./token";
import { canAccessEmployee, canManageCompany, canManagePlatform, type Actor } from "./authorization";

const secret = "test-secret-that-is-longer-than-thirty-two-characters";

describe("identity security", () => {
  it("stores no plaintext password and rejects an incorrect password", async () => {
    const hash = await hashPassword("Correcta123!");
    expect(hash).not.toContain("Correcta123!");
    expect(await verifyPassword("Correcta123!", hash)).toBe(true);
    expect(await verifyPassword("incorrecta", hash)).toBe(false);
  });

  it("puts only an opaque session ID and standard timestamps in the signed token", async () => {
    const token = await issueToken("opaque-session", secret, new Date("2026-10-05T12:00:00Z"));
    const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "sid"]);
    expect(payload.exp - payload.iat).toBe(30 * 24 * 60 * 60);
    expect(await readToken(token, secret, new Date("2026-10-06T12:00:00Z"))).toBe("opaque-session");
    expect(await readToken(token, secret, new Date("2026-11-06T12:00:00Z"))).toBeNull();
  });

  it("keeps platform, HR and employee scopes separate", () => {
    const platform: Actor = { userId: "owner", role: "platform", companyId: null, membershipId: null };
    const hr: Actor = { userId: "hr", role: "hr", companyId: "A", membershipId: "hr-A" };
    const employee: Actor = { userId: "ana", role: "employee", companyId: "A", membershipId: "ana-A" };
    expect(canManagePlatform(platform)).toBe(true);
    expect(canManageCompany(platform, "A")).toBe(false);
    expect(canManageCompany(hr, "A")).toBe(true);
    expect(canManageCompany(hr, "B")).toBe(false);
    expect(canAccessEmployee(employee, "ana-A")).toBe(true);
    expect(canAccessEmployee(employee, "other-A")).toBe(false);
    expect(canAccessEmployee(hr, "ana-A")).toBe(false);
  });
});
