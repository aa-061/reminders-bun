import type { TReminder, TCreateReminderInput } from "../schemas";

export interface IReminderRepository {
  findAll(): Promise<TReminder[]>;
  findActive(): Promise<TReminder[]>;
  findById(id: number): Promise<TReminder | null>;
  create(data: TCreateReminderInput): Promise<{ id: number }>;
  update(id: number, data: Partial<TCreateReminderInput>): Promise<boolean>;
  delete(id: number): Promise<boolean>;
  deleteBulk(ids: number[]): Promise<number>;
  deactivate(id: number): Promise<boolean>;
  updateLastAlertTime(id: number, time: Date): Promise<boolean>;
}
