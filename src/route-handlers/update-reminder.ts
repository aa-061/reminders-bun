import { type Context } from "elysia";
import { getReminderById } from "./route-helpers";
import type { TCreateReminderInput } from "../schemas";
import { getReminderRepository } from "../repositories";
import { logger } from "../logger";

export const updateReminderRoute = async ({ params: { id }, body, set }: Context) => {
  const r = body as TCreateReminderInput;
  const existing = await getReminderById(Number(id));

  if (!existing) {
    set.status = 404;
    return { error: "Reminder not found" };
  }

  try {
    const repo = getReminderRepository();
    const updated = await repo.update(Number(id), r);

    if (!updated) {
      set.status = 500;
      return { error: "Failed to update reminder" };
    }
  } catch (dbError) {
    logger.error("Database update error", { id, error: (dbError as Error).message });
    set.status = 500;
    return {
      error: "Failed to update reminder due to database error.",
      details: (dbError as Error).message,
    };
  }

  return { id: Number(id), ...r };
};
