import { createClient, type Client } from "@libsql/client";

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
    mode TEXT NOT NULL CHECK(mode IN ('email', 'sms', 'call', 'push', 'ical')),
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
