import { db } from "./db";

// Helper to update the last_alert_time
export const updateLastAlertTime = (id: number, time: Date) => {
  db.run("UPDATE reminders SET last_alert_time = ? WHERE id = ?", [
    time.toISOString(),
    id,
  ]);
};

// Helper to deactivate a reminder (NEW)
export const deactivateReminder = (id: number, title: string) => {
  db.run("UPDATE reminders SET is_active = 0 WHERE id = ?", [id]);
  console.log(
    `REMINDER DEACTIVATED: '${title}' finished its schedule or was stale.`
  );
};
