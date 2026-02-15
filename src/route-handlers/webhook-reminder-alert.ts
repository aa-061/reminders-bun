import { logger } from "../logger";
import type { TReminderMode } from "../schemas";
import { sendNotifications } from "../scheduler/notification-service";
import { getReminderRepository } from "../repositories";
import { verifyQStashSignature } from "../qstash/verify";
import {
  shouldDeactivateOneTime,
  shouldDeactivateRecurring,
} from "../scheduler/helpers";
import type { Context } from "elysia";

/**
 * Formats milliseconds into a human-readable alert name
 */
function formatAlertName(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""} before`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""} before`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? "s" : ""} before`;
  } else if (seconds > 0) {
    return `${seconds} second${seconds > 1 ? "s" : ""} before`;
  } else {
    return "At event time";
  }
}

interface WebhookPayload {
  reminderId: number;
  alertTime: string; // ISO format timestamp
}

export const webhookReminderAlertRoute = async ({
  request,
  body,
  set,
}: Context) => {
  // Verify QStash signature in production
  if (process.env.NODE_ENV === "production") {
    const signature = request.headers.get("upstash-signature");
    const rawBody = JSON.stringify(body);
    const isValid = await verifyQStashSignature(signature, rawBody);

    if (!isValid) {
      logger.warn("Invalid QStash signature on webhook");
      set.status = 401;
      return { error: "Unauthorized" };
    }
  }

  const payload = body as WebhookPayload;
  const { reminderId, alertTime } = payload;

  // Validate webhook payload
  if (!reminderId || !alertTime) {
    logger.error("Invalid webhook payload - missing required fields", {
      reminderId,
      alertTime,
      body: JSON.stringify(body),
    });
    set.status = 400;
    return { error: "Invalid payload" };
  }

  logger.info("Processing reminder alert webhook", {
    reminderId,
    alertTime,
  });

  // Get reminder from database
  const reminderRepo = getReminderRepository();
  const reminder = await reminderRepo.findById(reminderId);

  if (!reminder) {
    logger.warn("Reminder not found for webhook", { reminderId });
    set.status = 404;
    return { error: "Reminder not found" };
  }

  // Log reminder data for debugging
  logger.info("Fetched reminder from database", {
    reminderId: reminder.id,
    reminderDate: reminder.date,
    dateType: typeof reminder.date,
    title: reminder.title,
  });

  if (!reminder.is_active) {
    logger.info("Reminder is inactive, skipping notification", { reminderId });
    return { status: "ok", message: "Reminder inactive" };
  }

  // Calculate alert offset from reminder date and alert time
  const reminderDate = new Date(reminder.date);
  const alertDate = new Date(alertTime);
  const alertMs = reminderDate.getTime() - alertDate.getTime();

  // Format alert name based on offset
  const alertName = formatAlertName(alertMs);

  // Parse reminder modes (contacts to notify)
  let contacts: TReminderMode[] = [];
  try {
    contacts = reminder.reminders || [];
  } catch {
    logger.error("Failed to parse reminder contacts", { reminderId });
    set.status = 500;
    return { error: "Invalid reminder data" };
  }

  if (contacts.length === 0) {
    logger.info("No contacts configured for reminder", { reminderId });
    return { status: "ok", message: "No contacts" };
  }

  // Send notifications through all channels
  await sendNotifications(
    {
      reminder,
      alertName,
      alertMs,
    },
    contacts
  );

  // Check if reminder should be deactivated
  const now = new Date();
  let shouldDeactivate = false;

  if (reminder.is_recurring && reminder.recurrence) {
    const result = shouldDeactivateRecurring(reminder, now);
    shouldDeactivate = result.shouldDeactivate;
  } else {
    const result = shouldDeactivateOneTime(reminder, now);
    shouldDeactivate = result.shouldDeactivate;
  }

  if (shouldDeactivate) {
    await reminderRepo.update(reminderId, { is_active: false });
    logger.info("Reminder deactivated after final alert", { reminderId });
  }

  return { status: "ok" };
};
