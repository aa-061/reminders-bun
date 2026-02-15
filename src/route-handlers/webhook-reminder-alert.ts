import { logger } from "../logger";
import type { TReminderMode } from "../schemas";
import { sendNotifications } from "../scheduler/notification-service";
import { getReminderRepository } from "../repositories";
import { getAlertPresetRepository } from "../repositories";
import { verifyQStashSignature } from "../qstash/verify";
import {
  shouldDeactivateOneTime,
  shouldDeactivateRecurring,
} from "../scheduler/helpers";
import type { Context } from "elysia";

interface WebhookPayload {
  reminderId: number;
  alertId: number;
  userId: string;
  scheduledFor: number;
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
  const { reminderId, alertId, userId, scheduledFor } = payload;

  logger.info("Processing reminder alert webhook", {
    reminderId,
    alertId,
    userId,
    scheduledFor: new Date(scheduledFor).toISOString(),
  });

  // Get reminder from database
  const reminderRepo = getReminderRepository();
  const reminder = await reminderRepo.findById(reminderId);

  if (!reminder) {
    logger.warn("Reminder not found for webhook", { reminderId, userId });
    set.status = 404;
    return { error: "Reminder not found" };
  }

  if (!reminder.is_active) {
    logger.info("Reminder is inactive, skipping notification", { reminderId });
    return { status: "ok", message: "Reminder inactive" };
  }

  // Get alert preset details
  const alertRepo = getAlertPresetRepository();
  const alert = await alertRepo.findById(alertId);

  if (!alert) {
    logger.warn("Alert preset not found", { alertId, userId });
    set.status = 404;
    return { error: "Alert not found" };
  }

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
      alertName: alert.name,
      alertMs: alert.ms,
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
