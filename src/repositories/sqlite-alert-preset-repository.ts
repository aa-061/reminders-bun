import type { Client } from "@libsql/client";
import type { IAlertPresetRepository } from "./alert-preset-repository.interface";
import type { TAlertPresetRecord, TCreateAlertPresetInput } from "../schemas";

type RawRow = Record<string, string | number | bigint | ArrayBuffer | null>;

export class SQLiteAlertPresetRepository implements IAlertPresetRepository {
  constructor(private client: Client) {}

  private transformRow(row: RawRow): TAlertPresetRecord {
    return {
      id: Number(row.id),
      name: row.name as string,
      ms: Number(row.ms),
      user_id: row.user_id as string,
    };
  }

  async findByUserId(userId: string): Promise<TAlertPresetRecord[]> {
    const result = await this.client.execute({
      sql: "SELECT * FROM alerts WHERE user_id = ? ORDER BY ms ASC",
      args: [userId],
    });
    return result.rows.map((row) => this.transformRow(row as RawRow));
  }

  async findById(id: number): Promise<TAlertPresetRecord | null> {
    const result = await this.client.execute({
      sql: "SELECT * FROM alerts WHERE id = ?",
      args: [id],
    });
    if (result.rows.length === 0) return null;
    return this.transformRow(result.rows[0] as RawRow);
  }

  async create(userId: string, input: TCreateAlertPresetInput): Promise<TAlertPresetRecord> {
    const result = await this.client.execute({
      sql: `INSERT INTO alerts (name, ms, user_id)
            VALUES (?, ?, ?) RETURNING *`,
      args: [input.name, input.ms, userId],
    });

    if (result.rows.length === 0) {
      throw new Error("Failed to create alert preset");
    }

    return this.transformRow(result.rows[0] as RawRow);
  }

  async update(
    id: number,
    userId: string,
    input: Partial<TCreateAlertPresetInput>,
  ): Promise<TAlertPresetRecord> {
    const updates: string[] = [];
    const args: (string | number)[] = [];

    if (input.name !== undefined) {
      updates.push("name = ?");
      args.push(input.name);
    }
    if (input.ms !== undefined) {
      updates.push("ms = ?");
      args.push(input.ms);
    }

    if (updates.length === 0) {
      // No updates provided, just return the existing alert
      const existing = await this.findById(id);
      if (!existing) {
        throw new Error("Alert preset not found");
      }
      return existing;
    }

    args.push(id, userId);

    const result = await this.client.execute({
      sql: `UPDATE alerts SET ${updates.join(", ")}
            WHERE id = ? AND user_id = ? RETURNING *`,
      args,
    });

    if (result.rows.length === 0) {
      throw new Error("Alert preset not found or unauthorized");
    }

    return this.transformRow(result.rows[0] as RawRow);
  }

  async delete(id: number, userId: string): Promise<void> {
    await this.client.execute({
      sql: "DELETE FROM alerts WHERE id = ? AND user_id = ?",
      args: [id, userId],
    });
  }
}
