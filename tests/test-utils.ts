import type { TReminder, TReminderMode, TCreateReminderInput } from "../src/schemas";

// Base URL for API calls
export const API_KEY = process.env.APP_API_KEY || "test-api-key";

// Helper to make authenticated requests
export function authHeaders() {
  return {
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
  };
}

// Sample reminder factory
export function createSampleReminder(
  overrides: Partial<TCreateReminderInput> = {}
): TCreateReminderInput {
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
    ...overrides,
  };
}

// Sample recurring reminder factory
export function createRecurringReminder(
  overrides: Partial<TCreateReminderInput> = {}
): TCreateReminderInput {
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
    ...overrides,
  };
}
