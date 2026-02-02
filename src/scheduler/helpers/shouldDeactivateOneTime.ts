import type { TReminder } from "../../schemas";
import { SCHEDULER_CONFIG } from "../config";

/**
 * Determines if a one-time reminder should be deactivated.
 * Checks if the reminder has already alerted or is stale (missed by >1 hour).
 *
 * @param reminder The reminder to check
 * @param now The current date/time
 * @returns Object with shouldDeactivate flag and optional reason
 */
export function shouldDeactivateOneTime(
  reminder: TReminder,
  now: Date,
): { shouldDeactivate: boolean; reason?: string } {
  if (reminder.last_alert_time) {
    return {
      shouldDeactivate: true,
      reason: "one-time reminder has already alerted",
    };
  }

  const eventTime = new Date(reminder.date);
  const timePastDue = now.getTime() - eventTime.getTime();

  if (timePastDue > SCHEDULER_CONFIG.STALE_THRESHOLD_MS) {
    const secondsPastDue = Math.floor(timePastDue / 1000);
    return {
      shouldDeactivate: true,
      reason: `missed by ${secondsPastDue} seconds (>1 hour stale)`,
    };
  }

  return { shouldDeactivate: false };
}
