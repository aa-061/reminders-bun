import type { Context } from "elysia";
import { getModeRepository } from "../repositories";
import { auth } from "../auth";
import { logger } from "../logger";

export const deleteModeRoute = async ({ params, request, set }: Context) => {
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

    const repository = getModeRepository();
    await repository.delete(id, session.user.id);

    logger.info("Mode deleted", { id, userId: session.user.id });
    return { status: "deleted", id };
  } catch (error) {
    set.status = 500;
    return {
      error: "Failed to delete mode",
      details: (error as Error).message,
    };
  }
};
