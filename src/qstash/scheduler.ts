import { qstash, getWebhookBaseUrl } from "./client";
import { getAppSettingsRepository } from "../repositories";
import { logger } from "../logger";

interface ScheduleReminderOptions {
  reminderId: number;
  alertTime: Date; // When to trigger the alert
  title: string; // For logging
}

interface ScheduleResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Schedule a reminder alert using QStash.
 * QStash will call our webhook at the specified time.
 */
export async function scheduleReminderAlert(
  options: ScheduleReminderOptions,
): Promise<ScheduleResult> {
  const { reminderId, alertTime, title } = options;

  if (!qstash) {
    logger.debug("Would schedule reminder (dev mode)", {
      reminderId,
      alertTime: alertTime.toISOString(),
    });
    return { success: true, messageId: "dev-mode" };
  }

  const webhookUrl = `${getWebhookBaseUrl()}/webhooks/reminder-alert`;
  const delaySeconds = Math.max(
    0,
    Math.floor((alertTime.getTime() - Date.now()) / 1000),
  );

  if (delaySeconds <= 0) {
    logger.info("Alert time is now or past, triggering immediately", { title });
  }

  try {
    const response = await qstash.publishJSON({
      url: webhookUrl,
      body: { reminderId, alertTime: alertTime.toISOString() },
      delay: delaySeconds > 0 ? delaySeconds : undefined,
      retries: 3,
      headers: {
        "x-api-key": process.env.APP_API_KEY || "",
      },
    });

    logger.info("Scheduled alert", {
      response,
      title,
      alertTime: alertTime.toISOString(),
      delaySeconds,
    });

    return { success: true, messageId: response.messageId };
  } catch (error) {
    logger.error("Failed to schedule alert", {
      title,
      error: (error as Error).message,
    });
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Schedule a recurring reminder using QStash cron schedules.
 * Used for reminders with cron expressions.
 */
export async function scheduleRecurringReminder(
  reminderId: number,
  cronExpression: string,
): Promise<ScheduleResult> {
  if (!qstash) {
    logger.debug("Would schedule recurring reminder (dev mode)", {
      reminderId,
      cronExpression,
    });
    return { success: true, messageId: "dev-mode" };
  }

  const webhookUrl = `${getWebhookBaseUrl()}/webhooks/reminder-alert`;

  try {
    const response = await qstash.schedules.create({
      destination: webhookUrl,
      cron: cronExpression,
      body: JSON.stringify({ reminderId, isRecurring: true }),
      headers: {
        "x-api-key": process.env.APP_API_KEY || "",
      },
      retries: 3,
    });

    logger.info("Created recurring schedule", { reminderId, cronExpression });

    return { success: true, messageId: response.scheduleId };
  } catch (error) {
    logger.error("Failed to create recurring schedule", {
      reminderId,
      error: (error as Error).message,
    });
    return { success: false, error: (error as Error).message };
  }
}

const CLEANUP_SCHEDULE_ID = "reminders-daily-cleanup";
const CLEANUP_CRON = "0 0 * * *"; // Every day at midnight UTC

/**
 * Ensures the daily cleanup cron schedule exists in QStash.
 * Persists the schedule ID in app_settings so the QStash API is only
 * called once — subsequent cold starts skip it entirely.
 */
export async function ensureCleanupSchedule(): Promise<void> {
  if (!qstash) {
    logger.debug("QStash not configured - cleanup schedule not created");
    return;
  }

  // Already registered in a previous run — nothing to do.
  const settings = getAppSettingsRepository();
  if (await settings.get("cleanup_schedule_id")) {
    logger.info("Cleanup schedule already registered - skipping");
    return;
  }

  const webhookUrl = `${getWebhookBaseUrl()}/webhooks/cleanup`;

  try {
    await qstash.schedules.create({
      scheduleId: CLEANUP_SCHEDULE_ID,
      destination: webhookUrl,
      cron: CLEANUP_CRON,
      headers: {
        "x-api-key": process.env.APP_API_KEY || "",
      },
      retries: 3,
    });

    // Persist so we don't call QStash again on the next cold start.
    await settings.set("cleanup_schedule_id", CLEANUP_SCHEDULE_ID);

    logger.info("Cleanup schedule created", { cron: CLEANUP_CRON });
  } catch (error) {
    logger.error("Failed to ensure cleanup schedule", {
      error: (error as Error).message,
    });
  }
}

/**
 * Cancel a scheduled message or recurring schedule.
 */
export async function cancelScheduledReminder(
  messageId: string,
): Promise<boolean> {
  if (!qstash) {
    logger.debug("Would cancel scheduled message (dev mode)", { messageId });
    return true;
  }

  try {
    await qstash.messages.delete(messageId);
    return true;
  } catch {
    try {
      await qstash.schedules.delete(messageId);
      return true;
    } catch (error) {
      logger.error("Failed to cancel scheduled reminder", {
        messageId,
        error: (error as Error).message,
      });
      return false;
    }
  }
}
