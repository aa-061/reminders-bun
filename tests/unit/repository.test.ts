import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createClient, type Client } from "@libsql/client";
import { SQLiteReminderRepository } from "../../src/repositories/sqlite-reminder-repository";
import type { TCreateReminderInput } from "../../src/schemas";

describe("SQLiteReminderRepository", () => {
  let client: Client;
  let repository: SQLiteReminderRepository;

  beforeEach(async () => {
    // Fresh in-memory database for each test
    client = createClient({ url: "file::memory:" });

    await client.execute(`
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

    repository = new SQLiteReminderRepository(client);
  });

  afterEach(() => {
    client.close();
  });

  // Helper function to create a basic reminder
  function createBasicReminder(
    overrides: Partial<TCreateReminderInput> = {},
  ): TCreateReminderInput {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
      title: "Test Reminder",
      date: futureDate,
      description: "Test description",
      location: null,
      reminders: [{ id: "1", mode: "email" as const, address: "test@test.com" }],
      alerts: [{ id: "1", time: 3600000 }],
      is_recurring: false,
      recurrence: null,
      start_date: null,
      end_date: null,
      is_active: true,
      ...overrides,
    };
  }

  describe("create", () => {
    it("should create a reminder and return it with an ID", async () => {
      const reminder = createBasicReminder();
      const result = await repository.create(reminder);

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe("number");
      expect(result.id).toBeGreaterThan(0);
    });

    it("should store all reminder fields correctly", async () => {
      const reminder = createBasicReminder({
        title: "Dentist Appointment",
        description: "Annual checkup",
        location: "Main Street Dental",
      });

      const result = await repository.create(reminder);
      const created = await repository.findById(result.id);

      expect(created).not.toBeNull();
      expect(created!.title).toBe("Dentist Appointment");
      expect(created!.description).toBe("Annual checkup");
      expect(created!.location).toBe("Main Street Dental");
    });

    it("should store reminders array correctly", async () => {
      const reminder = createBasicReminder({
        reminders: [
          { id: "1", mode: "email" as const, address: "john@example.com" },
          { id: "2", mode: "sms" as const, address: "+1234567890" },
        ],
      });

      const result = await repository.create(reminder);
      const created = await repository.findById(result.id);

      expect(created).not.toBeNull();
      expect(created!.reminders).toHaveLength(2);
      expect(created!.reminders[0].mode).toBe("email");
      expect(created!.reminders[1].mode).toBe("sms");
    });

    it("should store alerts array correctly", async () => {
      const reminder = createBasicReminder({
        alerts: [
          { id: "1", time: 3600000 }, // 1 hour
          { id: "2", time: 1800000 }, // 30 minutes
          { id: "3", time: 900000 }, // 15 minutes
        ],
      });

      const result = await repository.create(reminder);
      const created = await repository.findById(result.id);

      expect(created).not.toBeNull();
      expect(created!.alerts).toHaveLength(3);
      expect(created!.alerts[0].time).toBe(3600000);
      expect(created!.alerts[2].time).toBe(900000);
    });

    it("should create recurring reminder with cron pattern", async () => {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const reminder = createBasicReminder({
        title: "Daily Standup",
        is_recurring: true,
        recurrence: "0 9 * * 1-5", // Weekdays at 9 AM
        start_date: startDate,
        end_date: endDate,
      });

      const result = await repository.create(reminder);
      const created = await repository.findById(result.id);

      expect(created).not.toBeNull();
      expect(created!.is_recurring).toBe(true);
      expect(created!.recurrence).toBe("0 9 * * 1-5");
      expect(created!.start_date).toBe(startDate);
      expect(created!.end_date).toBe(endDate);
    });

    it("should default is_active to true", async () => {
      const reminder = createBasicReminder();
      delete (reminder as any).is_active; // Don't specify is_active

      const result = await repository.create(reminder);
      const created = await repository.findById(result.id);

      expect(created).not.toBeNull();
      expect(created!.is_active).toBe(true);
    });

    it("should handle null location correctly", async () => {
      const reminder = createBasicReminder({ location: null });

      const result = await repository.create(reminder);
      const created = await repository.findById(result.id);

      expect(created).not.toBeNull();
      expect(created!.location).toBeNull();
    });

    it("should handle empty reminders array", async () => {
      const reminder = createBasicReminder({ reminders: [] });

      const result = await repository.create(reminder);
      const created = await repository.findById(result.id);

      expect(created).not.toBeNull();
      expect(created!.reminders).toHaveLength(0);
    });
  });

  describe("findById", () => {
    it("should return reminder by ID", async () => {
      const reminder = createBasicReminder({ title: "Find Me" });
      const created = await repository.create(reminder);

      const found = await repository.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.title).toBe("Find Me");
    });

    it("should return null for non-existent ID", async () => {
      const found = await repository.findById(99999);
      expect(found).toBeNull();
    });

    it("should transform reminder correctly", async () => {
      const reminder = createBasicReminder({
        title: "Transformed",
        reminders: [{ id: "1", mode: "email" as const, address: "test@test.com" }],
        alerts: [{ id: "1", time: 5000 }],
        is_recurring: true,
      });

      const created = await repository.create(reminder);
      const found = await repository.findById(created.id);

      expect(found).not.toBeNull();
      expect(Array.isArray(found!.reminders)).toBe(true);
      expect(Array.isArray(found!.alerts)).toBe(true);
      expect(typeof found!.is_recurring).toBe("boolean");
      expect(typeof found!.is_active).toBe("boolean");
    });
  });

  describe("findAll", () => {
    it("should return empty array when no reminders exist", async () => {
      const all = await repository.findAll();
      expect(all).toHaveLength(0);
    });

    it("should return all reminders regardless of active status", async () => {
      const active = createBasicReminder({ title: "Active", is_active: true });
      const inactive = createBasicReminder({
        title: "Inactive",
        is_active: false,
      });

      const activeId = (await repository.create(active)).id;
      const inactiveId = (await repository.create(inactive)).id;

      const all = await repository.findAll();

      expect(all).toHaveLength(2);
      expect(all.some((r) => r.id === activeId)).toBe(true);
      expect(all.some((r) => r.id === inactiveId)).toBe(true);
    });

    it("should return multiple reminders", async () => {
      const reminder1 = createBasicReminder({ title: "First" });
      const reminder2 = createBasicReminder({ title: "Second" });
      const reminder3 = createBasicReminder({ title: "Third" });

      await repository.create(reminder1);
      await repository.create(reminder2);
      await repository.create(reminder3);

      const all = await repository.findAll();

      expect(all).toHaveLength(3);
      expect(all.map((r) => r.title).sort()).toEqual([
        "First",
        "Second",
        "Third",
      ]);
    });

    it("should transform all reminders correctly", async () => {
      const reminder1 = createBasicReminder({
        title: "First",
        reminders: [{ id: "1", mode: "email" as const, address: "a@test.com" }],
      });
      const reminder2 = createBasicReminder({
        title: "Second",
        is_active: false,
      });

      await repository.create(reminder1);
      await repository.create(reminder2);

      const all = await repository.findAll();

      expect(all[0].reminders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ mode: "email" }),
        ]),
      );
      expect(all[1].is_active).toBe(false);
    });
  });

  describe("findActive", () => {
    it("should return only active reminders", async () => {
      const active = createBasicReminder({ title: "Active", is_active: true });
      const inactive = createBasicReminder({
        title: "Inactive",
        is_active: false,
      });

      await repository.create(active);
      await repository.create(inactive);

      const activeReminders = await repository.findActive();

      expect(activeReminders).toHaveLength(1);
      expect(activeReminders[0].title).toBe("Active");
      expect(activeReminders[0].is_active).toBe(true);
    });

    it("should return empty array when no active reminders exist", async () => {
      const inactive1 = createBasicReminder({
        title: "Inactive 1",
        is_active: false,
      });
      const inactive2 = createBasicReminder({
        title: "Inactive 2",
        is_active: false,
      });

      await repository.create(inactive1);
      await repository.create(inactive2);

      const activeReminders = await repository.findActive();

      expect(activeReminders).toHaveLength(0);
    });

    it("should return all active reminders with multiple records", async () => {
      const active1 = createBasicReminder({
        title: "Active 1",
        is_active: true,
      });
      const active2 = createBasicReminder({
        title: "Active 2",
        is_active: true,
      });
      const inactive = createBasicReminder({
        title: "Inactive",
        is_active: false,
      });

      await repository.create(active1);
      await repository.create(active2);
      await repository.create(inactive);

      const activeReminders = await repository.findActive();

      expect(activeReminders).toHaveLength(2);
      expect(activeReminders.map((r) => r.title).sort()).toEqual([
        "Active 1",
        "Active 2",
      ]);
    });

    it("should transform active reminders correctly", async () => {
      const active = createBasicReminder({
        title: "Active",
        is_active: true,
        reminders: [{ id: "1", mode: "sms" as const, address: "+1234567890" }],
      });

      await repository.create(active);

      const activeReminders = await repository.findActive();

      expect(activeReminders[0].reminders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ mode: "sms" }),
        ]),
      );
    });
  });

  describe("update", () => {
    it("should update reminder fields", async () => {
      const created = await repository.create(
        createBasicReminder({ title: "Original", description: "Original desc" }),
      );

      const updated = await repository.update(created.id, {
        title: "Updated",
        description: "Updated desc",
      });

      expect(updated).toBe(true);

      const found = await repository.findById(created.id);
      expect(found!.title).toBe("Updated");
      expect(found!.description).toBe("Updated desc");
    });

    it("should update only specified fields", async () => {
      const reminder = createBasicReminder({
        title: "Original",
        description: "Original desc",
      });
      const created = await repository.create(reminder);

      await repository.update(created.id, { title: "Updated" });

      const found = await repository.findById(created.id);
      expect(found!.title).toBe("Updated");
      expect(found!.description).toBe("Original desc");
    });

    it("should update reminders array", async () => {
      const created = await repository.create(createBasicReminder());

      const newReminders = [
        { id: "1", mode: "email" as const, address: "new@test.com" },
        { id: "2", mode: "sms" as const, address: "+9999999999" },
      ];

      await repository.update(created.id, { reminders: newReminders });

      const found = await repository.findById(created.id);
      expect(found!.reminders).toHaveLength(2);
      expect(found!.reminders[1].mode).toBe("sms");
    });

    it("should update alerts array", async () => {
      const created = await repository.create(createBasicReminder());

      const newAlerts = [
        { id: "1", time: 5000 },
        { id: "2", time: 10000 },
      ];

      await repository.update(created.id, { alerts: newAlerts });

      const found = await repository.findById(created.id);
      expect(found!.alerts).toHaveLength(2);
      expect(found!.alerts[1].time).toBe(10000);
    });

    it("should update is_active status", async () => {
      const created = await repository.create(
        createBasicReminder({ is_active: true }),
      );

      await repository.update(created.id, { is_active: false });

      const found = await repository.findById(created.id);
      expect(found!.is_active).toBe(false);
    });

    it("should update recurrence details", async () => {
      const created = await repository.create(
        createBasicReminder({ is_recurring: true }),
      );

      const newStartDate = new Date().toISOString();
      const newEndDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

      await repository.update(created.id, {
        recurrence: "0 12 * * *",
        start_date: newStartDate,
        end_date: newEndDate,
      });

      const found = await repository.findById(created.id);
      expect(found!.recurrence).toBe("0 12 * * *");
      expect(found!.start_date).toBe(newStartDate);
      expect(found!.end_date).toBe(newEndDate);
    });

    it("should return false for non-existent reminder", async () => {
      const updated = await repository.update(99999, { title: "Updated" });
      expect(updated).toBe(false);
    });

    it("should return false when no fields are updated", async () => {
      const created = await repository.create(createBasicReminder());
      const updated = await repository.update(created.id, {});
      expect(updated).toBe(false);
    });

    it("should handle multiple field updates", async () => {
      const created = await repository.create(
        createBasicReminder({
          title: "Original",
          description: "Original",
          location: "Original Location",
        }),
      );

      await repository.update(created.id, {
        title: "New Title",
        description: "New Description",
        location: "New Location",
        is_active: false,
      });

      const found = await repository.findById(created.id);
      expect(found!.title).toBe("New Title");
      expect(found!.description).toBe("New Description");
      expect(found!.location).toBe("New Location");
      expect(found!.is_active).toBe(false);
    });
  });

  describe("delete", () => {
    it("should delete a reminder", async () => {
      const created = await repository.create(createBasicReminder());

      const deleted = await repository.delete(created.id);

      expect(deleted).toBe(true);

      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });

    it("should return false for non-existent reminder", async () => {
      const deleted = await repository.delete(99999);
      expect(deleted).toBe(false);
    });

    it("should only delete the specified reminder", async () => {
      const reminder1 = await repository.create(
        createBasicReminder({ title: "Keep Me" }),
      );
      const reminder2 = await repository.create(
        createBasicReminder({ title: "Delete Me" }),
      );

      await repository.delete(reminder2.id);

      const all = await repository.findAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(reminder1.id);
    });
  });

  describe("deleteBulk", () => {
    it("should delete multiple reminders by IDs", async () => {
      const id1 = (await repository.create(createBasicReminder({ title: "Delete 1" }))).id;
      const id2 = (await repository.create(createBasicReminder({ title: "Delete 2" }))).id;
      const id3 = (await repository.create(createBasicReminder({ title: "Delete 3" }))).id;
      const id4 = (await repository.create(createBasicReminder({ title: "Keep Me" }))).id;

      const deletedCount = await repository.deleteBulk([id1, id2, id3]);

      expect(deletedCount).toBe(3);

      const all = await repository.findAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(id4);
    });

    it("should return 0 when deleting empty array", async () => {
      const created = await repository.create(createBasicReminder());

      const deletedCount = await repository.deleteBulk([]);

      expect(deletedCount).toBe(0);

      const found = await repository.findById(created.id);
      expect(found).not.toBeNull();
    });

    it("should handle mix of existing and non-existent IDs", async () => {
      const id1 = (await repository.create(createBasicReminder({ title: "Real" }))).id;
      const fakeId = 99999;

      const deletedCount = await repository.deleteBulk([id1, fakeId]);

      expect(deletedCount).toBe(1);

      const all = await repository.findAll();
      expect(all).toHaveLength(0);
    });

    it("should delete multiple reminders correctly", async () => {
      const ids: number[] = [];
      for (let i = 0; i < 5; i++) {
        ids.push(
          (await repository.create(createBasicReminder({ title: `Reminder ${i}` }))).id,
        );
      }

      const deleteIds = ids.slice(1, 4); // Delete 3 middle ones
      const deletedCount = await repository.deleteBulk(deleteIds);

      expect(deletedCount).toBe(3);

      const remaining = await repository.findAll();
      expect(remaining).toHaveLength(2);
      expect(remaining.map((r) => r.id)).toEqual([ids[0], ids[4]]);
    });
  });

  describe("deactivate", () => {
    it("should set is_active to false", async () => {
      const created = await repository.create(
        createBasicReminder({ is_active: true }),
      );

      const deactivated = await repository.deactivate(created.id);

      expect(deactivated).toBe(true);

      const found = await repository.findById(created.id);
      expect(found!.is_active).toBe(false);
    });

    it("should return false for non-existent reminder", async () => {
      const deactivated = await repository.deactivate(99999);
      expect(deactivated).toBe(false);
    });

    it("should only deactivate the specified reminder", async () => {
      const id1 = (await repository.create(createBasicReminder({ is_active: true }))).id;
      const id2 = (await repository.create(createBasicReminder({ is_active: true }))).id;

      await repository.deactivate(id1);

      const found1 = await repository.findById(id1);
      const found2 = await repository.findById(id2);

      expect(found1!.is_active).toBe(false);
      expect(found2!.is_active).toBe(true);
    });

    it("should keep other fields unchanged", async () => {
      const created = await repository.create(
        createBasicReminder({
          title: "Keep This Title",
          description: "Keep This Description",
          is_active: true,
        }),
      );

      await repository.deactivate(created.id);

      const found = await repository.findById(created.id);
      expect(found!.title).toBe("Keep This Title");
      expect(found!.description).toBe("Keep This Description");
      expect(found!.is_active).toBe(false);
    });
  });

  describe("updateLastAlertTime", () => {
    it("should update last_alert_time", async () => {
      const created = await repository.create(createBasicReminder());
      const now = new Date();

      const updated = await repository.updateLastAlertTime(created.id, now);

      expect(updated).toBe(true);

      const found = await repository.findById(created.id);
      expect(found!.last_alert_time).toBe(now.toISOString());
    });

    it("should return false for non-existent reminder", async () => {
      const updated = await repository.updateLastAlertTime(99999, new Date());
      expect(updated).toBe(false);
    });

    it("should update only the alert time", async () => {
      const created = await repository.create(
        createBasicReminder({
          title: "Keep This",
          is_active: true,
        }),
      );
      const now = new Date();

      await repository.updateLastAlertTime(created.id, now);

      const found = await repository.findById(created.id);
      expect(found!.title).toBe("Keep This");
      expect(found!.is_active).toBe(true);
      expect(found!.last_alert_time).toBe(now.toISOString());
    });

    it("should handle multiple updates to last_alert_time", async () => {
      const created = await repository.create(createBasicReminder());

      const time1 = new Date("2024-01-15T10:00:00Z");
      const time2 = new Date("2024-01-15T11:00:00Z");

      await repository.updateLastAlertTime(created.id, time1);
      let found = await repository.findById(created.id);
      expect(found!.last_alert_time).toBe(time1.toISOString());

      await repository.updateLastAlertTime(created.id, time2);
      found = await repository.findById(created.id);
      expect(found!.last_alert_time).toBe(time2.toISOString());
    });

    it("should preserve ISO format for alert times", async () => {
      const created = await repository.create(createBasicReminder());
      const specificTime = new Date("2025-02-15T14:30:45.123Z");

      await repository.updateLastAlertTime(created.id, specificTime);

      const found = await repository.findById(created.id);
      expect(found!.last_alert_time).toBe(specificTime.toISOString());
    });
  });

  describe("Integration scenarios", () => {
    it("should handle full lifecycle: create, update, deactivate, query", async () => {
      // Create
      const created = await repository.create(
        createBasicReminder({
          title: "Lifecycle Test",
          description: "Initial description",
        }),
      );

      // Verify in findActive
      let active = await repository.findActive();
      expect(active.some((r) => r.id === created.id)).toBe(true);

      // Update
      await repository.update(created.id, {
        description: "Updated description",
      });

      const found = await repository.findById(created.id);
      expect(found!.description).toBe("Updated description");

      // Deactivate
      await repository.deactivate(created.id);

      // Verify not in findActive
      active = await repository.findActive();
      expect(active.some((r) => r.id === created.id)).toBe(false);

      // Verify still in findAll
      const all = await repository.findAll();
      const reminder = all.find((r) => r.id === created.id);
      expect(reminder).not.toBeNull();
      expect(reminder!.is_active).toBe(false);
    });

    it("should handle recurring reminder with multiple alerts", async () => {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const reminder = createBasicReminder({
        title: "Meeting Series",
        is_recurring: true,
        recurrence: "0 14 * * 2",
        start_date: startDate,
        end_date: endDate,
        alerts: [
          { id: "alert-1", time: 3600000 },
          { id: "alert-2", time: 1800000 },
          { id: "alert-3", time: 600000 },
        ],
      });

      const created = await repository.create(reminder);
      const found = await repository.findById(created.id);

      expect(found!.is_recurring).toBe(true);
      expect(found!.recurrence).toBe("0 14 * * 2");
      expect(found!.alerts).toHaveLength(3);
    });

    it("should handle complex update scenarios", async () => {
      const created = await repository.create(createBasicReminder());

      // Update from one-time to recurring
      const newStartDate = new Date().toISOString();
      const newEndDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      await repository.update(created.id, {
        is_recurring: true,
        recurrence: "0 9 * * 1-5",
        start_date: newStartDate,
        end_date: newEndDate,
      });

      const found = await repository.findById(created.id);
      expect(found!.is_recurring).toBe(true);
      expect(found!.start_date).toBe(newStartDate);

      // Later update: change recurrence pattern
      await repository.update(created.id, {
        recurrence: "0 14 * * *",
      });

      const updated = await repository.findById(created.id);
      expect(updated!.recurrence).toBe("0 14 * * *");
      expect(updated!.start_date).toBe(newStartDate); // Should remain unchanged
    });
  });
});
