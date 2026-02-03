import type { TReminder, TCreateReminderInput } from "../schemas";

export interface IReminderRepository {
  findAll(): TReminder[];
  findActive(): TReminder[];
  findById(id: number): TReminder | null;
  create(data: TCreateReminderInput): { id: number };
  update(id: number, data: Partial<TCreateReminderInput>): boolean;
  delete(id: number): boolean;
  deleteBulk(ids: number[]): number;
  deactivate(id: number): boolean;
  updateLastAlertTime(id: number, time: Date): boolean;
}
