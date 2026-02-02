import type { TReminder } from "../../schemas";
import { SCHEDULER_CONFIG } from "../config";

// Determines if a one-time reminder should be deactivated
export function shouldDeactivateOneTime(
  reminder: TReminder,
  now: Date,
): { shouldDeactivate: boolean } {
  if (reminder.last_alert_time) {
    console.log(
      `DEACTIVATING ONE-TIME REMINDER: '${reminder.title}' as it has already alerted.`,
    );

    return { shouldDeactivate: true };
  }

  const eventTime = new Date(reminder.date);
  const timePastDue = now.getTime() - eventTime.getTime();

  if (timePastDue > SCHEDULER_CONFIG.STALE_THRESHOLD_MS) {
    console.log(
      `DEACTIVATING STALE ONE-TIME REMINDER: One-time reminder '${reminder.title}' missed by ${Math.floor(timePastDue / 1000)} seconds and never alerted`,
    );
    return { shouldDeactivate: true };
  }

  return { shouldDeactivate: false };
}
