import type { TReminder } from "../schemas";
import { getReminderRepository } from "../repositories";

export const getReminders = async (): Promise<TReminder[]> => {
  const repo = getReminderRepository();
  return repo.findAll();
};

export const getReminderById = async (id: number): Promise<TReminder | null> => {
  const repo = getReminderRepository();
  return repo.findById(id);
};
