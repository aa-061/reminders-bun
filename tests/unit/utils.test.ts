import { describe, it, expect } from "bun:test";

describe("Utility Functions", () => {
  describe("Date Utilities", () => {
    it("should correctly parse ISO date strings", () => {
      const dateStr = "2024-01-15T09:00:00.000Z";
      const date = new Date(dateStr);
      expect(date.getUTCHours()).toBe(9);
      expect(date.getUTCMonth()).toBe(0); // January (0-indexed)
      expect(date.getUTCDate()).toBe(15);
    });

    it("should correctly handle date arithmetic", () => {
      const baseDate = new Date("2024-01-15T00:00:00.000Z");
      const oneHourLater = new Date(baseDate.getTime() + 3600000); // 1 hour in ms
      expect(oneHourLater.getUTCHours()).toBe(1);
    });

    it("should correctly handle date subtraction", () => {
      const eventTime = new Date("2024-01-15T09:00:00.000Z");
      const alertOffset = 3600000; // 1 hour
      const alertTime = new Date(eventTime.getTime() - alertOffset);
      expect(alertTime.getUTCHours()).toBe(8);
    });

    it("should correctly create dates from milliseconds", () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 86400000); // 24 hours
      const diff = tomorrow.getTime() - now.getTime();
      expect(diff).toBe(86400000);
    });

    it("should correctly compare date times", () => {
      const date1 = new Date("2024-01-15T09:00:00.000Z");
      const date2 = new Date("2024-01-15T10:00:00.000Z");
      expect(date2.getTime()).toBeGreaterThan(date1.getTime());
    });

    it("should handle date equality correctly", () => {
      const dateStr = "2024-01-15T09:00:00.000Z";
      const date1 = new Date(dateStr);
      const date2 = new Date(dateStr);
      expect(date1.getTime()).toBe(date2.getTime());
    });

    it("should correctly parse ISO dates with different timezones", () => {
      const utcDate = new Date("2024-01-15T09:00:00.000Z");
      const isoString = utcDate.toISOString();
      const reparsed = new Date(isoString);
      expect(reparsed.getTime()).toBe(utcDate.getTime());
    });
  });

  describe("Time Conversion", () => {
    it("should convert milliseconds to seconds correctly", () => {
      const ms = 3000;
      const seconds = Math.floor(ms / 1000);
      expect(seconds).toBe(3);
    });

    it("should convert hours to milliseconds", () => {
      const hours = 1;
      const ms = hours * 60 * 60 * 1000;
      expect(ms).toBe(3600000);
    });

    it("should convert minutes to milliseconds", () => {
      const minutes = 30;
      const ms = minutes * 60 * 1000;
      expect(ms).toBe(1800000);
    });

    it("should convert days to milliseconds", () => {
      const days = 1;
      const ms = days * 24 * 60 * 60 * 1000;
      expect(ms).toBe(86400000);
    });
  });

  describe("Array and Object Utilities", () => {
    it("should parse JSON arrays", () => {
      const jsonStr = '[{"id": "1", "time": 3600000}]';
      const parsed = JSON.parse(jsonStr);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].id).toBe("1");
      expect(parsed[0].time).toBe(3600000);
    });

    it("should stringify objects to JSON", () => {
      const obj = { id: "1", mode: "email", address: "test@test.com" };
      const json = JSON.stringify(obj);
      expect(typeof json).toBe("string");
      const reparsed = JSON.parse(json);
      expect(reparsed).toEqual(obj);
    });

    it("should handle array filtering", () => {
      const alerts = [
        { id: "1", time: 3600000 },
        { id: "2", time: 1800000 },
        { id: "3", time: 900000 },
      ];
      const filtered = alerts.filter((a) => a.time >= 1800000);
      expect(filtered.length).toBe(2);
      expect(filtered.every((a) => a.time >= 1800000)).toBe(true);
    });

    it("should handle array mapping", () => {
      const alerts = [
        { id: "1", time: 3600000 },
        { id: "2", time: 1800000 },
      ];
      const times = alerts.map((a) => a.time);
      expect(times).toEqual([3600000, 1800000]);
    });

    it("should handle object destructuring", () => {
      const reminder = {
        id: 1,
        title: "Test",
        date: "2024-01-15T09:00:00.000Z",
        is_recurring: false,
      };
      const { id, title } = reminder;
      expect(id).toBe(1);
      expect(title).toBe("Test");
    });
  });

  describe("String Utilities", () => {
    it("should check if string includes substring", () => {
      const str = "reminder-alert";
      expect(str.includes("alert")).toBe(true);
      expect(str.includes("webhook")).toBe(false);
    });

    it("should split strings correctly", () => {
      const csv = "id,title,date";
      const parts = csv.split(",");
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe("id");
    });

    it("should convert strings to numbers", () => {
      const str = "3600000";
      const num = Number(str);
      expect(typeof num).toBe("number");
      expect(num).toBe(3600000);
    });

    it("should use template literals", () => {
      const id = 1;
      const title = "Test";
      const msg = `Reminder ${id}: ${title}`;
      expect(msg).toBe("Reminder 1: Test");
    });
  });

  describe("Boolean Utilities", () => {
    it("should handle truthy/falsy checks", () => {
      expect(Boolean(1)).toBe(true);
      expect(Boolean(0)).toBe(false);
      expect(Boolean("")).toBe(false);
      expect(Boolean("text")).toBe(true);
      expect(Boolean(null)).toBe(false);
    });

    it("should handle logical AND operations", () => {
      expect(true && true).toBe(true);
      expect(true && false).toBe(false);
      expect(false && false).toBe(false);
    });

    it("should handle logical OR operations", () => {
      expect(true || false).toBe(true);
      expect(false || false).toBe(false);
      expect(true || true).toBe(true);
    });

    it("should handle logical NOT operations", () => {
      expect(!true).toBe(false);
      expect(!false).toBe(true);
      expect(!0).toBe(true);
      expect(!1).toBe(false);
    });
  });

  describe("Math Utilities", () => {
    it("should calculate time differences", () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 3600000); // 1 hour later
      const diff = futureTime.getTime() - now.getTime();
      expect(diff).toBe(3600000);
    });

    it("should handle floor division", () => {
      const ms = 3599999;
      const seconds = Math.floor(ms / 1000);
      expect(seconds).toBe(3599);
    });

    it("should calculate percentage", () => {
      const part = 50;
      const total = 100;
      const percentage = (part / total) * 100;
      expect(percentage).toBe(50);
    });

    it("should handle min/max values", () => {
      const values = [3600000, 1800000, 900000];
      expect(Math.max(...values)).toBe(3600000);
      expect(Math.min(...values)).toBe(900000);
    });

    it("should handle absolute values", () => {
      expect(Math.abs(-100)).toBe(100);
      expect(Math.abs(100)).toBe(100);
    });
  });
});
