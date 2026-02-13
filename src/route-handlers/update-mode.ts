import type { Context } from "elysia";
import { getModeRepository } from "../repositories";
import { CreateModeInputSchema } from "../schemas";
import { auth } from "../auth";
import { logger } from "../logger";

export const updateModeRoute = async ({ params, body, request, set }: Context) => {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session || !session.user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  try {
    const id = parseInt((params as { id: string }).id);
    if (isNaN(id)) {
      set.status = 400;
      return { error: "Invalid mode ID" };
    }

    const validated = CreateModeInputSchema.partial().parse(body);
    const repository = getModeRepository();
    const mode = await repository.update(id, session.user.id, validated);

    logger.info("Mode updated", { id: mode.id, userId: session.user.id });
    return mode;
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
      return { error: (error as Error).message };
    }

    set.status = 500;
    return {
      error: "Failed to update mode",
      details: (error as Error).message,
    };
  }
};
