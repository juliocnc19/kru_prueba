import { sql } from "drizzle-orm";
import { boolean, check, doublePrecision, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const companyStatus = pgEnum("company_status", ["pending", "active", "rejected", "suspended"]);
export const membershipRole = pgEnum("membership_role", ["hr", "employee"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 255 }),
  passwordHash: text("password_hash").notNull(),
  isPlatformOwner: boolean("is_platform_owner").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("users_email_unique").on(table.email).where(sql`${table.email} IS NOT NULL`)]);

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  code: varchar("code", { length: 64 }).notNull(),
  status: companyStatus("status").default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: uuid("approved_by").references(() => users.id),
}, (table) => [uniqueIndex("companies_code_unique").on(table.code)]);

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  name: varchar("name", { length: 140 }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("departments_company_name_unique").on(table.companyId, table.name), index("departments_company_idx").on(table.companyId)]);

export const memberships = pgTable("memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  role: membershipRole("role").notNull(),
  cedula: varchar("cedula", { length: 32 }),
  departmentId: uuid("department_id").references(() => departments.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).defaultNow().notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("memberships_company_cedula_unique").on(table.companyId, table.cedula).where(sql`${table.cedula} IS NOT NULL`),
  uniqueIndex("memberships_one_active_company_per_user").on(table.userId).where(sql`${table.endsAt} IS NULL`),
  uniqueIndex("memberships_user_company_unique").on(table.userId, table.companyId),
  index("memberships_company_role_idx").on(table.companyId, table.role),
  index("memberships_department_idx").on(table.departmentId),
  check("memberships_employee_fields", sql`${table.role} <> 'employee' OR (${table.cedula} IS NOT NULL AND ${table.departmentId} IS NOT NULL)`),
]);

export const departmentPolicyVersions = pgTable("department_policy_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  departmentId: uuid("department_id").notNull().references(() => departments.id),
  version: integer("version").notNull(),
  ordinaryMinutes: integer("ordinary_minutes").default(480).notNull(),
  nightStart: varchar("night_start", { length: 5 }).default("19:00").notNull(),
  nightEnd: varchar("night_end", { length: 5 }).default("05:00").notNull(),
  weeklyOvertimeAlertMinutes: integer("weekly_overtime_alert_minutes").default(600).notNull(),
  geofenceRequired: boolean("geofence_required").default(false).notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  radiusMeters: integer("radius_meters"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("department_policy_version_unique").on(table.departmentId, table.version),
  check("department_policy_positive", sql`${table.ordinaryMinutes} > 0 AND ${table.weeklyOvertimeAlertMinutes} >= 0`),
  check("department_policy_geofence", sql`NOT ${table.geofenceRequired} OR (${table.latitude} IS NOT NULL AND ${table.longitude} IS NOT NULL AND ${table.radiusMeters} IN (20, 30, 40))`),
]);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sidHash: varchar("sid_hash", { length: 64 }).notNull(),
  userId: uuid("user_id").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("sessions_sid_hash_unique").on(table.sidHash), index("sessions_user_idx").on(table.userId)]);

export const shifts = pgTable("shifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeMembershipId: uuid("employee_membership_id").notNull().references(() => memberships.id),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  departmentId: uuid("department_id").notNull().references(() => departments.id),
  policyVersionId: uuid("policy_version_id").notNull().references(() => departmentPolicyVersions.id),
  checkinAt: timestamp("checkin_at", { withTimezone: true }).notNull(),
  checkoutAt: timestamp("checkout_at", { withTimezone: true }),
  checkinLocation: jsonb("checkin_location").$type<{ distanceMeters: number; accuracyMeters: number } | null>(),
  checkoutLocation: jsonb("checkout_location").$type<{ distanceMeters: number; accuracyMeters: number } | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("shifts_one_open_per_employee").on(table.employeeMembershipId).where(sql`${table.checkoutAt} IS NULL`),
  index("shifts_company_date_idx").on(table.companyId, table.checkinAt),
  index("shifts_employee_date_idx").on(table.employeeMembershipId, table.checkinAt),
  check("shifts_valid_order", sql`${table.checkoutAt} IS NULL OR ${table.checkoutAt} > ${table.checkinAt}`),
]);

export const shiftCorrections = pgTable("shift_corrections", {
  id: uuid("id").defaultRandom().primaryKey(),
  shiftId: uuid("shift_id").notNull().references(() => shifts.id),
  actorMembershipId: uuid("actor_membership_id").notNull().references(() => memberships.id),
  reason: text("reason").notNull(),
  beforeCheckinAt: timestamp("before_checkin_at", { withTimezone: true }).notNull(),
  beforeCheckoutAt: timestamp("before_checkout_at", { withTimezone: true }),
  afterCheckinAt: timestamp("after_checkin_at", { withTimezone: true }).notNull(),
  afterCheckoutAt: timestamp("after_checkout_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("shift_corrections_shift_idx").on(table.shiftId), check("shift_corrections_reason_nonempty", sql`length(trim(${table.reason})) > 0`)]);
