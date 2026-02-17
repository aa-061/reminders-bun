import { createClient, type Client } from "@libsql/client";
import { logger } from "./logger";

/**
 * Create the shared database client once.
 *
 * URL resolution (checked in order):
 *   test        → in-memory SQLite  (NODE_ENV === "test")
 *   production  → Turso cloud       (TURSO_DATABASE_URL is set)
 *   development → local file        (file:reminders.db)
 */
function createDbClient(): Client {
  if (process.env.NODE_ENV === "test") {
    return createClient({ url: "file::memory:" });
  }

  if (process.env.TURSO_DATABASE_URL) {
    return createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
      // @libsql/hrana-client internally uses cross-fetch, which drops the
      // Authorization header when constructing Request objects in Bun.
      // Passing the native fetch bypasses that entirely.
      fetch: globalThis.fetch,
    });
  }

  return createClient({ url: "file:reminders.db" });
}

export const client: Client = createDbClient();

// ---------------------------------------------------------------------------
// Schema bootstrap – runs once when the module is first imported.
// Top-level await is valid in ESM; Bun honours it.
// ---------------------------------------------------------------------------
await client.execute(`
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    date TEXT,
    location TEXT,
    description TEXT,
    reminders TEXT,
    alerts TEXT,
    is_recurring BOOLEAN,
    recurrence TEXT,
    start_date TEXT,
    end_date TEXT,
    last_alert_time TEXT,
    is_active INTEGER DEFAULT 1
  )
`);

await client.execute(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

await client.execute(`
  CREATE TABLE IF NOT EXISTS modes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL CHECK(mode IN ('email', 'sms', 'call', 'push', 'ical', 'telegram')),
    address TEXT NOT NULL,
    is_default INTEGER DEFAULT 0 CHECK(is_default IN (0, 1)),
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, address)
  )
`);

await client.execute(`
  CREATE INDEX IF NOT EXISTS idx_modes_user_id ON modes(user_id)
`);

// Migration: Update modes table to include 'telegram' in CHECK constraint
// SQLite doesn't support modifying CHECK constraints, so we need to recreate the table
try {
  // Check if the table needs migration
  const testResult = await client.execute({
    sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name='modes'",
    args: [],
  });

  const tableSql = testResult.rows[0]?.sql as string | undefined;

  // If the table doesn't include 'telegram' in the CHECK constraint, migrate it
  if (tableSql && !tableSql.includes("'telegram'")) {
    logger.info("Migrating modes table to add 'telegram' support...");

    // Create new table with updated constraint
    await client.execute(`
      CREATE TABLE modes_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mode TEXT NOT NULL CHECK(mode IN ('email', 'sms', 'call', 'push', 'ical', 'telegram')),
        address TEXT NOT NULL,
        is_default INTEGER DEFAULT 0 CHECK(is_default IN (0, 1)),
        user_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, address)
      )
    `);

    // Copy data from old table
    await client.execute(`
      INSERT INTO modes_new (id, mode, address, is_default, user_id, created_at)
      SELECT id, mode, address, is_default, user_id, created_at FROM modes
    `);

    // Drop old table
    await client.execute("DROP TABLE modes");

    // Rename new table
    await client.execute("ALTER TABLE modes_new RENAME TO modes");

    // Recreate index
    await client.execute(`
      CREATE INDEX idx_modes_user_id ON modes(user_id)
    `);

    logger.info("Modes table migration completed successfully");
  }
} catch (error) {
  logger.error("Migration failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;
}

await client.execute(`
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    ms INTEGER NOT NULL CHECK(ms >= 3000),
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

await client.execute(`
  CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id)
`);

// Migration: Add user_id to reminders table
try {
  await client.execute(`ALTER TABLE reminders ADD COLUMN user_id TEXT`);
  logger.info("Added user_id column to reminders table");
} catch (error) {
  if (!(error as Error).message.includes("duplicate column")) {
    logger.error("Failed to add user_id column", { error });
  }
}

await client.execute(`
  CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id)
`);

// Push subscriptions table
await client.execute(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    keys_p256dh TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT,
    user_agent TEXT,
    UNIQUE(user_id, endpoint)
  )
`);

await client.execute(`
  CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON push_subscriptions(user_id)
`);
