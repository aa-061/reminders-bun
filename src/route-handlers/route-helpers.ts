import { db } from "../db";
import type { TReminder, TReminderDTO } from "../schemas";

export const getReminders = (): TReminder[] => {
  const query = db.query("SELECT * FROM reminders");

  const results = query.all() as TReminderDTO[];

  return results.map((r) => ({
    ...r,
    location: r.location ? JSON.parse(r.location) : null,
    reminders: r.reminders ? JSON.parse(r.reminders) : [],
    alerts: r.alerts ? JSON.parse(r.alerts) : [],
    is_recurring: !!r.is_recurring,
    is_active: !!r.is_active,
  }));
};

export const getReminderById = (id: number): TReminder | null => {
  const reminder = db
    .query("SELECT * FROM reminders WHERE id = $id")
    .get({ $id: id }) as TReminderDTO;

  if (!reminder) return null;

  return {
    ...reminder,
    location: reminder.location ? JSON.parse(reminder.location) : null,
    reminders: reminder.reminders ? JSON.parse(reminder.reminders) : [],
    alerts: reminder.alerts ? JSON.parse(reminder.alerts) : [],
    is_recurring: !!reminder.is_recurring,
    is_active: !!reminder.is_active,
  };
};
