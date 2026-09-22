import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

export type Transaction = Parameters<Parameters<NeonDatabase<typeof schema>["transaction"]>[0]>[0];

// Interactive transactions keep validation and dependent writes atomic.
// Each request owns and closes its connection (including on rollback).
export async function withTransaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL nav konfigurēts.");
  neonConfig.webSocketConstructor = WebSocket;
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 30_000 });
  try {
    return await drizzle(pool, { schema }).transaction(work);
  } finally {
    await pool.end();
  }
}
