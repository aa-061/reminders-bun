import { logger } from "../logger";
import { sendTelegramText } from "../telegram-handler";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      type: "private" | "group" | "supergroup" | "channel";
    };
    date: number;
    text?: string;
  };
}

export async function handleTelegramWebhook(
  request: Request
): Promise<Response> {
  let update: TelegramUpdate;

  try {
    update = await request.json();
  } catch {
    logger.error("Invalid Telegram webhook payload");
    return new Response("Bad Request", { status: 400 });
  }

  logger.info("Received Telegram update", {
    updateId: update.update_id,
    chatId: update.message?.chat.id,
    text: update.message?.text,
  });

  // Handle /start command
  if (update.message?.text?.startsWith("/start")) {
    const chatId = update.message.chat.id.toString();
    const firstName = update.message.from.first_name;

    const welcomeMessage = `Hello ${firstName}! 👋

Welcome to Reminders Bot!

Your Chat ID is: ${chatId}

To receive reminders via Telegram:
1. Copy your Chat ID above
2. Go to the Reminders web app
3. Add a new notification mode
4. Select "Telegram" and paste your Chat ID

You'll then receive your reminder notifications right here in Telegram! 🔔`;

    await sendTelegramText(chatId, welcomeMessage);
  }

  // Handle /help command
  if (update.message?.text === "/help") {
    const chatId = update.message.chat.id.toString();

    const helpMessage = `Reminders Bot Help 📚

Commands:
/start - Get your Chat ID
/help - Show this help message
/chatid - Get your Chat ID again

Your Chat ID: ${chatId}

This bot sends you reminder notifications from the Reminders web app.
Configure your notifications at: ${process.env.CORS_ORIGIN || "your-app-url"}`;

    await sendTelegramText(chatId, helpMessage);
  }

  // Handle /chatid command
  if (update.message?.text === "/chatid") {
    const chatId = update.message.chat.id.toString();
    await sendTelegramText(chatId, `Your Chat ID is: ${chatId}`);
  }

  return new Response("OK", { status: 200 });
}
