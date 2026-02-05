import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { app } from "../../index";
import { getSessionCookie, sessionHeaders, createSampleReminder, createRecurringReminder } from "../test-utils";

describe("Reminders API", () => {
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;
  let testDb: Database;
  let cookie: string;

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const address = server.server?.hostname || "localhost";
    const port = server.server?.port || 8080;
    baseUrl = `http://${address}:${port}`;

    // Connect to the actual test database for cleanup
    testDb = new Database("reminders.db");

    // Obtain a session cookie for authenticated requests
    cookie = await getSessionCookie(baseUrl);
  });

  afterAll(() => {
    server.stop();
    testDb.close();
  });

  beforeEach(() => {
    try {
      testDb.run("DELETE FROM reminders");
    } catch (e) {
      // Table might not exist yet
    }
  });

  // Helper function for API requests
  async function apiRequest(
    method: string,
    path: string,
    body?: object,
  ): Promise<Response> {
    const options: RequestInit = {
      method,
      headers: sessionHeaders(cookie),
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

    it("should return 401 without session", async () => {
      const response = await fetch(`${baseUrl}/reminders`);

      expect(response.status).toBe(401);
    });

    it("should only return active reminders", async () => {
      const activeReminder = {
        title: "Active Reminder",
        date: new Date(Date.now() + 86400000).toISOString(),
        description: "Active",
        reminders: [{ id: "1", mode: "email" as const, address: "test@test.com" }],
        alerts: [{ id: "1", time: 3600000 }],
        is_recurring: false,
      };

      await apiRequest("POST", "/reminders", activeReminder);

      const response = await apiRequest("GET", "/reminders");
      const data = (await response.json()) as { is_active: boolean }[];

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data.every((r) => r.is_active === true)).toBe(true);
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
        date: new Date(Date.now() + 86400000).toISOString(),
        location: "Test Location",
        description: "Test Description",
        reminders: [
          { id: "mode-1", mode: "email" as const, address: "test@example.com" }
        ],
        alerts: [
          { id: "alert-1", time: 3600000 }
        ],
        is_recurring: false,
        recurrence: null,
        start_date: null,
        end_date: null,
      };

      const response = await apiRequest("POST", "/reminders", newReminder);

      expect(response.status).toBe(201);
      const data = (await response.json()) as { id: number; title: string };
      expect(data.id).toBeDefined();
      expect(data.title).toBe("Test Reminder");
    });

    it("should create a recurring reminder successfully", async () => {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 30 * 86400000).toISOString();

      const newReminder = {
        title: "Daily Standup",
        date: startDate,
        description: "Team standup meeting",
        reminders: [
          { id: "mode-1", mode: "email" as const, address: "team@example.com" }
        ],
        alerts: [
          { id: "alert-1", time: 900000 }
        ],
        is_recurring: true,
        recurrence: "0 9 * * 1-5",
        start_date: startDate,
        end_date: endDate,
      };

      const response = await apiRequest("POST", "/reminders", newReminder);

      expect(response.status).toBe(201);
      const data = (await response.json()) as { is_recurring: boolean; recurrence: string };
      expect(data.is_recurring).toBe(true);
      expect(data.recurrence).toBe("0 9 * * 1-5");
    });

    it("should accept reminder with non-standard email format", async () => {
      const reminderWithCustomFormat = {
        title: "Custom Email Format",
        date: new Date(Date.now() + 86400000).toISOString(),
        description: "Test",
        reminders: [
          { id: "mode-1", mode: "email" as const, address: "not-an-email" }
        ],
        alerts: [{ id: "alert-1", time: 3600000 }],
        is_recurring: false,
      };

      const response = await apiRequest("POST", "/reminders", reminderWithCustomFormat);

      expect(response.status).toBe(201);
      const data = (await response.json()) as { id: number };
      expect(data.id).toBeDefined();
    });
  });

  describe("GET /reminders/:id", () => {
    it("should return a specific reminder by ID", async () => {
      const newReminder = {
        title: "Get By ID Test",
        date: new Date(Date.now() + 86400000).toISOString(),
        description: "Test",
        reminders: [{ id: "1", mode: "email" as const, address: "test@test.com" }],
        alerts: [{ id: "1", time: 3600000 }],
        is_recurring: false,
      };

      const createResponse = await apiRequest("POST", "/reminders", newReminder);
      const created = (await createResponse.json()) as { id: number };

      const response = await apiRequest("GET", `/reminders/${created.id}`);

      expect(response.status).toBe(200);
      const data = (await response.json()) as { id: number; title: string };
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
      const newReminder = {
        title: "Original Title",
        date: new Date(Date.now() + 86400000).toISOString(),
        description: "Original",
        reminders: [{ id: "1", mode: "email" as const, address: "test@test.com" }],
        alerts: [{ id: "1", time: 3600000 }],
        is_recurring: false,
      };

      const createResponse = await apiRequest("POST", "/reminders", newReminder);
      const created = (await createResponse.json()) as { id: number };

      const updates = {
        ...newReminder,
        title: "Updated Title",
        description: "Updated description",
      };

      const response = await apiRequest("PUT", `/reminders/${created.id}`, updates);

      expect(response.status).toBe(200);
      const data = (await response.json()) as { title: string; description: string };
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
      const newReminder = {
        title: "To Delete",
        date: new Date(Date.now() + 86400000).toISOString(),
        description: "Will be deleted",
        reminders: [{ id: "1", mode: "email" as const, address: "test@test.com" }],
        alerts: [{ id: "1", time: 3600000 }],
        is_recurring: false,
      };

      const createResponse = await apiRequest("POST", "/reminders", newReminder);
      const created = (await createResponse.json()) as { id: number };

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
      const reminder1 = await apiRequest("POST", "/reminders", {
        title: "Bulk Delete 1",
        date: new Date(Date.now() + 86400000).toISOString(),
        description: "Test",
        reminders: [{ id: "1", mode: "email" as const, address: "test@test.com" }],
        alerts: [{ id: "1", time: 3600000 }],
        is_recurring: false,
      });
      const reminder2 = await apiRequest("POST", "/reminders", {
        title: "Bulk Delete 2",
        date: new Date(Date.now() + 86400000).toISOString(),
        description: "Test",
        reminders: [{ id: "1", mode: "email" as const, address: "test@test.com" }],
        alerts: [{ id: "1", time: 3600000 }],
        is_recurring: false,
      });

      const r1 = (await reminder1.json()) as { id: number };
      const r2 = (await reminder2.json()) as { id: number };

      const response = await apiRequest(
        "DELETE",
        `/reminders/bulk?ids=${r1.id}&ids=${r2.id}`,
      );

      expect(response.status).toBe(200);
    });
  });
});
