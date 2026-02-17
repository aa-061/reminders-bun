import type { TReminder } from "./schemas";
import { getReminders } from "./route-handlers";
import { deactivateReminder, updateLastAlertTime } from "./utils";
import {
  shouldDeactivateOneTime,
  shouldDeactivateRecurring,
  calculateNextEventTime,
  getAlertsToFire,
} from "./scheduler/helpers";
import { sendNotifications } from "./scheduler/notification-service";
import { SCHEDULER_CONFIG } from "./scheduler/config";
import { logger } from "./logger";

/**
 * Main scheduler function that checks all active reminders.
 * Runs on a fixed interval (default: 3 seconds).
 */
export async function checkReminders(): Promise<void> {
  const reminders = await getReminders();
  const now = new Date();

  for (const reminder of reminders) {
    await processReminder(reminder, now);
  }
}

/**
 * Processes a single reminder through three clear steps:
 * 1. Calculate next event time
 * 2. Check if reminder should be deactivated
 * 3. Process alerts
 */
async function processReminder(reminder: TReminder, now: Date): Promise<void> {
  // Skip inactive reminders
  if (!reminder.is_active) return;

  // Skip reminders without alerts
  if (!reminder.alerts || reminder.alerts.length === 0) return;

  // Step 1: Calculate next event time
  const eventTime = calculateNextEventTime(reminder, now);
  if (!eventTime) return;

  // Step 2: Check if reminder should be deactivated
  const deactivation = checkDeactivation(reminder, eventTime, now);
  if (deactivation.shouldDeactivate) {
    await deactivateReminder(reminder.id!, reminder.title);
    logger.info("Deactivating reminder", { title: reminder.title, reason: deactivation.reason });
    return;
  }

  // Step 3: Process alerts
  await processAlerts(reminder, eventTime, now);
}

/**
 * Determines if a reminder should be deactivated based on its type.
 * Routes to the appropriate deactivation check (one-time vs recurring).
 */
function checkDeactivation(
  reminder: TReminder,
  eventTime: Date,
  now: Date,
): { shouldDeactivate: boolean; reason?: string } {
  if (reminder.is_recurring && reminder.recurrence) {
    return shouldDeactivateRecurring(reminder, eventTime);
  }

  return shouldDeactivateOneTime(reminder, now);
}

/**
 * Processes alerts for a reminder by checking which alerts should fire
 * and sending notifications to all contacts.
 */
async function processAlerts(
  reminder: TReminder,
  eventTime: Date,
  now: Date,
): Promise<void> {
  // Check which alerts should fire right now
  const alertsToFire = getAlertsToFire(
    reminder,
    eventTime,
    now,
    SCHEDULER_CONFIG.INTERVAL_MS,
  );

  // Send notifications if any alerts should fire
  if (alertsToFire.length > 0) {
    logger.info("Alert triggered, sending notifications", { title: reminder.title });

    const alert = alertsToFire[0]; // Process the first alert
    await sendNotifications(
      {
        reminder,
        alertName: `Alert (${alert.time}ms before)`,
        alertMs: alert.time,
        userId: reminder.user_id,
      },
      reminder.reminders
    );

    // Update last alert time to prevent duplicate alerts
    await updateLastAlertTime(reminder.id!, now);
  }
}
