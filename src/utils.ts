import { getReminderRepository } from "./repositories";

export const updateLastAlertTime = (id: number, time: Date) => {
  const repo = getReminderRepository();
  const updated = repo.updateLastAlertTime(id, time);
  if (!updated) {
    console.warn(`Failed to update last_alert_time for reminder ${id}`);
  }
};

export const deactivateReminder = (id: number, title: string) => {
  const repo = getReminderRepository();
  const deactivated = repo.deactivate(id);
  if (!deactivated) {
    console.warn(`Failed to deactivate reminder '${title}' (id: ${id})`);
  }
};
