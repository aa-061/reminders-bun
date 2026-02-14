import type { Context } from "elysia";
import { getAlertPresetRepository } from "../repositories";
import { auth } from "../auth";
import { logger } from "../logger";

export const deleteAlertPresetRoute = async ({ params, request, set }: Context) => {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session || !session.user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  const id = Number((params as { id: string }).id);

  if (isNaN(id)) {
    set.status = 400;
    return { error: "Invalid alert preset ID" };
  }

  try {
    const repository = getAlertPresetRepository();
    await repository.delete(id, session.user.id);

    logger.info("Alert preset deleted", { id, userId: session.user.id });
    return { status: "success", message: "Alert preset deleted" };
  } catch (error) {
    set.status = 500;
    return {
      error: "Failed to delete alert preset",
      details: (error as Error).message,
    };
  }
};
