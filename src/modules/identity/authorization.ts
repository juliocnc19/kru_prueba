export type Actor = { userId: string; role: "platform" | "hr" | "employee"; companyId: string | null; membershipId: string | null };
export function canManagePlatform(actor: Actor): boolean { return actor.role === "platform"; }
export function canManageCompany(actor: Actor, companyId: string): boolean { return actor.role === "hr" && actor.companyId === companyId; }
export function canAccessEmployee(actor: Actor, membershipId: string): boolean { return actor.role === "employee" && actor.membershipId === membershipId; }
