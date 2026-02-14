import type { Context } from "elysia";
import { getAlertPresetRepository } from "../repositories";
import { CreateAlertPresetInputSchema } from "../schemas";
import { auth } from "../auth";
import { logger } from "../logger";

export const createAlertPresetRoute = async ({ body, request, set }: Context) => {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session || !session.user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  try {
    const validated = CreateAlertPresetInputSchema.parse(body);
    const repository = getAlertPresetRepository();
    const alert = await repository.create(session.user.id, validated);

    set.status = 201;
    logger.info("Alert preset created", { id: alert.id, name: alert.name, userId: session.user.id });
    return alert;
  } catch (error) {
    if ((error as Error).name === "ZodError") {
      set.status = 400;
      return {
        error: "Validation failed",
        details: (error as Error).message,
      };
    }

    set.status = 500;
    return {
      error: "Failed to create alert preset",
      details: (error as Error).message,
    };
  }
};
