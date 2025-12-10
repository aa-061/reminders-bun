import { type Context } from "elysia";
import { db } from "../db";
import { getReminderById } from "./route-helpers";
import type { TDeleteReminderOutput } from "../schemas";

export const deleteReminderRoute = ({
  params: { id },
  set,
}: Context): TDeleteReminderOutput => {
  try {
    const foundReminder = getReminderById(Number(id));

    if (!foundReminder) {
      set.status = 404;
      return { status: "fail", error: "Reminder not found" };
    }

    const sql = "DELETE FROM reminders WHERE id = ?";
    const stmt = db.prepare(sql);
    stmt.run(Number(id));

    const deletedReminder = getReminderById(Number(id));

    if (deletedReminder) {
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
