import { getReminderRepository } from "./repositories";
import { logger } from "./logger";

export const updateLastAlertTime = async (id: number, time: Date) => {
  const repo = getReminderRepository();
  const updated = await repo.updateLastAlertTime(id, time);
  if (!updated) {
    logger.warn("Failed to update last_alert_time", { id });
  }
};

export const deactivateReminder = async (id: number, title: string) => {
  const repo = getReminderRepository();
  const deactivated = await repo.deactivate(id);
  if (!deactivated) {
    logger.warn("Failed to deactivate reminder", { id, title });
  }
};
