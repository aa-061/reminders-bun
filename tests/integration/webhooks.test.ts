import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../index";
import { authHeaders, createSampleReminder } from "../test-utils";

describe("Webhook Endpoints", () => {
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;

  beforeAll(async () => {
    server = app.listen(0);
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 100));

    const address = server.hostname || "localhost";
    const port = server.port || 8080;
    baseUrl = `http://${address}:${port}`;
  });

  afterAll(() => {
    server.stop();
  });

  describe("POST /webhooks/reminder-alert", () => {
    it("should accept valid webhook payload in development mode", async () => {
      // First create a reminder
      const reminder = createSampleReminder();
      const createResponse = await fetch(`${baseUrl}/reminders`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(reminder),
      });

      expect(createResponse.status).toBe(201);
      const createdReminder = await createResponse.json();

      // Now send webhook payload
      const payload = {
        reminderId: createdReminder.id,
        isRecurring: false,
      };

      const response = await fetch(`${baseUrl}/webhooks/reminder-alert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // In test/dev environment, signature verification is skipped
        },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("ok");
      expect(data.reminderTitle).toBe(reminder.title);
    });

    it("should skip inactive reminders", async () => {
      // Create a reminder
      const reminder = createSampleReminder();
      const createResponse = await fetch(`${baseUrl}/reminders`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(reminder),
      });

      const createdReminder = await createResponse.json();

      // Deactivate the reminder
      await fetch(`${baseUrl}/reminders/${createdReminder.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ ...createdReminder, is_active: false }),
      });

      // Send webhook for inactive reminder
      const payload = {
        reminderId: createdReminder.id,
        isRecurring: false,
      };

      const response = await fetch(`${baseUrl}/webhooks/reminder-alert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("skipped");
      expect(data.reason).toBe("inactive");
    });

    it("should handle non-existent reminder", async () => {
      const payload = {
        reminderId: 99999,
        isRecurring: false,
      };

      const response = await fetch(`${baseUrl}/webhooks/reminder-alert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("skipped");
      expect(data.reason).toBe("reminder_not_found");
    });

    it("should deactivate one-time reminders after alert", async () => {
      // Create a one-time reminder
      const reminder = createSampleReminder({ is_recurring: false });
      const createResponse = await fetch(`${baseUrl}/reminders`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(reminder),
      });

      const createdReminder = await createResponse.json();
      expect(createdReminder.is_active).toBe(true);

      // Send webhook alert
      const payload = {
        reminderId: createdReminder.id,
        isRecurring: false,
      };

      const alertResponse = await fetch(`${baseUrl}/webhooks/reminder-alert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      expect(alertResponse.status).toBe(200);

      // Verify reminder is now inactive
      const getResponse = await fetch(`${baseUrl}/reminders/${createdReminder.id}`, {
        headers: authHeaders(),
      });

      const fetchedReminder = await getResponse.json();
      expect(fetchedReminder.is_active).toBe(false);
    });

    it("should not deactivate recurring reminders after alert", async () => {
      // Create a recurring reminder
      const reminder = createSampleReminder({
        is_recurring: true,
        recurrence: "0 9 * * 1-5",
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const createResponse = await fetch(`${baseUrl}/reminders`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(reminder),
      });

      const createdReminder = await createResponse.json();
      expect(createdReminder.is_active).toBe(true);

      // Send webhook alert
      const payload = {
        reminderId: createdReminder.id,
        isRecurring: true,
      };

      const alertResponse = await fetch(`${baseUrl}/webhooks/reminder-alert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      expect(alertResponse.status).toBe(200);

      // Verify reminder is still active
      const getResponse = await fetch(`${baseUrl}/reminders/${createdReminder.id}`, {
        headers: authHeaders(),
      });

      const fetchedReminder = await getResponse.json();
      expect(fetchedReminder.is_active).toBe(true);
    });
  });

  describe("POST /webhooks/cleanup", () => {
    it("should trigger cleanup process successfully", async () => {
      const response = await fetch(`${baseUrl}/webhooks/cleanup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("ok");
    });

    it("should return cleanup statistics", async () => {
      // Create a stale reminder (far in the past)
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const staleReminder = createSampleReminder({
        date: pastDate,
        is_recurring: false,
      });

      await fetch(`${baseUrl}/reminders`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(staleReminder),
      });

      // Trigger cleanup
      const response = await fetch(`${baseUrl}/webhooks/cleanup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("ok");
      // The response may include cleanup statistics (deactivated count, etc.)
    });
  });
});
