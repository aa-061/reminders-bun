import type { TModeRecord, TCreateModeInput } from "@/schemas";

export interface IModeRepository {
  findByUserId(userId: string): Promise<TModeRecord[]>;
  findById(id: number): Promise<TModeRecord | null>;
  create(userId: string, input: TCreateModeInput): Promise<TModeRecord>;
  update(
    id: number,
    userId: string,
    input: Partial<TCreateModeInput>,
  ): Promise<TModeRecord>;
  delete(id: number, userId: string): Promise<void>;
  clearDefaults(userId: string): Promise<void>;
}
