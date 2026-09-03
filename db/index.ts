import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL nav konfigurēts.");
  return drizzle(neon(databaseUrl), { schema });
}

let cached: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (cached) return cached;
  cached = createDb();
  return cached;
}
