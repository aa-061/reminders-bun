import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { calculateNextEventTime } from "../../src/scheduler/helpers/calculateNextEventTime";
import { getAlertsToFire } from "../../src/scheduler/helpers/getAlertsToFire";
import { shouldDeactivateOneTime } from "../../src/scheduler/helpers/shouldDeactivateOneTime";
import { shouldDeactivateRecurring } from "../../src/scheduler/helpers/shouldDeactivateRecurring";
import { hasAlreadyAlertedForEvent } from "../../src/scheduler/helpers/hasAlreadyAlertedForEvent";
import type { TReminder } from "../../src/schemas";

describe("Scheduler Helpers", () => {
  describe("calculateNextEventTime", () => {
    it("should return the date for one-time reminders", () => {
      const futureDate = new Date(Date.now() + 86400000);
      const futureISO = futureDate.toISOString();
      const now = new Date();
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: futureISO,
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

      const result = calculateNextEventTime(reminder, now);
      expect(result).not.toBeNull();
      expect(result?.getTime()).toBe(futureDate.getTime());
    });

    it("should calculate next occurrence for recurring reminders", () => {
      const now = new Date();
      const reminder: TReminder = {
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

      const result = calculateNextEventTime(reminder, now);
      expect(result).not.toBeNull();
      expect(result!.getTime()).toBeGreaterThan(now.getTime());
    });

    it("should handle recurring reminders with weekday cron", () => {
      const now = new Date();
      const reminder: TReminder = {
        id: 1,
        title: "Weekday Task",
        date: now.toISOString(),
        is_recurring: true,
        recurrence: "0 9 * * 1-5", // Weekdays at 9 AM
        start_date: now.toISOString(),
        end_date: new Date(Date.now() + 30 * 86400000).toISOString(),
        last_alert_time: null,
        is_active: true,
        description: "",
        location: null,
        reminders: [],
        alerts: [],
      };

      const result = calculateNextEventTime(reminder, now);
      expect(result).not.toBeNull();
      expect(result!.getTime()).toBeGreaterThan(now.getTime());
    });

    it("should return null for invalid cron expression", () => {
      const now = new Date();
      const reminder: TReminder = {
        id: 1,
        title: "Invalid Cron",
        date: now.toISOString(),
        is_recurring: true,
        recurrence: "invalid cron",
        start_date: now.toISOString(),
        end_date: new Date(Date.now() + 30 * 86400000).toISOString(),
        last_alert_time: null,
        is_active: true,
        description: "",
        location: null,
        reminders: [],
        alerts: [],
      };

      // Suppress console error since we expect the cron parser to fail
      const originalError = console.error;
      console.error = () => {};

      const result = calculateNextEventTime(reminder, now);

      // Restore console.error
      console.error = originalError;

      expect(result).toBeNull();
    });

    it("should handle non-recurring reminder with null recurrence", () => {
      const futureDate = new Date(Date.now() + 86400000);
      const futureISO = futureDate.toISOString();
      const now = new Date();
      const reminder: TReminder = {
        id: 1,
        title: "One-time",
        date: futureISO,
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

      const result = calculateNextEventTime(reminder, now);
      expect(result?.getTime()).toBeCloseTo(futureDate.getTime(), 0);
    });
  });

  describe("getAlertsToFire", () => {
    it("should return alert that should fire now", () => {
      const now = new Date();
      const eventTime = new Date(now.getTime() + 1800000); // 30 minutes from now
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: eventTime.toISOString(),
        is_recurring: false,
        recurrence: null,
        start_date: null,
        end_date: null,
        last_alert_time: null,
        is_active: true,
        description: "",
        location: null,
        reminders: [{ id: "1", mode: "email", address: "test@test.com" }],
        alerts: [{ id: "2", time: 1800000 }], // 30 min before - alert fires at now
      };

      const result = getAlertsToFire(reminder, eventTime, now, 3000);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].id).toBe("2");
    });

    it("should not return alert that is too far in future", () => {
      const now = new Date();
      const eventTime = new Date(now.getTime() + 7200000); // 2 hours from now
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: eventTime.toISOString(),
        is_recurring: false,
        recurrence: null,
        start_date: null,
        end_date: null,
        last_alert_time: null,
        is_active: true,
        description: "",
        location: null,
        reminders: [{ id: "1", mode: "email", address: "test@test.com" }],
        alerts: [{ id: "1", time: 3600000 }], // 1 hour before - alert at now + 1 hour
      };

      const result = getAlertsToFire(reminder, eventTime, now, 3000);
      // Alert time = eventTime - 3600000 = now + 2 hours - 1 hour = now + 1 hour
      // diff = now - (now + 1 hour) = negative, so no alert fires
      expect(result.length).toBe(0);
    });

    it("should not return alert that has already fired for recurring reminder", () => {
      const now = new Date();
      const eventTime = new Date(now.getTime() + 1800000); // 30 minutes from now
      const alertTime = new Date(now.getTime()); // Alert fires at now
      const lastAlertTime = new Date(alertTime.getTime() + 100).toISOString(); // Already alerted
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: eventTime.toISOString(),
        is_recurring: true,
        recurrence: "0 9 * * *",
        start_date: now.toISOString(),
        end_date: new Date(Date.now() + 86400000).toISOString(),
        last_alert_time: lastAlertTime,
        is_active: true,
        description: "",
        location: null,
        reminders: [{ id: "1", mode: "email", address: "test@test.com" }],
        alerts: [{ id: "1", time: 1800000 }],
      };

      const result = getAlertsToFire(reminder, eventTime, now, 3000);
      // Alert time = now + 1800000 - 1800000 = now
      // lastAlertTime >= alertTime? yes (lastAlertTime is after now)
      // So hasAlreadyAlertedForEvent returns true, alert won't fire
      expect(result.length).toBe(0);
    });

    it("should return only one alert per cycle", () => {
      const now = new Date();
      const eventTime = new Date(now.getTime() + 1800000);
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: eventTime.toISOString(),
        is_recurring: false,
        recurrence: null,
        start_date: null,
        end_date: null,
        last_alert_time: null,
        is_active: true,
        description: "",
        location: null,
        reminders: [{ id: "1", mode: "email", address: "test@test.com" }],
        alerts: [
          { id: "1", time: 3600000 }, // 1 hour before
          { id: "2", time: 1800000 }, // 30 min before - should fire
          { id: "3", time: 900000 },  // 15 min before
        ],
      };

      const result = getAlertsToFire(reminder, eventTime, now, 3000);
      expect(result.length).toBe(1); // Only one alert
    });

    it("should respect stale threshold", () => {
      const now = new Date();
      const eventTime = new Date(now.getTime() - 62 * 60 * 1000); // Past due by over 1 hour
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: eventTime.toISOString(),
        is_recurring: false,
        recurrence: null,
        start_date: null,
        end_date: null,
        last_alert_time: null,
        is_active: true,
        description: "",
        location: null,
        reminders: [{ id: "1", mode: "email", address: "test@test.com" }],
        alerts: [{ id: "1", time: 3600000 }],
      };

      const result = getAlertsToFire(reminder, eventTime, now, 3000);
      // Should not fire because it's stale (past by > 1 hour)
      expect(result.length).toBe(0);
    });
  });

  describe("shouldDeactivateOneTime", () => {
    it("should deactivate when already alerted", () => {
      const now = new Date();
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: now.toISOString(),
        is_recurring: false,
        recurrence: null,
        start_date: null,
        end_date: null,
        last_alert_time: new Date(now.getTime() - 60000).toISOString(),
        is_active: true,
        description: "",
        location: null,
        reminders: [],
        alerts: [],
      };

      const result = shouldDeactivateOneTime(reminder, now);
      expect(result.shouldDeactivate).toBe(true);
      expect(result.reason).toContain("already alerted");
    });

    it("should not deactivate when reminder is in future", () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 86400000);
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: futureDate.toISOString(),
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

      const result = shouldDeactivateOneTime(reminder, now);
      expect(result.shouldDeactivate).toBe(false);
    });

    it("should deactivate when reminder is stale (>1 hour)", () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 62 * 60 * 1000); // 62 minutes ago
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: pastDate.toISOString(),
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

      const result = shouldDeactivateOneTime(reminder, now);
      expect(result.shouldDeactivate).toBe(true);
      expect(result.reason).toContain("stale");
    });

    it("should not deactivate when reminder is recently past", () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: pastDate.toISOString(),
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

      const result = shouldDeactivateOneTime(reminder, now);
      expect(result.shouldDeactivate).toBe(false);
    });
  });

  describe("shouldDeactivateRecurring", () => {
    it("should not deactivate when next event is before end_date", () => {
      const now = new Date();
      const nextEventTime = new Date(now.getTime() + 86400000); // Tomorrow
      const endDate = new Date(now.getTime() + 7 * 86400000); // 7 days from now
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: now.toISOString(),
        is_recurring: true,
        recurrence: "0 9 * * 1-5",
        start_date: now.toISOString(),
        end_date: endDate.toISOString(),
        last_alert_time: null,
        is_active: true,
        description: "",
        location: null,
        reminders: [],
        alerts: [],
      };

      const result = shouldDeactivateRecurring(reminder, nextEventTime);
      expect(result.shouldDeactivate).toBe(false);
    });

    it("should deactivate when next event exceeds end_date", () => {
      const now = new Date();
      const nextEventTime = new Date(now.getTime() + 8 * 86400000); // 8 days from now
      const endDate = new Date(now.getTime() + 7 * 86400000); // 7 days from now
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: now.toISOString(),
        is_recurring: true,
        recurrence: "0 9 * * 1-5",
        start_date: now.toISOString(),
        end_date: endDate.toISOString(),
        last_alert_time: null,
        is_active: true,
        description: "",
        location: null,
        reminders: [],
        alerts: [],
      };

      const result = shouldDeactivateRecurring(reminder, nextEventTime);
      expect(result.shouldDeactivate).toBe(true);
      expect(result.reason).toContain("exceeds end_date");
    });

    it("should not deactivate when end_date is null", () => {
      const now = new Date();
      const nextEventTime = new Date(now.getTime() + 86400000);
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: now.toISOString(),
        is_recurring: true,
        recurrence: "0 9 * * *",
        start_date: now.toISOString(),
        end_date: null,
        last_alert_time: null,
        is_active: true,
        description: "",
        location: null,
        reminders: [],
        alerts: [],
      };

      const result = shouldDeactivateRecurring(reminder, nextEventTime);
      expect(result.shouldDeactivate).toBe(false);
    });

    it("should not deactivate non-recurring reminders", () => {
      const now = new Date();
      const nextEventTime = new Date(now.getTime() + 86400000);
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: now.toISOString(),
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

      const result = shouldDeactivateRecurring(reminder, nextEventTime);
      expect(result.shouldDeactivate).toBe(false);
    });
  });

  describe("hasAlreadyAlertedForEvent", () => {
    it("should return false for non-recurring reminders", () => {
      const alertTime = new Date("2024-01-15T08:00:00.000Z"); // When alert should fire
      const lastAlertTime = new Date("2024-01-15T08:00:00.000Z");
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: "2024-01-15T09:00:00.000Z",
        is_recurring: false,
        recurrence: null,
        start_date: null,
        end_date: null,
        last_alert_time: lastAlertTime.toISOString(),
        is_active: true,
        description: "",
        location: null,
        reminders: [],
        alerts: [],
      };

      const result = hasAlreadyAlertedForEvent(reminder, alertTime);
      expect(result).toBe(false);
    });

    it("should return true when last_alert_time >= alert_time for recurring", () => {
      const alertTime = new Date("2024-01-15T08:00:00.000Z"); // When alert should fire
      const lastAlertTime = new Date("2024-01-15T08:30:00.000Z"); // After alert time
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: "2024-01-15T09:00:00.000Z",
        is_recurring: true,
        recurrence: "0 9 * * *",
        start_date: "2024-01-15T09:00:00.000Z",
        end_date: "2024-02-15T09:00:00.000Z",
        last_alert_time: lastAlertTime.toISOString(),
        is_active: true,
        description: "",
        location: null,
        reminders: [],
        alerts: [],
      };

      const result = hasAlreadyAlertedForEvent(reminder, alertTime);
      expect(result).toBe(true);
    });

    it("should return false when last_alert_time is null", () => {
      const eventTime = new Date("2024-01-15T09:00:00.000Z");
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: "2024-01-15T09:00:00.000Z",
        is_recurring: true,
        recurrence: "0 9 * * *",
        start_date: "2024-01-15T09:00:00.000Z",
        end_date: "2024-02-15T09:00:00.000Z",
        last_alert_time: null,
        is_active: true,
        description: "",
        location: null,
        reminders: [],
        alerts: [],
      };

      const result = hasAlreadyAlertedForEvent(reminder, eventTime);
      expect(result).toBe(false);
    });

    it("should return false when last_alert_time < alert_time for recurring", () => {
      const eventTime = new Date("2024-01-15T09:00:00.000Z");
      const lastAlertTime = new Date("2024-01-14T08:00:00.000Z"); // Before alert time
      const reminder: TReminder = {
        id: 1,
        title: "Test",
        date: "2024-01-15T09:00:00.000Z",
        is_recurring: true,
        recurrence: "0 9 * * *",
        start_date: "2024-01-15T09:00:00.000Z",
        end_date: "2024-02-15T09:00:00.000Z",
        last_alert_time: lastAlertTime.toISOString(),
        is_active: true,
        description: "",
        location: null,
        reminders: [],
        alerts: [],
      };

      const result = hasAlreadyAlertedForEvent(reminder, eventTime);
      expect(result).toBe(false);
    });
  });
});
