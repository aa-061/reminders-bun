import { sendReminderEmail } from "../email-handlers";
import { logger } from "../logger";
import type { TReminder, TReminderMode } from "../schemas";

export interface NotificationContext {
  reminder: TReminder;
  alertName: string;
  alertMs: number;
}

/**
 * Sends notifications through all configured channels for a reminder
 */
export async function sendNotifications(
  context: NotificationContext,
  contacts: TReminderMode[],
): Promise<void> {
  const { reminder, alertName, alertMs } = context;

  logger.info("Sending notifications", {
    reminderId: reminder.id,
    reminderTitle: reminder.title,
    alertName,
    contactCount: contacts.length,
    modes: contacts.map((c) => c.mode),
  });

  for (const contact of contacts) {
    try {
      switch (contact.mode) {
        case "email":
          logger.info("Sending email notification", {
            reminderId: reminder.id,
            to: contact.address,
          });
          await sendReminderEmail(
            contact.address,
            reminder,
            alertName,
            alertMs,
          );
          logger.info("Email notification sent", {
            reminderId: reminder.id,
            to: contact.address,
          });
          break;

        case "sms":
          // Will be implemented in Phase 5
          logger.warn("SMS notifications not yet implemented", {
            reminderId: reminder.id,
          });
          break;

        case "push":
          // Will be implemented in Phase 4
          logger.warn("Push notifications not yet implemented", {
            reminderId: reminder.id,
          });
          break;

        case "call":
        case "ical":
          logger.warn("Notification mode not yet implemented", {
            mode: contact.mode,
            reminderId: reminder.id,
          });
          break;

        default:
          logger.warn("Unknown notification mode", {
            mode: contact.mode,
            reminderId: reminder.id,
          });
      }
    } catch (error) {
      logger.error("Failed to send notification", {
        error: error instanceof Error ? error.message : String(error),
        mode: contact.mode,
        reminderId: reminder.id,
      });
      // Continue with other contacts even if one fails
    }
  }
}
