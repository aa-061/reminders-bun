import twilio from "twilio";
import { logger } from "./logger";
import type { TReminder } from "./schemas";

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: twilio.Twilio | null = null;

if (accountSid && authToken) {
  twilioClient = twilio(accountSid, authToken);
  logger.info("Twilio SMS client initialized");
} else {
  logger.warn("Twilio credentials not configured - SMS disabled");
}

/**
 * Checks if SMS is configured
 */
export function isSmsConfigured(): boolean {
  return !!(twilioClient && twilioPhoneNumber);
}

/**
 * Formats a phone number to E.164 format
 * @param phone - Phone number in various formats
 * @returns E.164 formatted number or null if invalid
 */
function formatPhoneNumber(phone: string): string | null {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // If it starts with +, keep it
  if (cleaned.startsWith("+")) {
    // Validate length (E.164 is 8-15 digits after +)
    if (cleaned.length >= 9 && cleaned.length <= 16) {
      return cleaned;
    }
    return null;
  }

  // If it's a US number (10 digits), add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // If it's 11 digits starting with 1, add +
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }

  // For other formats, try adding + if reasonable length
  if (cleaned.length >= 8 && cleaned.length <= 15) {
    return `+${cleaned}`;
  }

  return null;
}

/**
 * Formats a reminder into an SMS message
 */
function formatReminderMessage(
  reminder: TReminder,
  alertName?: string,
  appUrl?: string
): string {
  const eventDate = new Date(reminder.date);
  const formattedDate = eventDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const formattedTime = eventDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  let message = `🔔 ${reminder.title}\n`;
  message += `📅 ${formattedDate} at ${formattedTime}`;

  if (alertName) {
    message += `\n⏰ ${alertName}`;
  }

  if (reminder.location) {
    message += `\n📍 ${reminder.location}`;
  }

  // Add deep link if app URL is configured
  if (appUrl) {
    message += `\n\n${appUrl}/reminders/${reminder.id}`;
  }

  return message;
}

/**
 * Sends an SMS message
 * @param to - Recipient phone number
 * @param body - Message body
 * @returns True if sent successfully
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!twilioClient || !twilioPhoneNumber) {
    logger.error("Twilio not configured");
    return false;
  }

  const formattedNumber = formatPhoneNumber(to);
  if (!formattedNumber) {
    logger.error("Invalid phone number format", { to });
    return false;
  }

  try {
    const message = await twilioClient.messages.create({
      body,
      to: formattedNumber,
      from: twilioPhoneNumber,
    });

    logger.info("SMS sent", {
      sid: message.sid,
      to: formattedNumber,
      status: message.status,
    });

    return true;
  } catch (error: any) {
    logger.error("Failed to send SMS", {
      error: error.message,
      code: error.code,
      to: formattedNumber,
    });

    // Handle specific Twilio errors
    if (error.code === 21608) {
      logger.warn("Phone number not verified (trial account limitation)");
    } else if (error.code === 21211) {
      logger.warn("Invalid phone number");
    }

    return false;
  }
}

/**
 * Sends a reminder notification via SMS
 */
export async function sendSmsReminder(
  to: string,
  reminder: TReminder,
  alertName?: string
): Promise<boolean> {
  const appUrl = process.env.CORS_ORIGIN;
  const message = formatReminderMessage(reminder, alertName, appUrl);
  return sendSms(to, message);
}

/**
 * Validates that an SMS can be sent to a number
 * Useful for checking trial account limitations
 */
export async function validateSmsNumber(phone: string): Promise<{
  valid: boolean;
  formatted: string | null;
  error?: string;
}> {
  const formatted = formatPhoneNumber(phone);

  if (!formatted) {
    return {
      valid: false,
      formatted: null,
      error: "Invalid phone number format",
    };
  }

  if (!twilioClient) {
    return {
      valid: false,
      formatted,
      error: "SMS not configured",
    };
  }

  // On trial accounts, we can check if the number is verified
  // by attempting a lookup (this uses lookup API which may have costs)
  // For simplicity, we'll just validate the format

  return {
    valid: true,
    formatted,
  };
}
