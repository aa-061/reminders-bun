import type { Context } from "elysia";
import { getModeRepository } from "../repositories";
import { CreateModeInputSchema } from "../schemas";
import { auth } from "../auth";
import { logger } from "../logger";

export const createModeRoute = async ({ body, request, set }: Context) => {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session || !session.user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  try {
    const validated = CreateModeInputSchema.parse(body);
    const repository = getModeRepository();
    const mode = await repository.create(session.user.id, validated);

    set.status = 201;
    logger.info("Mode created", { id: mode.id, mode: mode.mode, userId: session.user.id });
    return mode;
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
      error: "Failed to create mode",
      details: (error as Error).message,
    };
  }
};
