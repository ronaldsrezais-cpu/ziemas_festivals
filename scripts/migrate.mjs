import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/pg-proxy";
import { migrate } from "drizzle-orm/pg-proxy/migrator";

// Existing process variables take precedence; local overrides precede .env.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

const connectionString =
  process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.error("Iestatiet DATABASE_URL_UNPOOLED vai tiešo DATABASE_URL savienojumu.");
  process.exit(1);
}

let databaseUrl;
try {
  databaseUrl = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) throw new Error();
} catch {
  console.error("Datubāzes savienojuma adrese nav derīga.");
  process.exit(1);
}

if (databaseUrl.hostname.includes("-pooler.")) {
  console.error("Migrācijām iestatiet DATABASE_URL_UNPOOLED ar tiešo Neon savienojumu.");
  process.exit(1);
}

try {
  const client = neon(connectionString);
  const db = drizzle(async (query, params) => ({ rows: await client.query(query, params) }));
  let appliedStatements = 0;

  await migrate(db, async (queries) => {
    if (queries.length === 0) return;
    // Schema changes and the Drizzle journal commit or roll back together.
    await client.transaction(queries.map((query) => client.query(query, [])));
    appliedStatements = queries.length;
  }, { migrationsFolder: "./drizzle" });

  console.log(appliedStatements > 0
    ? "Datubāzes migrācijas veiksmīgi ieviestas."
    : "Datubāzes struktūra jau ir aktuāla.");
} catch (error) {
  // Connection strings and credentials must never reach build or CI logs.
  console.error("Datubāzes migrācija neizdevās.", error?.code ?? error?.name ?? "Error");
  process.exit(1);
}
