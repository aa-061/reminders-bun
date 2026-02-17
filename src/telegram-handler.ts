import { logger } from "./logger";
import type { TReminder } from "./types";

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

interface TelegramSendMessageResponse {
  ok: boolean;
  result?: {
    message_id: number;
    chat: {
      id: number;
    };
    text: string;
  };
  error_code?: number;
  description?: string;
}

interface TelegramGetMeResponse {
  ok: boolean;
  result?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
  };
}

/**
 * Gets the Telegram bot token from environment
 */
function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

/**
 * Validates that the Telegram bot is properly configured
 */
export async function validateTelegramBot(): Promise<boolean> {
  const token = getBotToken();
  if (!token) {
    logger.warn("Telegram bot token not configured");
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}${token}/getMe`);
    const data: TelegramGetMeResponse = await response.json();

    if (data.ok && data.result) {
      logger.info("Telegram bot validated", {
        botUsername: data.result.username,
        botId: data.result.id,
      });
      return true;
    }

    logger.error("Telegram bot validation failed", { response: data });
    return false;
  } catch (error) {
    logger.error("Failed to validate Telegram bot", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Escapes special characters for Telegram MarkdownV2 format
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

/**
 * Formats a reminder as a Telegram message
 */
function formatReminderMessage(
  reminder: TReminder,
  alertName?: string
): string {
  const eventDate = new Date(reminder.date);
  const formattedDate = eventDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = eventDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Build message parts
  const parts: string[] = [];

  // Header with bell emoji
  parts.push(`🔔 *${escapeMarkdown(reminder.title)}*`);
  parts.push("");

  // Alert badge if present
  if (alertName) {
    parts.push(`⏰ _${escapeMarkdown(alertName)}_`);
    parts.push("");
  }

  // Date and time
  parts.push(`📅 ${escapeMarkdown(formattedDate)}`);
  parts.push(`🕐 ${escapeMarkdown(formattedTime)}`);

  // Location if present
  if (reminder.location) {
    parts.push(`📍 ${escapeMarkdown(reminder.location)}`);
  }

  // Recurring badge
  if (reminder.is_recurring) {
    parts.push(`🔄 _Recurring reminder_`);
  }

  // Description if present
  if (reminder.description) {
    parts.push("");
    parts.push("───────────────");
    parts.push(escapeMarkdown(reminder.description));
  }

  return parts.join("\n");
}

/**
 * Sends a Telegram message to a chat
 * @param chatId - The Telegram chat ID (can be user ID or group ID)
 * @param text - The message text (supports MarkdownV2)
 * @param parseMode - Parse mode for formatting (default: MarkdownV2)
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  parseMode: "MarkdownV2" | "HTML" | undefined = "MarkdownV2"
): Promise<boolean> {
  const token = getBotToken();
  if (!token) {
    logger.error("Telegram bot token not configured");
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}${token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    const data: TelegramSendMessageResponse = await response.json();

    if (data.ok) {
      logger.info("Telegram message sent", {
        chatId,
        messageId: data.result?.message_id,
      });
      return true;
    }

    logger.error("Failed to send Telegram message", {
      chatId,
      errorCode: data.error_code,
      description: data.description,
    });

    // Handle specific error codes
    if (data.error_code === 403) {
      logger.warn("Bot was blocked by user", { chatId });
    } else if (data.error_code === 400 && data.description?.includes("chat not found")) {
      logger.warn("Chat not found - user needs to start the bot first", { chatId });
    }

    return false;
  } catch (error) {
    logger.error("Error sending Telegram message", {
      error: error instanceof Error ? error.message : String(error),
      chatId,
    });
    return false;
  }
}

/**
 * Sends a reminder notification via Telegram
 */
export async function sendTelegramReminder(
  chatId: string,
  reminder: TReminder,
  alertName?: string
): Promise<boolean> {
  const message = formatReminderMessage(reminder, alertName);
  return sendTelegramMessage(chatId, message);
}

/**
 * Sends a simple text message (plain text, no formatting)
 */
export async function sendTelegramText(
  chatId: string,
  text: string
): Promise<boolean> {
  return sendTelegramMessage(chatId, text, undefined);
}

/**
 * Gets bot info including the username for deep linking
 */
export async function getTelegramBotInfo(): Promise<{
  username: string;
  id: number;
} | null> {
  const token = getBotToken();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}${token}/getMe`);
    const data: TelegramGetMeResponse = await response.json();

    if (data.ok && data.result) {
      return {
        username: data.result.username,
        id: data.result.id,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Generates a Telegram deep link for starting a chat with the bot
 * @param startParam - Optional start parameter to pass to the bot
 */
export function getTelegramDeepLink(startParam?: string): string {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "your_bot";

  if (startParam) {
    return `https://t.me/${botUsername}?start=${startParam}`;
  }

  return `https://t.me/${botUsername}`;
}
