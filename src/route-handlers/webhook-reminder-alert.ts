import type { Context } from "elysia";
import { verifyQStashSignature } from "../qstash/verify";
import { getReminderById } from "./route-helpers";
import { sendNotifications } from "../scheduler/notification-service";
import { deactivateReminder, updateLastAlertTime } from "../utils";
import { logger } from "../logger";

interface WebhookPayload {
  reminderId: number;
  alertTime?: string;
  isRecurring?: boolean;
}

export const webhookReminderAlertRoute = async ({
  request,
  body,
  set,
}: Context) => {
  // Verify the request came from QStash
  const signature = request.headers.get("upstash-signature");
  const rawBody = JSON.stringify(body);

  const isValid = await verifyQStashSignature(signature, rawBody);
  if (!isValid) {
    logger.warn("Invalid QStash signature on reminder alert webhook");
    set.status = 401;
    return { error: "Invalid signature" };
  }

  const payload = body as WebhookPayload;
  const { reminderId, isRecurring } = payload;

  logger.info("Webhook received", { reminderId });

  // Get the reminder
  const reminder = await getReminderById(reminderId);

  if (!reminder) {
    logger.info("Reminder not found - may have been deleted", { reminderId });
    return { status: "skipped", reason: "reminder_not_found" };
  }

  if (!reminder.is_active) {
    logger.info("Reminder is inactive - skipping", { reminderId });
    return { status: "skipped", reason: "inactive" };
  }

  // Send notifications
  logger.info("Sending notifications", { title: reminder.title });
  await sendNotifications(reminder, reminder.reminders);

  // Update last alert time
  await updateLastAlertTime(reminder.id!, new Date());

  // Deactivate one-time reminders after sending
  if (!isRecurring && !reminder.is_recurring) {
    await deactivateReminder(reminder.id!, reminder.title);
    logger.info("One-time reminder deactivated", { title: reminder.title });
  }

  return { status: "ok", reminderTitle: reminder.title };
};
