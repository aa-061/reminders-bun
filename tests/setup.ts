import { Database } from "bun:sqlite";
import { beforeAll, afterAll, beforeEach } from "bun:test";

// ==============================================================================
// ENVIRONMENT SETUP FOR TESTS - Disable External Services
// ==============================================================================

// Disable QStash to prevent actual API calls to job scheduling service
process.env.QSTASH_TOKEN = "";

// Disable Mailtrap to prevent actual email sending
process.env.MAILTRAP_HOST = "";
process.env.MAILTRAP_USER = "";
process.env.MAILTRAP_PASS = "";

// Disable SendGrid to prevent actual email sending
process.env.SENDGRID_API_KEY = "";
process.env.SENDGRID_FROM_EMAIL = "";

// Enable test mode
process.env.NODE_ENV = "test";

// Allow registration so integration tests can create users
process.env.ALLOW_REGISTRATION = "true";

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
