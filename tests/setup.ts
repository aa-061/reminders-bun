import { beforeEach } from "bun:test";

// ==============================================================================
// ENVIRONMENT SETUP FOR TESTS - Disable External Services
// ==============================================================================
// These assignments MUST appear before any application module is loaded.
// A static `import … from "../src/…"` would be hoisted above this block by the
// ESM loader, so the shared client is obtained via a dynamic import below.

process.env.NODE_ENV = "test";

// Disable QStash to prevent actual API calls to job scheduling service
process.env.QSTASH_TOKEN = "";

// Disable Mailtrap to prevent actual email sending
process.env.MAILTRAP_HOST = "";
process.env.MAILTRAP_USER = "";
process.env.MAILTRAP_PASS = "";

// Allow registration so integration tests can create users
process.env.ALLOW_REGISTRATION = "true";

// ==============================================================================
// Table cleanup – runs before every test in every file (preloaded via bunfig).
// Uses the singleton client from src/db.ts so the in-memory database that is
// cleared here is the exact same one the Elysia app writes to.
// ==============================================================================
import type { Client } from "@libsql/client";

let _client: Client | undefined;

async function getClient(): Promise<Client> {
  if (!_client) {
    _client = (await import("../src/db")).client;
  }
  return _client;
}

beforeEach(async () => {
  const client = await getClient();
  await client.execute("DELETE FROM reminders");
  await client.execute("DELETE FROM app_settings");
});
