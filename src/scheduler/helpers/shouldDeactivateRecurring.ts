import type { TReminder } from "../../schemas";

/**
 * Determines if a recurring reminder should be deactivated.
 * Checks if the next event time exceeds the reminder's end_date.
 *
 * @param reminder The reminder to check
 * @param nextEventTime The calculated next event time
 * @returns Object with shouldDeactivate flag and optional reason
 */
export function shouldDeactivateRecurring(
  reminder: TReminder,
  nextEventTime: Date,
): { shouldDeactivate: boolean; reason?: string } {
  if (!reminder.recurrence) {
    return { shouldDeactivate: false };
  }

  if (reminder.end_date) {
    const endDate = new Date(reminder.end_date);

    if (nextEventTime.getTime() > endDate.getTime()) {
      return {
        shouldDeactivate: true,
        reason: "next occurrence exceeds end_date",
      };
    }
  }

  return { shouldDeactivate: false };
}
