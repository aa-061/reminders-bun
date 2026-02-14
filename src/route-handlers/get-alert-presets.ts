import type { Context } from "elysia";
import { getAlertPresetRepository } from "../repositories";
import { auth } from "../auth";

export const getAlertPresetsRoute = async ({ request, set }: Context) => {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session || !session.user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  try {
    const repository = getAlertPresetRepository();
    const alerts = await repository.findByUserId(session.user.id);
    return alerts;
  } catch (error) {
    set.status = 500;
    return {
      error: "Failed to fetch alert presets",
      details: (error as Error).message,
    };
  }
};
