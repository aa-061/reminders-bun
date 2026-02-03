import { type Context } from "elysia";
import { getReminderById } from "./route-helpers";
import type { TCreateReminderInput } from "../schemas";
import { getReminderRepository } from "../repositories";

export const updateReminderRoute = ({ params: { id }, body, set }: Context) => {
  const r = body as TCreateReminderInput;
  const existing = getReminderById(Number(id));

  if (!existing) {
    set.status = 404;
    return { error: "Reminder not found" };
  }

  try {
    const repo = getReminderRepository();
    const updated = repo.update(Number(id), r);

    if (!updated) {
      set.status = 500;
      return { error: "Failed to update reminder" };
    }
  } catch (dbError) {
    console.error("Database Update Error:", dbError);
    set.status = 500;
    return {
      error: "Failed to update reminder due to database error.",
      details: (dbError as Error).message,
    };
  }

  return { id: Number(id), ...r };
};
