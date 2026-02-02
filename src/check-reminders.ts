import { sendEmail } from "./email-handlers";
import { getReminders } from "./route-handlers";
import { deactivateReminder, updateLastAlertTime } from "./utils";
import {
  shouldDeactivateOneTime,
  shouldDeactivateRecurring,
  calculateNextEventTime,
} from "./scheduler/helpers";

const SCHEDULER_INTERVAL = Number(process.env.SCHEDULER_INTERVAL) || 3000;

export const checkReminders = async () => {
  const reminders = getReminders();
  const now = new Date();

  for (const r of reminders) {
    // Only process reminders that are active
    if (!r.is_active) continue;

    if (!r.alerts || r.alerts.length === 0) continue;

    let eventTime: Date;

    if (r.is_recurring && r.recurrence) {
      // Calculate next occurrence time for recurring events
      const nextEventTime = calculateNextEventTime(r, now);

      if (!nextEventTime) {
        // Cron parsing failed, skip this reminder
        continue;
      }

      // Check if should deactivate using the already-calculated nextEventTime
      const { shouldDeactivate, reason } = shouldDeactivateRecurring(
        r,
        nextEventTime,
      );
      if (shouldDeactivate) {
        console.log(
          `DEACTIVATING RECURRING REMINDER: '${r.title}' - ${reason}`,
        );
        deactivateReminder(r.id!, r.title);
        continue;
      }

      eventTime = nextEventTime;
    } else {
      // Check if one-time reminder should be deactivated
      const { shouldDeactivate } = shouldDeactivateOneTime(r, now);
      if (shouldDeactivate) {
        deactivateReminder(r.id!, r.title);
        continue;
      }

      // Use the fixed date for one-time events
      eventTime = new Date(r.date);
    }

    // Now, calculate the alert time based on the event time and offsets
    for (const offsetMs of r.alerts.map((alert) => alert.time)) {
      const alertDuration = offsetMs;
      const alertTime = new Date(eventTime.getTime() - alertDuration);

      const diff = now.getTime() - alertTime.getTime();

      // Check if the alert was triggered in the last cycle (0s <= diff < 3000ms based on 3s interval)
      if (diff >= 0 && diff < SCHEDULER_INTERVAL) {
        // Final check: If recurring, make sure we haven't alerted for this specific event time yet.
        if (r.is_recurring && r.last_alert_time) {
          const lastAlertTime = new Date(r.last_alert_time);

          if (lastAlertTime.getTime() >= alertTime.getTime()) {
            // Already alerted for this recurrence instance
            continue;
          }
        }

        console.log(
          `ALERT TRIGGERED for '${r.title}'! Sending notifications...`,
        );

        for (const contact of r.reminders) {
          if (contact.mode === "email") {
            await sendEmail(contact.address, r.title, r.description);
          }
        }

        // Acknowledge the alert by setting the last_alert_time to NOW
        updateLastAlertTime(r.id!, now);

        // Break out of the alerts loop to prevent multiple alerts for the same event in one run
        break;
      }
    }
  }
};
