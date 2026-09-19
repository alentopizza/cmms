import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const MAX_ATTEMPTS = Number(process.env.DB_CONNECT_RETRIES || 30);
const RETRY_DELAY_MS = Number(process.env.DB_CONNECT_RETRY_MS || 2000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectWithRetry() {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const candidate = new Client({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 5000,
    });

    try {
      await candidate.connect();
      if (attempt > 1) {
        console.log(`PostgreSQL connection established on attempt ${attempt}.`);
      }
      return candidate;
    } catch (error) {
      lastError = error;
      await candidate.end().catch(() => {});

      if (attempt === MAX_ATTEMPTS) break;

      console.warn(
        `PostgreSQL not ready (attempt ${attempt}/${MAX_ATTEMPTS}). Retrying in ${RETRY_DELAY_MS}ms...`
      );
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw new Error(
    `Unable to connect to PostgreSQL after ${MAX_ATTEMPTS} attempts: ${lastError?.message || "unknown error"}`
  );
}

const client = await connectWithRetry();

try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  const dir = path.join(process.cwd(), "db", "migrations");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const done = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
    if (done.rowCount) continue;

    const sql = await fs.readFile(path.join(dir, file), "utf8");
    await client.query("BEGIN");

    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied migration: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  console.log("Database migrations ready.");
} finally {
  await client.end();
}
