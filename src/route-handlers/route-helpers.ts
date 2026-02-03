import type { TReminder } from "../schemas";
import { getReminderRepository } from "../repositories";

export const getReminders = (): TReminder[] => {
  const repo = getReminderRepository();
  return repo.findAll();
};

export const getReminderById = (id: number): TReminder | null => {
  const repo = getReminderRepository();
  return repo.findById(id);
};
