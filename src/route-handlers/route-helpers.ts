import { db } from "../db";

export const getReminders = () => {
  const query = db.query("SELECT * FROM reminders");
  const results = query.all() as any[];

  return results.map((r) => ({
    ...r,
    location: r.location ? JSON.parse(r.location) : null,
    reminders: r.reminders ? JSON.parse(r.reminders) : [],
    alerts: r.alerts ? JSON.parse(r.alerts) : [],
    is_recurring: !!r.is_recurring,
    last_alert_time: r.last_alert_time ? new Date(r.last_alert_time) : null,
    is_active: !!r.is_active, // Parse 0/1 to boolean
    end_date: r.end_date ? new Date(r.end_date) : null, // ADDED: Parse end_date
  }));
};

export const getReminderById = (id: number) => {
  const reminder = db
    .query("SELECT * FROM reminders WHERE id = $id")
    .get({ $id: id }) as any;
  if (!reminder) return null;
  return {
    ...reminder,
    location: reminder.location ? JSON.parse(reminder.location) : null,
    reminders: reminder.reminders ? JSON.parse(reminder.reminders) : [],
    alerts: reminder.alerts ? JSON.parse(reminder.alerts) : [],
    is_recurring: !!reminder.is_recurring,
    last_alert_time: reminder.last_alert_time
      ? new Date(reminder.last_alert_time)
      : null,
    is_active: !!reminder.is_active, // Parse 0/1 to boolean
    end_date: reminder.end_date ? new Date(reminder.end_date) : null, // ADDED: Parse end_date
  };
};
