import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Next.js imports this module while inspecting routes at build time. Pool connects only on a query.
const connectionString = process.env.DATABASE_URL ?? "postgresql://missing:missing@127.0.0.1:1/missing";

const globalForDb = globalThis as unknown as { kruPool?: Pool };
const pool = globalForDb.kruPool ?? new Pool({ connectionString, max: 5 });
if (process.env.NODE_ENV === "development") globalForDb.kruPool = pool;

export const db = drizzle({ client: pool, schema });
export { pool };
