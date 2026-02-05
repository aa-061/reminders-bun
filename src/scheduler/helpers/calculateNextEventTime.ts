import cron_parse from "cron-parser";
import type { TReminder } from "../../schemas";
import { logger } from "../../logger";

/**
 * Calculates the next event time for a reminder.
 * For recurring reminders, parses the cron expression and returns the next occurrence.
 * For one-time reminders, returns the fixed date.
 *
 * @param reminder The reminder to calculate next event time for
 * @param now The current date/time
 * @returns The next event time, or null if cron parsing fails
 */
export function calculateNextEventTime(
  reminder: TReminder,
  now: Date,
): Date | null {
  if (reminder.is_recurring && reminder.recurrence) {
    try {
      const interval = cron_parse.parse(reminder.recurrence, {
        currentDate: now,
      });
      return interval.next().toDate();
    } catch (err) {
      logger.error("Error parsing cron expression", { title: reminder.title, error: (err as Error).message });
      return null;
    }
  } else {
    return new Date(reminder.date);
  }
}