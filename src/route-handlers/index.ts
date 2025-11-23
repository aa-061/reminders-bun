import { type Context } from "elysia";
import { db } from "../db";
import { createReminderRoute } from "./create-reminder";
import { getReminderById } from "./route-helpers";
import { updateReminderRoute } from "./update-reminder";

const getReminderByIdRoute = ({ params: { id }, set }: Context) => {
  const r = getReminderById(Number(id));
  if (!r) {
    set.status = 404;
    return { error: "Reminder not found" };
  }
  return r;
};

const deleteReminderRoute = ({ params: { id } }: Context) => {
  db.run("DELETE FROM reminders WHERE id = ?", [id]);
  return { message: "Deleted" };
};

export * from "./route-helpers";

export const routes = {
  getReminderByIdRoute,
  createReminderRoute,
  updateReminderRoute,
  deleteReminderRoute,
};
