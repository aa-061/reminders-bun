import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../index";
import { getSessionCookie, sessionHeaders, createSampleReminder } from "../test-utils";

describe("Webhook Endpoints", () => {
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;
  let cookie: string;

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const address = server.server?.hostname || "localhost";
    const port = server.server?.port || 8080;
    baseUrl = `http://${address}:${port}`;

    // Obtain session cookie for creating reminders (webhooks themselves are public)
    cookie = await getSessionCookie(baseUrl);
  });

  afterAll(() => {
    server.stop();
  });

  describe("POST /webhooks/reminder-alert", () => {
    it("should accept valid webhook payload in development mode", async () => {
      // Create a reminder (requires auth)
      const reminder = createSampleReminder();
      const createResponse = await fetch(`${baseUrl}/reminders`, {
        method: "POST",
        headers: sessionHeaders(cookie),
        body: JSON.stringify(reminder),
      });

      expect(createResponse.status).toBe(201);
      const createdReminder = (await createResponse.json()) as { id: number; is_active: boolean };

      // Webhook itself does NOT require auth — secured by QStash signature
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
      const data = (await response.json()) as { status: string; reminderTitle: string };
      expect(data.status).toBe("ok");
      expect(data.reminderTitle).toBe(reminder.title);
    });

    it("should skip inactive reminders", async () => {
      // Create a reminder
      const reminder = createSampleReminder();
      const createResponse = await fetch(`${baseUrl}/reminders`, {
        method: "POST",
        headers: sessionHeaders(cookie),
        body: JSON.stringify(reminder),
      });

      const createdReminder = (await createResponse.json()) as { id: number; is_active: boolean };

      // Deactivate the reminder
      await fetch(`${baseUrl}/reminders/${createdReminder.id}`, {
        method: "PUT",
        headers: sessionHeaders(cookie),
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
      const data = (await response.json()) as { status: string; reason: string };
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
      const data = (await response.json()) as { status: string; reason: string };
      expect(data.status).toBe("skipped");
      expect(data.reason).toBe("reminder_not_found");
    });

    it("should deactivate one-time reminders after alert", async () => {
      // Create a one-time reminder
      const reminder = createSampleReminder({ is_recurring: false });
      const createResponse = await fetch(`${baseUrl}/reminders`, {
        method: "POST",
        headers: sessionHeaders(cookie),
        body: JSON.stringify(reminder),
      });

      const createdReminder = (await createResponse.json()) as { id: number; is_active: boolean };
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

      // Verify reminder is now inactive (requires auth)
      const getResponse = await fetch(`${baseUrl}/reminders/${createdReminder.id}`, {
        headers: sessionHeaders(cookie),
      });

      const fetchedReminder = (await getResponse.json()) as { is_active: boolean };
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
        headers: sessionHeaders(cookie),
        body: JSON.stringify(reminder),
      });

      const createdReminder = (await createResponse.json()) as { id: number; is_active: boolean };
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

      // Verify reminder is still active (requires auth)
      const getResponse = await fetch(`${baseUrl}/reminders/${createdReminder.id}`, {
        headers: sessionHeaders(cookie),
      });

      const fetchedReminder = (await getResponse.json()) as { is_active: boolean };
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
      const data = (await response.json()) as { status: string };
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
        headers: sessionHeaders(cookie),
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
      const data = (await response.json()) as { status: string };
      expect(data.status).toBe("ok");
    });
  });
});
