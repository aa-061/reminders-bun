import type { IReminderRepository } from "./reminder-repository.interface";
import { SQLiteReminderRepository } from "./sqlite-reminder-repository";

let repository: IReminderRepository | null = null;

export function getReminderRepository(): IReminderRepository {
  if (!repository) {
    repository = new SQLiteReminderRepository();
  }
  return repository;
}

export type { IReminderRepository };
