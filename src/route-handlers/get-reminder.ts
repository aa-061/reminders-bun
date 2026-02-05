import { type Context } from "elysia";
import { getReminderById } from "./route-helpers";

export const getReminderByIdRoute = async ({ params: { id }, set }: Context) => {
  const r = await getReminderById(Number(id));
  if (!r) {
    set.status = 404;
    return { error: "Reminder not found" };
  }
  return r;
};
