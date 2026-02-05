import type { Context } from "elysia";
import { verifyQStashSignature } from "../qstash/verify";
import { cleanupStaleReminders } from "../cleanup";
import { logger } from "../logger";

export const webhookCleanupRoute = async ({ request, body, set }: Context) => {
  const signature = request.headers.get("upstash-signature");
  const rawBody = JSON.stringify(body);

  const isValid = await verifyQStashSignature(signature, rawBody);
  if (!isValid) {
    logger.warn("Invalid QStash signature on cleanup webhook");
    set.status = 401;
    return { error: "Invalid signature" };
  }

  logger.info("Cleanup triggered via webhook");
  const result = await cleanupStaleReminders();

  return { status: "ok", ...result };
};
