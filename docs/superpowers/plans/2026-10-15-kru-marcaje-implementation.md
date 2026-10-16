# Kru Marcaje Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deliver the approved multi-tenant Marcaje application, local Docker setup, and deployment-ready Vercel configuration.

**Architecture:** A Next.js App Router modular monolith. Domain functions are pure TypeScript; application services receive repository interfaces; Drizzle adapters enforce tenant predicates; Server Actions are the browser mutation boundary. PostgreSQL holds identities, sessions, company memberships, policy versions, shifts and audits.

**Tech Stack:** Latest patched Next.js 16.x, React, TypeScript, Tailwind, Zustand, TanStack Form/Table/Charts, PostgreSQL, Drizzle, Jest, Docker Compose.

---

## File map

- `src/app/**`: role-specific routes, Server Components, Server Actions, loading/error/not-found states.
- `src/modules/identity/**`: password, JWT, session and authorization use cases.
- `src/modules/companies/**`: signup, approval and company administration.
- `src/modules/departments/**`: department and immutable policy management.
- `src/modules/employees/**`: staff lifecycle and membership queries.
- `src/modules/attendance/**`: geofence, clock, corrections and day state.
- `src/modules/payroll/**`: Caracas time math, period aggregation, alerts and CSV.
- `src/modules/reports/**`: metrics and chart DTOs.
- `src/db/**`: Drizzle schema, connection, migrations and repository implementations.
- `src/components/**`: shared responsive UI, forms and tables.
- `tests/**`: unit, integration and UI tests; `e2e/**`: browser flows.
- `scripts/**`, `Dockerfile`, `compose.yaml`: repeatable local bootstrap and automation.
- `README.md`, `docs/ai-log.md`, `docs/business-note.md`: delivery documents.

## Phase 1: runnable foundation and access control

### Task 1: scaffold and test harness

**Files:** Create `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `jest.config.ts`, `jest.setup.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/icon.svg`, `.gitignore`.

- [ ] Pin current patched stable versions and install dependencies with npm. Configure App Router, strict TypeScript, Tailwind, ESLint and Jest with `next/jest`.
- [ ] Add scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:coverage`, `db:generate`, `db:migrate`, `db:seed`.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run build`; expected: exit 0 for all. Commit `chore: scaffold Next.js application`.

### Task 2: database schema and migration

**Files:** Create `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`, generated `drizzle/**`, `tests/integration/schema.test.ts`.

- [ ] Write a database test that creates two companies with the same employee cédula and rejects a duplicate cédula within one company. Run `npm test -- tests/integration/schema.test.ts --runInBand`; expected: failure because schema does not exist.
- [ ] Define `users`, `companies`, `memberships`, `departments`, `department_policy_versions`, `sessions`, `shifts`, `shift_corrections` with FK, check and unique constraints. A partial unique index on `shifts(employee_membership_id) WHERE checkout_at IS NULL` enforces one open shift. Generate and apply a checked-in SQL migration.
- [ ] Run the same test, `npm run typecheck`, `npm run db:migrate`; expected: all pass. Commit `feat: add tenant-aware database schema`.

### Task 3: identity and permissions

**Files:** Create `src/modules/identity/password.ts`, `session.ts`, `authorization.ts`, `repositories.ts`, `src/db/identity-repository.ts`, `src/app/(auth)/login/actions.ts`, `src/proxy.ts`, `tests/unit/identity/*.test.ts`, `tests/integration/identity.test.ts`.

- [ ] First write failing tests for password verification, a JWT containing only `sid` plus timestamps, 30-day expiry, revocation, HR access only to own company, employee access only to self and platform refusal of shift data. Run targeted Jest command and confirm failure for missing behavior.
- [ ] Implement scrypt password hashes, signed JWT, hashed DB session IDs and `requirePlatform`, `requireHr(companyId)`, `requireEmployee(membershipId)` guards. A guard must fetch current role/company status from DB instead of trusting input or JWT claims.
- [ ] Implement login/logout actions and optimistic `proxy.ts` redirects. Run identity tests and typecheck; expected: pass. Commit `feat: add revocable sessions and tenant authorization`.

### Task 4: registration and organization management

**Files:** Create `src/modules/companies/{schema,service,repository}.ts`, `src/modules/departments/{schema,service,repository}.ts`, `src/modules/employees/{schema,service,repository}.ts`, Drizzle adapters, route actions and matching tests.

- [ ] Write failing tests for atomic pending registration with General department, inability to operate before approval, platform approval, HR managing only own departments/employees and policy version creation. Run targeted Jest and confirm expected failures.
- [ ] Implement input validation, services and scoped adapters; company registration creates user, pending company, HR membership, General department and default policy in one transaction. An approval records actor and time. Policy edits insert versions rather than mutate history.
- [ ] Run unit/integration tests and typecheck; expected: pass. Commit `feat: add company approval and department management`.

## Phase 2: attendance and payroll engine

### Task 5: geofence and clocking

**Files:** Create `src/modules/attendance/{geofence,clock,repository,schema}.ts`, `src/db/attendance-repository.ts`, `src/app/(employee)/marcar/actions.ts`, `tests/unit/attendance/*.test.ts`, `tests/integration/attendance.test.ts`.

- [ ] Write failing tests for optional geofence, 20/30/40 m borders, stale/inaccurate coordinates, a second open shift, server-authoritative time, checkout and concurrent requests. Run targeted Jest to confirm failures.
- [ ] Implement Haversine distance in metres and validation of latitude/longitude, accuracy and timestamp. Implement transaction-safe clock-in/out that snapshots company, department and policy version and stores only distance/accuracy result. Use DB unique constraint as final concurrency guard.
- [ ] Run tests and typecheck; expected: pass. Commit `feat: add protected clock-in and clock-out`.

### Task 6: corrections and daily state

**Files:** Create `src/modules/attendance/{corrections,day-status}.ts`, `src/app/(hr)/equipo/actions.ts`, matching unit/integration tests.

- [ ] Write failing tests for missing reason, invalid order, overlapping shifts, audit before/after values, foreign-company correction rejection and each daily state (`inside`, `missing_checkout`, `unmarked`, `completed`).
- [ ] Implement transactional correction and immutable audit, then derive daily state using Caracas day boundaries. Run targeted tests; expected: pass. Commit `feat: add audited corrections and daily overview`.

### Task 7: period calculations and CSV

**Files:** Create `src/modules/payroll/{time,calculate,period,aggregate,csv}.ts`, `src/app/(hr)/nomina/actions.ts`, `tests/unit/payroll/*.test.ts`, `tests/integration/payroll.test.ts`.

- [ ] Write failing tests for the two examples: `06:00–16:00 => 2.00 extra day`, `14:00–00:30 => 2.50 extra night and 3.00 regular night`; add midnight, period boundary, end-only rounding, 600 vs 601 extra minutes and CSV escaping/one row per employee.
- [ ] Implement interval segmentation at the ordinary threshold and every Caracas 19:00/05:00 boundary, integer-minute totals, local Monday–Sunday and calendar-half periods, weekly alerts and exact semicolon CSV header. Server Action returns CSV content to a client download control.
- [ ] Run targeted tests, typecheck and integration tests; expected: pass. Commit `feat: calculate payroll periods and export CSV`.

## Phase 3: responsive product and delivery

### Task 8: application UI

**Files:** Create role route groups under `src/app/(platform)`, `(hr)`, `(employee)`, `(auth)`; shared `src/components/**`; `src/stores/ui.ts`; CSS and UI tests.

- [ ] Write failing interaction tests for login validation, company approval, clock button disabled during submission, geolocation retry, correction reason and period/department filters.
- [ ] Implement mobile-first pages: public company registration, login, pending notice, platform approvals/admins, HR daily dashboard/departments/staff/corrections/payroll/charts, employee one-action clock and history. Use TanStack Form/Table/Charts; Zustand stores only ephemeral UI state.
- [ ] Add route-specific loading/error/not-found and access-denied screens. Run UI tests, accessibility checks and typecheck; expected: pass. Commit `feat: build responsive role dashboards`.

### Task 9: local bootstrap and production configuration

**Files:** Create `Dockerfile`, `compose.yaml`, `.dockerignore`, `scripts/entrypoint.sh`, `scripts/seed.ts`, `.env.example`, Vercel deployment notes.

- [ ] Add Compose services for app and Postgres with health check and named DB volume. The entrypoint waits for DB, migrates, seeds idempotently, then starts Next.js; local defaults require no manual `.env`.
- [ ] Test `docker compose up --build -d`, `docker compose exec app npm run typecheck`, `docker compose exec app npm test -- --runInBand`, `docker compose down`; expected: fresh environment works and seed can rerun without duplicates. Commit `chore: add portable Docker bootstrap`.

### Task 10: documentation and end-to-end gate

**Files:** Create `README.md`, `docs/ai-log.md`, `docs/business-note.md`, `e2e/*.spec.ts`, final refinements.

- [ ] Record actual AI-assisted decisions and three real corrections/rejections in the log. Explain credentials, local setup, deployment, Mermaid architecture, discarded alternatives, omissions, next steps and location limitations in README. Write a one-page business note.
- [ ] Exercise three browser flows: pending company and approval, A/B isolation and employee clock to HR report/CSV. Check 320 px, tablet and desktop views.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build`, browser smoke tests and clean Docker startup. Compare each requirement in the approved spec with implementation, report any gap, then commit `docs: complete technical-test delivery`.

## Deployment gate

After local verification, connect the repo to Vercel, attach Neon via Marketplace, configure non-default production secrets, apply migrations, seed or create demonstration accounts, deploy, test the public URL and add it to README. These steps require the user's Vercel/Neon and remote-repository access. Do not claim a public deployment before checking the URL and test accounts.
