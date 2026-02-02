import type { TReminder } from "../../schemas";

/**
 * Checks if we've already alerted for this specific event instance.
 *
 * This is only relevant for recurring reminders, where we need to prevent
 * sending duplicate alerts for the same occurrence. For non-recurring reminders,
 * deactivation is handled by shouldDeactivateOneTime() after the first alert.
 *
 * @param reminder - The reminder to check
 * @param alertTime - The time when the alert should fire
 * @returns true if we've already alerted for this event instance, false otherwise
 */
export function hasAlreadyAlertedForEvent(
  reminder: TReminder,
  alertTime: Date
): boolean {
  // Only check for recurring reminders
  // Non-recurring reminders are deactivated after first alert via shouldDeactivateOneTime()
  if (!reminder.is_recurring) {
    return false;
  }

  // Recurring reminders: check if we've alerted for this specific occurrence
  if (reminder.last_alert_time) {
    const lastAlertTime = new Date(reminder.last_alert_time);
    return lastAlertTime.getTime() >= alertTime.getTime();
  }

  return false;
}
