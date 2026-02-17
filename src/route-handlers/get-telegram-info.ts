import { getTelegramBotInfo, getTelegramDeepLink } from "../telegram-handler";
import { logger } from "../logger";

export async function handleGetTelegramInfo(): Promise<Response> {
  try {
    const botInfo = await getTelegramBotInfo();

    if (!botInfo) {
      return Response.json(
        {
          configured: false,
          message: "Telegram bot not configured",
        },
        { status: 200 }
      );
    }

    return Response.json({
      configured: true,
      botUsername: botInfo.username,
      deepLink: getTelegramDeepLink(),
      instructions: [
        `1. Click the link or search for @${botInfo.username} in Telegram`,
        "2. Start a chat with the bot by clicking 'Start'",
        "3. The bot will send you your Chat ID",
        "4. Enter your Chat ID in the Reminders app to receive notifications",
      ],
    });
  } catch (error) {
    logger.error("Failed to get Telegram info", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "Failed to get Telegram info" },
      { status: 500 }
    );
  }
}
