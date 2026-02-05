import { sendEmail } from "../email-handlers";
import type { TReminder, TReminderMode } from "../schemas";
import { logger } from "../logger";

/**
 * Sends notifications to all contacts for a reminder.
 *
 * @param reminder - The reminder object containing notification details
 * @param contacts - Array of contacts to notify (email, sms, push, etc.)
 */
export async function sendNotifications(
  reminder: TReminder,
  contacts: TReminderMode[]
): Promise<void> {
  for (const contact of contacts) {
    if (contact.mode === "email") {
      try {
        await sendEmail(
          contact.address,
          reminder.title,
          reminder.description
        );
      } catch (error) {
        logger.error("Failed to send email notification", {
          to: contact.address,
          title: reminder.title,
          error: (error as Error).message,
        });
        // Continue with other contacts even if one fails
      }
    }
    // Future modes (sms, push, ical) can be added here
  }
}
