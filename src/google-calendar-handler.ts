import { google } from "googleapis";
import { logger } from "./logger";
import { getGoogleTokenRepository } from "./repositories";
import type { TReminder } from "./schemas";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI;

/**
 * Creates an OAuth2 client
 */
function createOAuth2Client() {
  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Checks if Google Calendar is configured
 */
export function isGoogleConfigured(): boolean {
  return !!(clientId && clientSecret && redirectUri);
}

/**
 * Generates the OAuth authorization URL
 */
export function getAuthUrl(userId: string): string | null {
  const oauth2Client = createOAuth2Client();
  if (!oauth2Client) return null;

  // Encode userId in state parameter
  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state: state,
    prompt: "consent", // Force consent to get refresh token
  });
}

/**
 * Exchanges authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  scope?: string;
} | null> {
  const oauth2Client = createOAuth2Client();
  if (!oauth2Client) return null;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    return {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token || undefined,
      expiry_date: tokens.expiry_date || undefined,
      scope: tokens.scope || undefined,
    };
  } catch (error) {
    logger.error("Failed to exchange code for tokens", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Saves tokens to database via repository
 */
export async function saveTokens(
  userId: string,
  tokens: {
    access_token: string;
    refresh_token?: string;
    expiry_date?: number;
    scope?: string;
  }
): Promise<void> {
  const repo = getGoogleTokenRepository();
  await repo.save(userId, tokens);
}

/**
 * Gets tokens for a user from repository
 */
export async function getTokens(userId: string): Promise<{
  access_token: string;
  refresh_token: string | null;
  expiry_date: number | null;
} | null> {
  const repo = getGoogleTokenRepository();
  const token = await repo.getByUserId(userId);

  if (!token) return null;

  return {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expiry_date: token.expiry_date,
  };
}

/**
 * Removes tokens for a user
 */
export async function removeTokens(userId: string): Promise<void> {
  const repo = getGoogleTokenRepository();
  await repo.delete(userId);
}

/**
 * Checks if user has connected Google Calendar
 */
export async function isGoogleConnected(userId: string): Promise<boolean> {
  const tokens = await getTokens(userId);
  return !!tokens;
}

/**
 * Gets an authenticated Calendar API client for a user
 */
async function getCalendarClient(userId: string) {
  const oauth2Client = createOAuth2Client();
  if (!oauth2Client) {
    throw new Error("Google OAuth not configured");
  }

  const tokens = await getTokens(userId);
  if (!tokens) {
    throw new Error("User not connected to Google Calendar");
  }

  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || undefined,
    expiry_date: tokens.expiry_date || undefined,
  });

  // Set up token refresh callback
  oauth2Client.on("tokens", async (newTokens) => {
    logger.info("Google tokens refreshed", { userId });
    await saveTokens(userId, {
      access_token: newTokens.access_token!,
      refresh_token: newTokens.refresh_token || undefined,
      expiry_date: newTokens.expiry_date || undefined,
    });
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

/**
 * Converts cron expression to RRULE
 */
function cronToRRule(cron: string): string | null {
  const parts = cron.split(" ");
  if (parts.length !== 5) return null;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Daily
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return "FREQ=DAILY";
  }

  // Weekly
  if (dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
    const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const dayIndex = parseInt(dayOfWeek);
    if (!isNaN(dayIndex) && dayIndex >= 0 && dayIndex <= 6) {
      return `FREQ=WEEKLY;BYDAY=${days[dayIndex]}`;
    }
  }

  // Monthly
  if (dayOfMonth !== "*" && month === "*" && dayOfWeek === "*") {
    return `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth}`;
  }

  // Yearly
  if (dayOfMonth !== "*" && month !== "*" && dayOfWeek === "*") {
    return `FREQ=YEARLY;BYMONTH=${month};BYMONTHDAY=${dayOfMonth}`;
  }

  return null;
}

/**
 * Creates a calendar event from a reminder
 */
export async function createCalendarEvent(
  userId: string,
  reminder: TReminder
): Promise<{ eventId: string; htmlLink: string } | null> {
  try {
    const calendar = await getCalendarClient(userId);

    const eventDate = new Date(reminder.date);
    const endDate = new Date(eventDate.getTime() + 60 * 60 * 1000); // 1 hour duration

    const event: any = {
      summary: reminder.title,
      description: reminder.description || undefined,
      location: reminder.location || undefined,
      start: {
        dateTime: eventDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 30 },
          { method: "popup", minutes: 10 },
        ],
      },
    };

    // Add recurrence if reminder is recurring
    if (reminder.is_recurring && reminder.recurrence) {
      const rrule = cronToRRule(reminder.recurrence);
      if (rrule) {
        event.recurrence = [`RRULE:${rrule}`];
      }
    }

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
    });

    logger.info("Calendar event created", {
      userId,
      eventId: response.data.id,
      reminderId: reminder.id,
    });

    return {
      eventId: response.data.id!,
      htmlLink: response.data.htmlLink!,
    };
  } catch (error: any) {
    logger.error("Failed to create calendar event", {
      error: error.message,
      userId,
      reminderId: reminder.id,
    });

    // Handle token expiration
    if (error.code === 401) {
      await removeTokens(userId);
      throw new Error("Google Calendar authorization expired. Please reconnect.");
    }

    return null;
  }
}
