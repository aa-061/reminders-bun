import type { TReminder } from "../../schemas";
import { hasAlreadyAlertedForEvent } from "./hasAlreadyAlertedForEvent";
import { SCHEDULER_CONFIG } from "../config";

type Alert = {
  id: string;
  time: number;
};

/**
 * Determines which alerts should fire right now for a given reminder.
 *
 * @param reminder - The reminder to check alerts for
 * @param eventTime - The calculated event time (next occurrence for recurring, fixed date for one-time)
 * @param now - The current time
 * @param intervalMs - The scheduler interval in milliseconds
 * @returns Array of alerts that should fire (typically 0 or 1 alert)
 */
export function getAlertsToFire(
  reminder: TReminder,
  eventTime: Date,
  now: Date,
  intervalMs: number,
): Alert[] {
  const alertsToFire: Alert[] = [];

  // Loop through all alerts and check if any should fire
  for (const alert of reminder.alerts) {
    const alertDuration = alert.time;
    const alertTime = new Date(eventTime.getTime() - alertDuration);

    const diff = now.getTime() - alertTime.getTime();

    // Check if the alert is due (past or present) but not too stale (< 1 hour past due)
    if (diff >= 0 && diff < SCHEDULER_CONFIG.STALE_THRESHOLD_MS) {
      // Check if we've already alerted for this event instance
      if (hasAlreadyAlertedForEvent(reminder, alertTime)) {
        // Already alerted for this event instance
        continue;
      }

      // This alert should fire
      alertsToFire.push(alert);

      // Only return the first alert that should fire per cycle
      break;
    }
  }

  return alertsToFire;
}
