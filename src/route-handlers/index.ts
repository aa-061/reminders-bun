import { createReminderRoute } from "./create-reminder";
import { deleteReminderRoute } from "./delete-reminder";
import { deleteRemindersBulkRoute } from "./delete-reminders-bulk";
import { getActiveRemindersRoute } from "./get-active-reminders";
import { getAllRemindersRoute } from "./get-all-reminders";
import { getReminderByIdRoute } from "./get-reminder";
import { updateReminderRoute } from "./update-reminder";
import { getModesRoute } from "./get-modes";
import { createModeRoute } from "./create-mode";
import { updateModeRoute } from "./update-mode";
import { deleteModeRoute } from "./delete-mode";

export const routes = {
  getReminderByIdRoute,
  createReminderRoute,
  updateReminderRoute,
  deleteReminderRoute,
  deleteRemindersBulkRoute,
  getActiveRemindersRoute,
  getAllRemindersRoute,
  getModesRoute,
  createModeRoute,
  updateModeRoute,
  deleteModeRoute,
};

export * from "./route-helpers";
