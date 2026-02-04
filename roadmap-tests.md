# Testing Roadmap for Reminders Server

This document outlines a phased approach to implementing comprehensive tests for the Reminders API server. Each phase is self-contained and can be implemented independently.

## Overview

| Phase | Type | Priority | Purpose |
|-------|------|----------|---------|
| 1 | Test Setup | Critical | Configure Bun test runner and test database |
| 2 | API Integration Tests | Critical | Test all REST endpoints (replaces manual Postman testing) |
| 3 | Unit Tests | Medium | Test pure functions, helpers, and utilities |
| 4 | Repository Tests | Medium | Test database operations in isolation |
| 5 | Webhook Tests | Medium | Test QStash webhook handlers |
| 6 | CI/CD Integration | Medium | Automate test execution |

---

## Phase 1: Test Setup & Configuration

### Goal
Set up the Bun test runner with a dedicated test database to avoid polluting development data.

### Step 1.1: Create Test Configuration

Create `server/bunfig.toml` for test configuration:

```toml
[test]
preload = ["./tests/setup.ts"]
```

### Step 1.2: Create Test Setup File

Create `server/tests/setup.ts`:

```typescript
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
```

### Step 1.3: Create Test Utilities

Create `server/tests/test-utils.ts`:

```typescript
import { Elysia } from "elysia";
import type { TReminder } from "../src/types";

// Base URL for API calls
export const API_KEY = "test-api-key";

// Create a test app instance
export async function createTestApp() {
  // Import your app configuration (you may need to refactor index.ts to export the app)
  const { app } = await import("../index");
  return app;
}

// Helper to make authenticated requests
export function authHeaders() {
  return {
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
  };
}

// Sample reminder factory
export function createSampleReminder(overrides: Partial<TReminder> = {}): Omit<TReminder, "id"> {
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Tomorrow

  return {
    title: "Test Reminder",
    date: futureDate,
    location: null,
    description: "Test description",
    reminders: [
      { id: "mode-1", mode: "email", address: "test@example.com" }
    ],
    alerts: [
      { id: "alert-1", time: 3600000 } // 1 hour before
    ],
    is_recurring: false,
    recurrence: null,
    start_date: null,
    end_date: null,
    is_active: true,
    last_alert_time: null,
    ...overrides,
  };
}

// Sample recurring reminder factory
export function createRecurringReminder(overrides: Partial<TReminder> = {}): Omit<TReminder, "id"> {
  const startDate = new Date().toISOString();
  const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days later

  return {
    title: "Recurring Test Reminder",
    date: startDate,
    location: null,
    description: "Recurring test description",
    reminders: [
      { id: "mode-1", mode: "email", address: "test@example.com" }
    ],
    alerts: [
      { id: "alert-1", time: 3600000 }
    ],
    is_recurring: true,
    recurrence: "0 9 * * 1-5", // Weekdays at 9 AM
    start_date: startDate,
    end_date: endDate,
    is_active: true,
    last_alert_time: null,
    ...overrides,
  };
}
```

### Step 1.4: Update package.json

Add test scripts to `server/package.json`:

```json
{
  "scripts": {
    "dev": "bun run --watch index.ts",
    "start": "bun run index.ts",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage"
  }
}
```

### Step 1.5: Create Directory Structure

```
server/
├── tests/
│   ├── setup.ts              # Test setup and database
│   ├── test-utils.ts         # Shared utilities and factories
│   ├── integration/          # API integration tests
│   │   ├── reminders.test.ts
│   │   └── webhooks.test.ts
│   └── unit/                 # Unit tests
│       ├── scheduler-helpers.test.ts
│       ├── schemas.test.ts
│       └── utils.test.ts
```

---

## Phase 2: API Integration Tests (CRITICAL)

### Goal
Test all REST endpoints to ensure they work correctly. This replaces manual Postman testing.

### Step 2.1: Refactor App for Testing

Modify `server/index.ts` to export the app instance:

```typescript
// At the end of index.ts, after all route definitions:
export { app };
```

Alternatively, create `server/src/app.ts` that contains the Elysia app setup and import it in both `index.ts` and tests.

### Step 2.2: Create Integration Test File

Create `server/tests/integration/reminders.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { app } from "../../index";

const API_KEY = process.env.APP_API_KEY || "test-api-key";

describe("Reminders API", () => {
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;

  beforeAll(async () => {
    // Start server on a random available port for testing
    server = app.listen(0);
    const address = server.hostname;
    const port = server.port;
    baseUrl = `http://${address}:${port}`;
  });

  afterAll(() => {
    server.stop();
  });

  // Helper function for API requests
  async function apiRequest(
    method: string,
    path: string,
    body?: object
  ): Promise<Response> {
    const options: RequestInit = {
      method,
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
      },
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    return fetch(`${baseUrl}${path}`, options);
  }

  describe("GET /reminders", () => {
    it("should return empty array when no reminders exist", async () => {
      const response = await apiRequest("GET", "/reminders");

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual([]);
    });

    it("should return 401 without API key", async () => {
      const response = await fetch(`${baseUrl}/reminders`);

      expect(response.status).toBe(401);
    });

    it("should only return active reminders", async () => {
      // Create an active reminder
      const activeReminder = {
        title: "Active Reminder",
        date: new Date(Date.now() + 86400000).toISOString(),
        description: "Active",
        reminders: [{ id: "1", mode: "email", address: "test@test.com" }],
        alerts: [{ id: "1", time: 3600000 }],
        is_recurring: false,
        is_active: true,
      };

      await apiRequest("POST", "/reminders", activeReminder);

      const response = await apiRequest("GET", "/reminders");
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data.every((r: any) => r.is_active === true)).toBe(true);
    });
  });

  describe("GET /reminders/all", () => {
    it("should return both active and inactive reminders", async () => {
      const response = await apiRequest("GET", "/reminders/all");

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe("POST /reminders", () => {
    it("should create a one-time reminder successfully", async () => {
      const newReminder = {
        title: "Test Reminder",
        date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        location: "Test Location",
        description: "Test Description",
        reminders: [
          { id: "mode-1", mode: "email", address: "test@example.com" }
        ],
        alerts: [
          { id: "alert-1", time: 3600000 } // 1 hour before
        ],
        is_recurring: false,
        recurrence: null,
        start_date: null,
        end_date: null,
      };

      const response = await apiRequest("POST", "/reminders", newReminder);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.title).toBe("Test Reminder");
      expect(data.is_active).toBe(true);
    });

    it("should create a recurring reminder successfully", async () => {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 30 * 86400000).toISOString();

      const newReminder = {
        title: "Daily Standup",
        date: startDate,
        description: "Team standup meeting",
        reminders: [
          { id: "mode-1", mode: "email", address: "team@example.com" }
        ],
        alerts: [
          { id: "alert-1", time: 900000 } // 15 min before
        ],
        is_recurring: true,
        recurrence: "0 9 * * 1-5", // Weekdays at 9 AM
        start_date: startDate,
        end_date: endDate,
      };

      const response = await apiRequest("POST", "/reminders", newReminder);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.is_recurring).toBe(true);
      expect(data.recurrence).toBe("0 9 * * 1-5");
    });

    it("should reject reminder with invalid email", async () => {
      const invalidReminder = {
        title: "Invalid Email Reminder",
        date: new Date(Date.now() + 86400000).toISOString(),
        description: "Test",
        reminders: [
          { id: "mode-1", mode: "email", address: "not-an-email" }
        ],
        alerts: [{ id: "alert-1", time: 3600000 }],
        is_recurring: false,
      };

      const response = await apiRequest("POST", "/reminders", invalidReminder);

      expect(response.status).toBe(400);
    });

    it("should reject reminder with alert time less than 3 seconds", async () => {
      const invalidReminder = {
        title: "Invalid Alert Time",
        date: new Date(Date.now() + 86400000).toISOString(),
        description: "Test",
        reminders: [
          { id: "mode-1", mode: "email", address: "test@example.com" }
        ],
        alerts: [{ id: "alert-1", time: 1000 }], // 1 second - too short
        is_recurring: false,
      };

      const response = await apiRequest("POST", "/reminders", invalidReminder);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /reminders/:id", () => {
    it("should return a specific reminder by ID", async () => {
      // First create a reminder
      const newReminder = {
        title: "Get By ID Test",
        date: new Date(Date.now() + 86400000).toISOString(),
        description: "Test",
        reminders: [{ id: "1", mode: "email", address: "test@test.com" }],
        alerts: [{ id: "1", time: 3600000 }],
        is_recurring: false,
      };

      const createResponse = await apiRequest("POST", "/reminders", newReminder);
      const created = await createResponse.json();

      // Then fetch it
      const response = await apiRequest("GET", `/reminders/${created.id}`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.title).toBe("Get By ID Test");
    });

    it("should return 404 for non-existent reminder", async () => {
      const response = await apiRequest("GET", "/reminders/99999");

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /reminders/:id", () => {
    it("should update an existing reminder", async () => {
      // Create a reminder
      const newReminder = {
        title: "Original Title",
        date: new Date(Date.now() + 86400000).toISOString(),
        description: "Original",
        reminders: [{ id: "1", mode: "email", address: "test@test.com" }],
        alerts: [{ id: "1", time: 3600000 }],
        is_recurring: false,
      };

      const createResponse = await apiRequest("POST", "/reminders", newReminder);
      const created = await createResponse.json();

      // Update it
      const updates = {
        ...newReminder,
        title: "Updated Title",
        description: "Updated description",
      };

      const response = await apiRequest("PUT", `/reminders/${created.id}`, updates);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.title).toBe("Updated Title");
      expect(data.description).toBe("Updated description");
    });

    it("should return 404 when updating non-existent reminder", async () => {
      const updates = {
        title: "Updated",
        date: new Date().toISOString(),
        description: "Test",
        reminders: [],
        alerts: [],
        is_recurring: false,
      };

      const response = await apiRequest("PUT", "/reminders/99999", updates);

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /reminders/:id", () => {
    it("should delete a reminder", async () => {
      // Create a reminder
      const newReminder = {
        title: "To Delete",
        date: new Date(Date.now() + 86400000).toISOString(),
        description: "Will be deleted",
        reminders: [{ id: "1", mode: "email", address: "test@test.com" }],
        alerts: [{ id: "1", time: 3600000 }],
        is_recurring: false,
      };

      const createResponse = await apiRequest("POST", "/reminders", newReminder);
      const created = await createResponse.json();

      // Delete it
      const response = await apiRequest("DELETE", `/reminders/${created.id}`);

      expect(response.status).toBe(200);

      // Verify it's gone
      const getResponse = await apiRequest("GET", `/reminders/${created.id}`);
      expect(getResponse.status).toBe(404);
    });

    it("should return 404 when deleting non-existent reminder", async () => {
      const response = await apiRequest("DELETE", "/reminders/99999");

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /reminders/bulk", () => {
    it("should delete multiple reminders by IDs", async () => {
      // Create multiple reminders
      const reminder1 = await apiRequest("POST", "/reminders", {
        title: "Bulk Delete 1",
        date: new Date(Date.now() + 86400000).toISOString(),
        description: "Test",
        reminders: [{ id: "1", mode: "email", address: "test@test.com" }],
        alerts: [{ id: "1", time: 3600000 }],
        is_recurring: false,
      });
      const reminder2 = await apiRequest("POST", "/reminders", {
        title: "Bulk Delete 2",
        date: new Date(Date.now() + 86400000).toISOString(),
        description: "Test",
        reminders: [{ id: "1", mode: "email", address: "test@test.com" }],
        alerts: [{ id: "1", time: 3600000 }],
        is_recurring: false,
      });

      const r1 = await reminder1.json();
      const r2 = await reminder2.json();

      // Bulk delete
      const response = await apiRequest(
        "DELETE",
        `/reminders/bulk?ids=${r1.id}&ids=${r2.id}`
      );

      expect(response.status).toBe(200);
    });
  });
});
```

### Step 2.3: Test Authentication

Create `server/tests/integration/auth.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../index";

describe("Authentication", () => {
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;

  beforeAll(async () => {
    server = app.listen(0);
    baseUrl = `http://${server.hostname}:${server.port}`;
  });

  afterAll(() => {
    server.stop();
  });

  it("should reject requests without API key", async () => {
    const response = await fetch(`${baseUrl}/reminders`);
    expect(response.status).toBe(401);
  });

  it("should reject requests with invalid API key", async () => {
    const response = await fetch(`${baseUrl}/reminders`, {
      headers: { "x-api-key": "invalid-key" },
    });
    expect(response.status).toBe(401);
  });

  it("should accept requests with valid API key", async () => {
    const response = await fetch(`${baseUrl}/reminders`, {
      headers: { "x-api-key": process.env.APP_API_KEY || "test-api-key" },
    });
    expect(response.status).toBe(200);
  });
});
```

---

## Phase 3: Unit Tests

### Goal
Test pure functions and helper utilities in isolation.

### Step 3.1: Schema Validation Tests

Create `server/tests/unit/schemas.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  reminderSchema,
  alertSchema,
  reminderModeSchema
} from "../../src/schemas";

describe("Reminder Schema Validation", () => {
  describe("alertSchema", () => {
    it("should accept valid alert with time >= 3000ms", () => {
      const result = alertSchema.safeParse({ id: "1", time: 3000 });
      expect(result.success).toBe(true);
    });

    it("should reject alert with time < 3000ms", () => {
      const result = alertSchema.safeParse({ id: "1", time: 2999 });
      expect(result.success).toBe(false);
    });
  });

  describe("reminderModeSchema", () => {
    it("should accept valid email mode", () => {
      const result = reminderModeSchema.safeParse({
        id: "1",
        mode: "email",
        address: "test@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid sms mode", () => {
      const result = reminderModeSchema.safeParse({
        id: "1",
        mode: "sms",
        address: "+1234567890",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email address", () => {
      const result = reminderModeSchema.safeParse({
        id: "1",
        mode: "email",
        address: "not-an-email",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid mode", () => {
      const result = reminderModeSchema.safeParse({
        id: "1",
        mode: "telegram", // Invalid
        address: "test",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("reminderSchema", () => {
    it("should accept valid one-time reminder", () => {
      const reminder = {
        title: "Test",
        date: new Date().toISOString(),
        description: "Description",
        reminders: [{ id: "1", mode: "email", address: "test@test.com" }],
        alerts: [{ id: "1", time: 3600000 }],
        is_recurring: false,
      };

      const result = reminderSchema.safeParse(reminder);
      expect(result.success).toBe(true);
    });

    it("should accept valid recurring reminder", () => {
      const reminder = {
        title: "Recurring Test",
        date: new Date().toISOString(),
        description: "Description",
        reminders: [{ id: "1", mode: "email", address: "test@test.com" }],
        alerts: [{ id: "1", time: 3600000 }],
        is_recurring: true,
        recurrence: "0 9 * * 1-5",
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 86400000).toISOString(),
      };

      const result = reminderSchema.safeParse(reminder);
      expect(result.success).toBe(true);
    });
  });
});
```

### Step 3.2: Scheduler Helper Tests

Create `server/tests/unit/scheduler-helpers.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  calculateNextEventTime
} from "../../src/scheduler/helpers/calculateNextEventTime";
import {
  getAlertsToFire
} from "../../src/scheduler/helpers/getAlertsToFire";
import {
  shouldDeactivateOneTime
} from "../../src/scheduler/helpers/shouldDeactivateOneTime";
import {
  shouldDeactivateRecurring
} from "../../src/scheduler/helpers/shouldDeactivateRecurring";
import {
  hasAlreadyAlertedForEvent
} from "../../src/scheduler/helpers/hasAlreadyAlertedForEvent";

describe("Scheduler Helpers", () => {
  describe("calculateNextEventTime", () => {
    it("should return the date for one-time reminders", () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const reminder = {
        id: 1,
        title: "Test",
        date: futureDate,
        is_recurring: false,
        recurrence: null,
        start_date: null,
        end_date: null,
        last_alert_time: null,
        is_active: true,
        description: "",
        location: null,
        reminders: [],
        alerts: [],
      };

      const result = calculateNextEventTime(reminder);
      expect(result).toBe(futureDate);
    });

    it("should calculate next occurrence for recurring reminders", () => {
      const now = new Date();
      const reminder = {
        id: 1,
        title: "Daily Test",
        date: now.toISOString(),
        is_recurring: true,
        recurrence: "0 9 * * *", // Every day at 9 AM
        start_date: now.toISOString(),
        end_date: new Date(Date.now() + 30 * 86400000).toISOString(),
        last_alert_time: null,
        is_active: true,
        description: "",
        location: null,
        reminders: [],
        alerts: [],
      };

      const result = calculateNextEventTime(reminder);
      expect(result).toBeDefined();
      expect(new Date(result!).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("getAlertsToFire", () => {
    it("should return alerts that should fire now", () => {
      const eventTime = Date.now() + 1800000; // 30 minutes from now
      const alerts = [
        { id: "1", time: 3600000 }, // 1 hour before - should NOT fire
        { id: "2", time: 1800000 }, // 30 min before - should fire
        { id: "3", time: 900000 },  // 15 min before - should NOT fire
      ];

      const result = getAlertsToFire(alerts, eventTime, null);

      // Alert 2 should fire (30 min before, and event is 30 min away)
      expect(result.some(a => a.id === "2")).toBe(true);
    });

    it("should not return alerts that have already fired", () => {
      const eventTime = Date.now() + 1800000;
      const lastAlertTime = new Date(Date.now() - 60000).toISOString(); // 1 min ago
      const alerts = [
        { id: "1", time: 1800000 },
      ];

      const result = getAlertsToFire(alerts, eventTime, lastAlertTime);
      expect(result).toHaveLength(0);
    });
  });

  describe("shouldDeactivateOneTime", () => {
    it("should return true when reminder date has passed", () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
      const reminder = {
        id: 1,
        date: pastDate,
        is_recurring: false,
        is_active: true,
        alerts: [],
        // ... other required fields
      };

      const result = shouldDeactivateOneTime(reminder as any);
      expect(result).toBe(true);
    });

    it("should return false when reminder date is in future", () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const reminder = {
        id: 1,
        date: futureDate,
        is_recurring: false,
        is_active: true,
        alerts: [{ id: "1", time: 3600000 }],
        // ... other required fields
      };

      const result = shouldDeactivateOneTime(reminder as any);
      expect(result).toBe(false);
    });
  });

  describe("shouldDeactivateRecurring", () => {
    it("should return true when end_date has passed", () => {
      const pastEndDate = new Date(Date.now() - 86400000).toISOString();
      const reminder = {
        id: 1,
        is_recurring: true,
        end_date: pastEndDate,
        is_active: true,
        // ... other required fields
      };

      const result = shouldDeactivateRecurring(reminder as any);
      expect(result).toBe(true);
    });

    it("should return false when end_date is in future", () => {
      const futureEndDate = new Date(Date.now() + 86400000).toISOString();
      const reminder = {
        id: 1,
        is_recurring: true,
        end_date: futureEndDate,
        is_active: true,
        recurrence: "0 9 * * *",
        start_date: new Date().toISOString(),
        // ... other required fields
      };

      const result = shouldDeactivateRecurring(reminder as any);
      expect(result).toBe(false);
    });
  });

  describe("hasAlreadyAlertedForEvent", () => {
    it("should return true if last_alert_time matches event time", () => {
      const eventTime = "2024-01-15T09:00:00.000Z";
      const lastAlertTime = "2024-01-15T08:00:00.000Z"; // Alert 1 hour before
      const alert = { id: "1", time: 3600000 }; // 1 hour

      const result = hasAlreadyAlertedForEvent(eventTime, lastAlertTime, alert);
      expect(result).toBe(true);
    });

    it("should return false if no previous alert", () => {
      const eventTime = "2024-01-15T09:00:00.000Z";
      const alert = { id: "1", time: 3600000 };

      const result = hasAlreadyAlertedForEvent(eventTime, null, alert);
      expect(result).toBe(false);
    });
  });
});
```

### Step 3.3: Utility Function Tests

Create `server/tests/unit/utils.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
// Import your utility functions from src/utils.ts

describe("Utility Functions", () => {
  describe("Date Utilities", () => {
    it("should correctly parse ISO date strings", () => {
      const dateStr = "2024-01-15T09:00:00.000Z";
      const date = new Date(dateStr);
      expect(date.getUTCHours()).toBe(9);
      expect(date.getUTCMonth()).toBe(0); // January
    });
  });

  // Add more utility function tests based on your src/utils.ts
});
```

---

## Phase 4: Repository Tests

### Goal
Test database operations in isolation using an in-memory SQLite database.

### Step 4.1: Repository Tests

Create `server/tests/unit/repository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { SQLiteReminderRepository } from "../../src/repositories/sqlite-reminder-repository";

describe("SQLiteReminderRepository", () => {
  let db: Database;
  let repository: SQLiteReminderRepository;

  beforeEach(() => {
    // Create fresh in-memory database for each test
    db = new Database(":memory:");
    db.run(`
      CREATE TABLE reminders (
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
    repository = new SQLiteReminderRepository(db);
  });

  describe("create", () => {
    it("should create a reminder and return it with an ID", () => {
      const reminder = {
        title: "Test Reminder",
        date: new Date().toISOString(),
        description: "Test",
        location: null,
        reminders: [{ id: "1", mode: "email" as const, address: "test@test.com" }],
        alerts: [{ id: "1", time: 3600000 }],
        is_recurring: false,
        recurrence: null,
        start_date: null,
        end_date: null,
        is_active: true,
        last_alert_time: null,
      };

      const result = repository.create(reminder);

      expect(result.id).toBeDefined();
      expect(result.title).toBe("Test Reminder");
    });
  });

  describe("findById", () => {
    it("should return reminder by ID", () => {
      const reminder = {
        title: "Find Me",
        date: new Date().toISOString(),
        description: "Test",
        location: null,
        reminders: [],
        alerts: [],
        is_recurring: false,
        recurrence: null,
        start_date: null,
        end_date: null,
        is_active: true,
        last_alert_time: null,
      };

      const created = repository.create(reminder);
      const found = repository.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.title).toBe("Find Me");
    });

    it("should return null for non-existent ID", () => {
      const found = repository.findById(99999);
      expect(found).toBeNull();
    });
  });

  describe("findActive", () => {
    it("should only return active reminders", () => {
      // Create active reminder
      repository.create({
        title: "Active",
        date: new Date().toISOString(),
        description: "",
        location: null,
        reminders: [],
        alerts: [],
        is_recurring: false,
        recurrence: null,
        start_date: null,
        end_date: null,
        is_active: true,
        last_alert_time: null,
      });

      // Create and deactivate reminder
      const inactive = repository.create({
        title: "Inactive",
        date: new Date().toISOString(),
        description: "",
        location: null,
        reminders: [],
        alerts: [],
        is_recurring: false,
        recurrence: null,
        start_date: null,
        end_date: null,
        is_active: true,
        last_alert_time: null,
      });
      repository.deactivate(inactive.id);

      const activeReminders = repository.findActive();

      expect(activeReminders.length).toBe(1);
      expect(activeReminders[0].title).toBe("Active");
    });
  });

  describe("update", () => {
    it("should update reminder fields", () => {
      const created = repository.create({
        title: "Original",
        date: new Date().toISOString(),
        description: "Original description",
        location: null,
        reminders: [],
        alerts: [],
        is_recurring: false,
        recurrence: null,
        start_date: null,
        end_date: null,
        is_active: true,
        last_alert_time: null,
      });

      const updated = repository.update(created.id, {
        ...created,
        title: "Updated",
        description: "Updated description",
      });

      expect(updated?.title).toBe("Updated");
      expect(updated?.description).toBe("Updated description");
    });
  });

  describe("delete", () => {
    it("should delete a reminder", () => {
      const created = repository.create({
        title: "To Delete",
        date: new Date().toISOString(),
        description: "",
        location: null,
        reminders: [],
        alerts: [],
        is_recurring: false,
        recurrence: null,
        start_date: null,
        end_date: null,
        is_active: true,
        last_alert_time: null,
      });

      const result = repository.delete(created.id);
      expect(result).toBe(true);

      const found = repository.findById(created.id);
      expect(found).toBeNull();
    });

    it("should return false for non-existent reminder", () => {
      const result = repository.delete(99999);
      expect(result).toBe(false);
    });
  });

  describe("deactivate", () => {
    it("should set is_active to false", () => {
      const created = repository.create({
        title: "To Deactivate",
        date: new Date().toISOString(),
        description: "",
        location: null,
        reminders: [],
        alerts: [],
        is_recurring: false,
        recurrence: null,
        start_date: null,
        end_date: null,
        is_active: true,
        last_alert_time: null,
      });

      repository.deactivate(created.id);
      const found = repository.findById(created.id);

      expect(found?.is_active).toBe(false);
    });
  });
});
```

---

## Phase 5: Webhook Tests

### Goal
Test webhook endpoints that receive callbacks from QStash.

### Step 5.1: Webhook Handler Tests

Create `server/tests/integration/webhooks.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, mock } from "bun:test";
import { app } from "../../index";

describe("Webhook Endpoints", () => {
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;

  beforeAll(async () => {
    server = app.listen(0);
    baseUrl = `http://${server.hostname}:${server.port}`;
  });

  afterAll(() => {
    server.stop();
  });

  describe("POST /webhooks/reminder-alert", () => {
    it("should process valid webhook payload", async () => {
      // Note: In production, this would be verified with QStash signature
      // For testing, you may need to mock the verification
      const payload = {
        reminderId: 1,
        alertId: "alert-1",
        eventTime: new Date().toISOString(),
      };

      const response = await fetch(`${baseUrl}/webhooks/reminder-alert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Add mock QStash headers if needed
        },
        body: JSON.stringify(payload),
      });

      // Response depends on your implementation
      // Could be 200 OK or specific status
      expect([200, 202, 401]).toContain(response.status);
    });
  });

  describe("POST /webhooks/cleanup", () => {
    it("should trigger cleanup process", async () => {
      const response = await fetch(`${baseUrl}/webhooks/cleanup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Response depends on verification requirements
      expect([200, 202, 401]).toContain(response.status);
    });
  });
});
```

---

## Phase 6: CI/CD Integration

### Goal
Automate test execution on every code change.

### Step 6.1: GitHub Actions Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: |
          cd server
          bun install

      - name: Run tests
        run: |
          cd server
          bun test
        env:
          APP_API_KEY: test-api-key
          APP_PORT: 8080

      - name: Run tests with coverage
        run: |
          cd server
          bun test --coverage
```

### Step 6.2: Pre-commit Hook (Optional)

Create `.husky/pre-commit` (if using Husky):

```bash
#!/bin/sh
cd server && bun test
```

Or add to `package.json`:

```json
{
  "scripts": {
    "precommit": "bun test"
  }
}
```

---

## Running Tests

### Commands

```bash
# Run all tests
cd server && bun test

# Run tests in watch mode (re-runs on file changes)
cd server && bun test --watch

# Run tests with coverage report
cd server && bun test --coverage

# Run specific test file
cd server && bun test tests/integration/reminders.test.ts

# Run tests matching a pattern
cd server && bun test --test-name-pattern "create"
```

---

## Best Practices & Recommendations

### 1. Test Isolation
- Each test should be independent and not rely on other tests
- Use `beforeEach` to reset database state between tests
- Use in-memory SQLite database for fast, isolated tests

### 2. Test Data Factories
- Create factory functions (like `createSampleReminder`) for test data
- Factories make tests more readable and maintainable
- Allow easy customization via parameter overrides

### 3. Test Naming Convention
- Use descriptive test names: `"should return 404 for non-existent reminder"`
- Group related tests with `describe` blocks
- Follow the pattern: `"should [expected behavior] when [condition]"`

### 4. Test Coverage Goals
- Aim for 80%+ coverage on critical paths (API endpoints, scheduler)
- 100% coverage is not necessary - focus on behavior, not lines
- Prioritize integration tests over unit tests for APIs

### 5. Continuous Testing
- Run tests automatically on every commit (CI/CD)
- Consider running tests in watch mode during development
- Block merges if tests fail

### 6. Mock External Services
- Mock email sending (SendGrid/Mailtrap) in tests
- Mock QStash API calls
- Use environment variables to detect test environment

### 7. Test Environment Configuration

Create a `.env.test` file:

```env
APP_API_KEY=test-api-key
APP_PORT=0
USE_POLLING=true
MAIL_SERVICE=mock
```

---

## Implementation Checklist

- [ ] **Phase 1**: Set up test configuration and utilities
- [ ] **Phase 2**: Implement all API integration tests
- [ ] **Phase 3**: Add unit tests for pure functions
- [ ] **Phase 4**: Add repository tests
- [ ] **Phase 5**: Add webhook handler tests
- [ ] **Phase 6**: Set up CI/CD pipeline

---

## Notes on Playwright

**Playwright is NOT recommended for this backend API project** because:
- Playwright is designed for browser-based end-to-end testing
- Your server exposes a REST API, not a web UI
- API integration tests (Phase 2) serve the same purpose as E2E tests for APIs

**However**, if you want to test your **React client** (`/client`):
- Playwright would be excellent for testing user flows
- You could test the complete flow: UI → API → Database → UI updates
- This would be a separate testing effort for the frontend

---

## Questions to Consider

1. **Email Testing**: Do you want tests to actually send emails, or should they be mocked?
2. **QStash Testing**: Do you have a staging QStash environment for integration testing?
3. **Database**: Do you want to use the actual database file for some tests, or always in-memory?
4. **Coverage Threshold**: What minimum coverage percentage do you want to enforce?
