import { getReminders } from "./route-helpers";

export const getActiveRemindersRoute = async () => {
  const reminders = await getReminders();
  return reminders.filter((r) => r.is_active);
};
