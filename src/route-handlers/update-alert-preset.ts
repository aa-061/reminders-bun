import type { Context } from "elysia";
import { getAlertPresetRepository } from "../repositories";
import { CreateAlertPresetInputSchema } from "../schemas";
import { auth } from "../auth";
import { logger } from "../logger";

export const updateAlertPresetRoute = async ({
  params,
  body,
  request,
  set,
}: Context) => {
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
    const validated = CreateAlertPresetInputSchema.partial().parse(body);
    const repository = getAlertPresetRepository();
    const alert = await repository.update(id, session.user.id, validated);

    logger.info("Alert preset updated", { id: alert.id, userId: session.user.id });
    return alert;
  } catch (error) {
    if ((error as Error).name === "ZodError") {
      set.status = 400;
      return {
        error: "Validation failed",
        details: (error as Error).message,
      };
    }

    if ((error as Error).message.includes("not found")) {
      set.status = 404;
      return {
        error: "Alert preset not found",
        details: (error as Error).message,
      };
    }

    set.status = 500;
    return {
      error: "Failed to update alert preset",
      details: (error as Error).message,
    };
  }
};
