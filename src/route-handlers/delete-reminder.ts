import { type Context } from "elysia";
import { getReminderById } from "./route-helpers";
import { getReminderRepository } from "../repositories";

export const deleteReminderRoute = async ({
  params: { id },
  set,
}: Context) => {
  try {
    const foundReminder = await getReminderById(Number(id));

    if (!foundReminder) {
      set.status = 404;
      return { status: "fail", error: "Reminder not found" };
    }

    const repo = getReminderRepository();
    const deleted = await repo.delete(Number(id));

    if (!deleted) {
      set.status = 500;
      return { status: "fail", error: "Failed to delete reminder" };
    }

    return {
      status: "success",
      deletedReminder: foundReminder,
    };
  } catch (error) {
    set.status = 500;
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      status: "fail",
      error: `Failed to delete reminder with id ${id}. Error: ${errorMessage}`,
    };
  }
};
