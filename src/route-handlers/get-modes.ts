import type { Context } from "elysia";
import { getModeRepository } from "../repositories";
import { auth } from "../auth";

export const getModesRoute = async ({ request, set }: Context) => {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session || !session.user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  try {
    const repository = getModeRepository();
    const modes = await repository.findByUserId(session.user.id);
    return modes;
  } catch (error) {
    set.status = 500;
    return {
      error: "Failed to fetch modes",
      details: (error as Error).message,
    };
  }
};
