import type { TCreateReminderInput } from "../src/schemas";

// Default test user credentials (used across all integration tests)
export const TEST_USER = {
  email: "test@example.com",
  password: "test-password-123",
  name: "Test User",
};

/**
 * Signs up (or signs in if account already exists) and returns the raw
 * Set-Cookie header value for use in subsequent requests.
 */
export async function getSessionCookie(baseUrl: string): Promise<string> {
  // Try sign-up first
  let response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(TEST_USER),
  });

  // If sign-up fails (user already exists), fall back to sign-in
  if (!response.ok) {
    response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
    });
  }

  if (!response.ok) {
    throw new Error(`Auth failed with ${response.status}: ${await response.text()}`);
  }

  // Extract cookie name=value pairs from Set-Cookie header(s)
  const raw = response.headers.get("set-cookie") || "";
  return raw
    .split(/,\s*(?=[A-Za-z0-9_.-]+=)/)
    .map((c) => c.split(";")[0].trim())
    .join("; ");
}

/** Returns headers with session cookie for authenticated fetch calls. */
export function sessionHeaders(cookie: string) {
  return {
    Cookie: cookie,
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
