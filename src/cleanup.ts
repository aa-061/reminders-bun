import { getReminderRepository } from "./repositories";
import { deactivateReminder } from "./utils";
import { logger } from "./logger";
import {
  shouldDeactivateOneTime,
  shouldDeactivateRecurring,
  calculateNextEventTime,
} from "./scheduler/helpers";

/**
 * Deactivates stale reminders without processing alerts or sending notifications.
 * - One-time: deactivated if already alerted or >1 hour past due.
 * - Recurring: deactivated if next occurrence exceeds end_date.
 */
export async function cleanupStaleReminders(): Promise<{ deactivated: number; checked: number }> {
  const repo = getReminderRepository();
  const reminders = await repo.findActive();
  const now = new Date();
  let deactivated = 0;

  for (const reminder of reminders) {
    let result: { shouldDeactivate: boolean; reason?: string };

    if (reminder.is_recurring && reminder.recurrence) {
      const nextEventTime = calculateNextEventTime(reminder, now);
      if (!nextEventTime) continue;
      result = shouldDeactivateRecurring(reminder, nextEventTime);
    } else {
      result = shouldDeactivateOneTime(reminder, now);
    }

    if (result.shouldDeactivate) {
      await deactivateReminder(reminder.id!, reminder.title);
      logger.info("Cleanup: deactivated reminder", { title: reminder.title, reason: result.reason });
      deactivated++;
    }
  }

  logger.info("Cleanup complete", { checked: reminders.length, deactivated });
  return { deactivated, checked: reminders.length };
}
