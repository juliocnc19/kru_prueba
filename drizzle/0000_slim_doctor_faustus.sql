CREATE TYPE "public"."company_status" AS ENUM('pending', 'active', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('hr', 'employee');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(180) NOT NULL,
	"code" varchar(64) NOT NULL,
	"status" "company_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" uuid
);
--> statement-breakpoint
CREATE TABLE "department_policy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"ordinary_minutes" integer DEFAULT 480 NOT NULL,
	"night_start" varchar(5) DEFAULT '19:00' NOT NULL,
	"night_end" varchar(5) DEFAULT '05:00' NOT NULL,
	"weekly_overtime_alert_minutes" integer DEFAULT 600 NOT NULL,
	"geofence_required" boolean DEFAULT false NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"radius_meters" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "department_policy_positive" CHECK ("department_policy_versions"."ordinary_minutes" > 0 AND "department_policy_versions"."weekly_overtime_alert_minutes" >= 0),
	CONSTRAINT "department_policy_geofence" CHECK (NOT "department_policy_versions"."geofence_required" OR ("department_policy_versions"."latitude" IS NOT NULL AND "department_policy_versions"."longitude" IS NOT NULL AND "department_policy_versions"."radius_meters" IN (20, 30, 40)))
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(140) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"role" "membership_role" NOT NULL,
	"cedula" varchar(32),
	"department_id" uuid,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	CONSTRAINT "memberships_employee_fields" CHECK ("memberships"."role" <> 'employee' OR ("memberships"."cedula" IS NOT NULL AND "memberships"."department_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sid_hash" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid NOT NULL,
	"actor_membership_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"before_checkin_at" timestamp with time zone NOT NULL,
	"before_checkout_at" timestamp with time zone,
	"after_checkin_at" timestamp with time zone NOT NULL,
	"after_checkout_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shift_corrections_reason_nonempty" CHECK (length(trim("shift_corrections"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_membership_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"policy_version_id" uuid NOT NULL,
	"checkin_at" timestamp with time zone NOT NULL,
	"checkout_at" timestamp with time zone,
	"checkin_location" jsonb,
	"checkout_location" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shifts_valid_order" CHECK ("shifts"."checkout_at" IS NULL OR "shifts"."checkout_at" > "shifts"."checkin_at")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(255),
	"password_hash" text NOT NULL,
	"is_platform_owner" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_policy_versions" ADD CONSTRAINT "department_policy_versions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_corrections" ADD CONSTRAINT "shift_corrections_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_corrections" ADD CONSTRAINT "shift_corrections_actor_membership_id_memberships_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_employee_membership_id_memberships_id_fk" FOREIGN KEY ("employee_membership_id") REFERENCES "public"."memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_policy_version_id_department_policy_versions_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."department_policy_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_code_unique" ON "companies" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "department_policy_version_unique" ON "department_policy_versions" USING btree ("department_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_company_name_unique" ON "departments" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "departments_company_idx" ON "departments" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_company_cedula_unique" ON "memberships" USING btree ("company_id","cedula") WHERE "memberships"."cedula" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_company_unique" ON "memberships" USING btree ("user_id","company_id");--> statement-breakpoint
CREATE INDEX "memberships_company_role_idx" ON "memberships" USING btree ("company_id","role");--> statement-breakpoint
CREATE INDEX "memberships_department_idx" ON "memberships" USING btree ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_sid_hash_unique" ON "sessions" USING btree ("sid_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shift_corrections_shift_idx" ON "shift_corrections" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_one_open_per_employee" ON "shifts" USING btree ("employee_membership_id") WHERE "shifts"."checkout_at" IS NULL;--> statement-breakpoint
CREATE INDEX "shifts_company_date_idx" ON "shifts" USING btree ("company_id","checkin_at");--> statement-breakpoint
CREATE INDEX "shifts_employee_date_idx" ON "shifts" USING btree ("employee_membership_id","checkin_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email") WHERE "users"."email" IS NOT NULL;