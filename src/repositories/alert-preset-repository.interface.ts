import type { TAlertPresetRecord, TCreateAlertPresetInput } from "@/schemas";

export interface IAlertPresetRepository {
  findByUserId(userId: string): Promise<TAlertPresetRecord[]>;
  findById(id: number): Promise<TAlertPresetRecord | null>;
  create(userId: string, input: TCreateAlertPresetInput): Promise<TAlertPresetRecord>;
  update(
    id: number,
    userId: string,
    input: Partial<TCreateAlertPresetInput>,
  ): Promise<TAlertPresetRecord>;
  delete(id: number, userId: string): Promise<void>;
}
