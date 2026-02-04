import { Database } from "bun:sqlite";
import { beforeAll, afterAll, beforeEach } from "bun:test";

// Use in-memory database for tests
const TEST_DB_PATH = ":memory:";

let testDb: Database;

export function getTestDb(): Database {
  return testDb;
}

beforeAll(() => {
  // Create in-memory test database
  testDb = new Database(TEST_DB_PATH);

  // Create schema
  testDb.run(`
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

  testDb.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
});

afterAll(() => {
  testDb.close();
});

beforeEach(() => {
  // Clear data between tests
  testDb.run("DELETE FROM reminders");
  testDb.run("DELETE FROM app_settings");
});
