import { createEvent, type EventAttributes, type DateArray } from "ics";
import type { TReminder } from "./schemas";
import { logger } from "./logger";

/**
 * Converts a Date object to the ics DateArray format [year, month, day, hour, minute]
 * Note: ics library uses 1-indexed months (January = 1), unlike JavaScript Date (January = 0)
 */
function dateToArray(date: Date): DateArray {
  return [
    date.getFullYear(),
    date.getMonth() + 1, // ics uses 1-indexed months
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ];
}

/**
 * Generates a unique identifier for the calendar event
 */
function generateUid(reminderId: number, alertMs: number): string {
  return `reminder-${reminderId}-alert-${alertMs}@reminders.app`;
}

/**
 * Calculates event duration in hours and minutes
 * Default duration is 1 hour if not specified
 */
function getEventDuration(): { hours: number; minutes: number } {
  return { hours: 1, minutes: 0 };
}

export interface ICSGeneratorOptions {
  reminder: TReminder;
  alertName?: string;
  alertMs?: number;
}

/**
 * Generates an ICS calendar event for a reminder
 * @param options - The reminder and optional alert information
 * @returns The ICS file content as a string, or null if generation failed
 */
export async function generateICSEvent(
  options: ICSGeneratorOptions
): Promise<string | null> {
  const { reminder, alertName, alertMs = 0 } = options;

  const eventDate = new Date(reminder.date);

  // Build description with all reminder details
  let description = reminder.description || "";
  if (reminder.location) {
    description += `\n\nLocation: ${reminder.location}`;
  }
  if (alertName) {
    description += `\n\nAlert: ${alertName}`;
  }

  // Build alarm/reminder for 15 minutes before event
  const alarms: EventAttributes["alarms"] = [
    {
      action: "display",
      description: `Reminder: ${reminder.title}`,
      trigger: { minutes: 15, before: true },
    },
  ];

  const eventAttributes: EventAttributes = {
    start: dateToArray(eventDate),
    duration: getEventDuration(),
    title: reminder.title,
    description: description.trim(),
    location: reminder.location || undefined,
    uid: generateUid(reminder.id, alertMs),
    productId: "reminders-app/ics",
    calName: "Reminders",
    alarms,
    status: "CONFIRMED",
    busyStatus: "BUSY",
    // Add organizer info (optional, uses app name)
    organizer: {
      name: "Reminders App",
      email: "noreply@reminders.app",
    },
  };

  // Add recurrence rule if reminder is recurring
  if (reminder.is_recurring && reminder.recurrence) {
    const rrule = cronToRRule(reminder.recurrence);
    if (rrule) {
      eventAttributes.recurrenceRule = rrule;
    }
  }

  return new Promise((resolve) => {
    createEvent(eventAttributes, (error, value) => {
      if (error) {
        logger.error("Failed to generate ICS event", {
          error: error.message,
          reminderId: reminder.id,
        });
        resolve(null);
      } else {
        resolve(value);
      }
    });
  });
}

/**
 * Converts a cron expression to an iCalendar RRULE string
 * Supports common patterns: daily, weekly, monthly, yearly
 * @param cron - Cron expression (minute hour dayOfMonth month dayOfWeek)
 * @returns RRULE string or null if pattern not recognized
 */
function cronToRRule(cron: string): string | null {
  const parts = cron.split(" ");
  if (parts.length !== 5) {
    return null;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Daily: 0 9 * * * (every day at 9:00)
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return "FREQ=DAILY";
  }

  // Weekly: 0 9 * * 1 (every Monday at 9:00)
  if (dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
    const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const dayIndex = parseInt(dayOfWeek);
    if (!isNaN(dayIndex) && dayIndex >= 0 && dayIndex <= 6) {
      return `FREQ=WEEKLY;BYDAY=${days[dayIndex]}`;
    }
    // Handle comma-separated days like "1,3,5" (Mon, Wed, Fri)
    if (dayOfWeek.includes(",")) {
      const dayList = dayOfWeek.split(",").map((d) => {
        const idx = parseInt(d.trim());
        return days[idx] || null;
      }).filter(Boolean);
      if (dayList.length > 0) {
        return `FREQ=WEEKLY;BYDAY=${dayList.join(",")}`;
      }
    }
  }

  // Monthly: 0 9 15 * * (every 15th at 9:00)
  if (dayOfMonth !== "*" && month === "*" && dayOfWeek === "*") {
    return `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth}`;
  }

  // Yearly: 0 9 25 12 * (every Dec 25 at 9:00)
  if (dayOfMonth !== "*" && month !== "*" && dayOfWeek === "*") {
    return `FREQ=YEARLY;BYMONTH=${month};BYMONTHDAY=${dayOfMonth}`;
  }

  // Default to no recurrence for complex patterns
  logger.warn("Could not convert cron to RRULE", { cron });
  return null;
}

/**
 * Generates a filename for the ICS attachment
 */
export function generateICSFilename(reminder: TReminder): string {
  // Sanitize title for filename (remove special characters)
  const sanitizedTitle = reminder.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);

  return `reminder-${sanitizedTitle}.ics`;
}
