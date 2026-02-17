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
import { getAlertPresetsRoute } from "./get-alert-presets";
import { createAlertPresetRoute } from "./create-alert-preset";
import { updateAlertPresetRoute } from "./update-alert-preset";
import { deleteAlertPresetRoute } from "./delete-alert-preset";
import { handleGetTelegramInfo } from "./get-telegram-info";
import { handleTelegramWebhook } from "./webhook-telegram";
import {
  handleGetVapidKey,
  handlePushSubscribe,
  handlePushUnsubscribe,
  handleGetSubscriptions,
  handleTestPush,
} from "./push-subscription";

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
  getAlertPresetsRoute,
  createAlertPresetRoute,
  updateAlertPresetRoute,
  deleteAlertPresetRoute,
};

export { handleGetTelegramInfo, handleTelegramWebhook };
export {
  handleGetVapidKey,
  handlePushSubscribe,
  handlePushUnsubscribe,
  handleGetSubscriptions,
  handleTestPush,
};
export * from "./route-helpers";
