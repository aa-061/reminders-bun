import type { Client } from "@libsql/client";
import type { IModeRepository } from "./mode-repository.interface";
import type { TModeRecord, TCreateModeInput } from "../schemas";

type RawRow = Record<string, string | number | bigint | ArrayBuffer | null>;

export class SQLiteModeRepository implements IModeRepository {
  constructor(private client: Client) {}

  private transformRow(row: RawRow): TModeRecord {
    return {
      id: Number(row.id),
      mode: row.mode as string,
      address: row.address as string,
      isDefault: row.is_default === 1,
      user_id: row.user_id as string,
    };
  }

  async findByUserId(userId: string): Promise<TModeRecord[]> {
    const result = await this.client.execute({
      sql: "SELECT * FROM modes WHERE user_id = ? ORDER BY is_default DESC, created_at DESC",
      args: [userId],
    });
    return result.rows.map((row) => this.transformRow(row as RawRow));
  }

  async findById(id: number): Promise<TModeRecord | null> {
    const result = await this.client.execute({
      sql: "SELECT * FROM modes WHERE id = ?",
      args: [id],
    });
    if (result.rows.length === 0) return null;
    return this.transformRow(result.rows[0] as RawRow);
  }

  async create(userId: string, input: TCreateModeInput): Promise<TModeRecord> {
    // If setting as default, clear other defaults first
    if (input.isDefault) {
      await this.clearDefaults(userId);
    }

    const result = await this.client.execute({
      sql: `INSERT INTO modes (mode, address, is_default, user_id)
            VALUES (?, ?, ?, ?) RETURNING *`,
      args: [input.mode, input.address, input.isDefault ? 1 : 0, userId],
    });

    if (result.rows.length === 0) {
      throw new Error("Failed to create mode");
    }

    return this.transformRow(result.rows[0] as RawRow);
  }

  async update(
    id: number,
    userId: string,
    input: Partial<TCreateModeInput>,
  ): Promise<TModeRecord> {
    // If setting as default, clear other defaults first
    if (input.isDefault) {
      await this.clearDefaults(userId);
    }

    const updates: string[] = [];
    const args: (string | number)[] = [];

    if (input.mode !== undefined) {
      updates.push("mode = ?");
      args.push(input.mode);
    }
    if (input.address !== undefined) {
      updates.push("address = ?");
      args.push(input.address);
    }
    if (input.isDefault !== undefined) {
      updates.push("is_default = ?");
      args.push(input.isDefault ? 1 : 0);
    }

    if (updates.length === 0) {
      // No updates provided, just return the existing mode
      const existing = await this.findById(id);
      if (!existing) {
        throw new Error("Mode not found");
      }
      return existing;
    }

    args.push(id, userId);

    const result = await this.client.execute({
      sql: `UPDATE modes SET ${updates.join(", ")}
            WHERE id = ? AND user_id = ? RETURNING *`,
      args,
    });

    if (result.rows.length === 0) {
      throw new Error("Mode not found or unauthorized");
    }

    return this.transformRow(result.rows[0] as RawRow);
  }

  async delete(id: number, userId: string): Promise<void> {
    await this.client.execute({
      sql: "DELETE FROM modes WHERE id = ? AND user_id = ?",
      args: [id, userId],
    });
  }

  async clearDefaults(userId: string): Promise<void> {
    await this.client.execute({
      sql: "UPDATE modes SET is_default = 0 WHERE user_id = ?",
      args: [userId],
    });
  }
}
