import type { Client } from "@libsql/client";
import type { IReminderRepository } from "./reminder-repository.interface";
import type { TReminder, TCreateReminderInput } from "../schemas";

// libsql Row values may be bigint for INTEGER columns; use a loose record type
// and convert explicitly in transformRow so the rest of the app sees plain numbers.
type RawRow = Record<string, string | number | bigint | ArrayBuffer | null>;

export class SQLiteReminderRepository implements IReminderRepository {
  constructor(private client: Client) {}

  private transformRow(row: RawRow): TReminder {
    return {
      id: Number(row.id),
      title: row.title as string,
      date: row.date as string,
      location: row.location ? JSON.parse(row.location as string) : null,
      description: row.description as string,
      reminders: row.reminders ? JSON.parse(row.reminders as string) : [],
      alerts: row.alerts ? JSON.parse(row.alerts as string) : [],
      is_recurring: !!row.is_recurring,
      is_active: !!row.is_active,
      recurrence: (row.recurrence as string) ?? null,
      start_date: (row.start_date as string) ?? null,
      end_date: (row.end_date as string) ?? null,
      last_alert_time: (row.last_alert_time as string) ?? null,
    };
  }

  async findAll(): Promise<TReminder[]> {
    const result = await this.client.execute("SELECT * FROM reminders");
    return result.rows.map((row) => this.transformRow(row as RawRow));
  }

  async findActive(): Promise<TReminder[]> {
    const result = await this.client.execute(
      "SELECT * FROM reminders WHERE is_active = 1",
    );
    return result.rows.map((row) => this.transformRow(row as RawRow));
  }

  async findById(id: number): Promise<TReminder | null> {
    const result = await this.client.execute({
      sql: "SELECT * FROM reminders WHERE id = ?",
      args: [id],
    });
    if (result.rows.length === 0) return null;
    return this.transformRow(result.rows[0] as RawRow);
  }

  async create(data: TCreateReminderInput): Promise<{ id: number }> {
    const result = await this.client.execute({
      sql: `
        INSERT INTO reminders (
          title, date, location, description, reminders, alerts,
          is_recurring, recurrence, start_date, end_date, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        data.title,
        data.date,
        data.location ? JSON.stringify(data.location) : null,
        data.description,
        JSON.stringify(data.reminders ?? []),
        JSON.stringify(data.alerts ?? []),
        data.is_recurring ? 1 : 0,
        data.recurrence ?? null,
        data.start_date ?? null,
        data.end_date ?? null,
        data.is_active !== false ? 1 : 0,
      ],
    });
    return { id: Number(result.lastInsertRowid) };
  }

  async update(id: number, data: Partial<TCreateReminderInput>): Promise<boolean> {
    const fields: string[] = [];
    const args: (string | number | null)[] = [];

    if (data.title !== undefined) {
      fields.push("title = ?");
      args.push(data.title);
    }
    if (data.date !== undefined) {
      fields.push("date = ?");
      args.push(data.date);
    }
    if (data.location !== undefined) {
      fields.push("location = ?");
      args.push(data.location ? JSON.stringify(data.location) : null);
    }
    if (data.description !== undefined) {
      fields.push("description = ?");
      args.push(data.description);
    }
    if (data.reminders !== undefined) {
      fields.push("reminders = ?");
      args.push(JSON.stringify(data.reminders ?? []));
    }
    if (data.alerts !== undefined) {
      fields.push("alerts = ?");
      args.push(JSON.stringify(data.alerts ?? []));
    }
    if (data.is_recurring !== undefined) {
      fields.push("is_recurring = ?");
      args.push(data.is_recurring ? 1 : 0);
    }
    if (data.recurrence !== undefined) {
      fields.push("recurrence = ?");
      args.push(data.recurrence);
    }
    if (data.start_date !== undefined) {
      fields.push("start_date = ?");
      args.push(data.start_date);
    }
    if (data.end_date !== undefined) {
      fields.push("end_date = ?");
      args.push(data.end_date);
    }
    if (data.is_active !== undefined) {
      fields.push("is_active = ?");
      args.push(data.is_active === false ? 0 : 1);
    }

    if (fields.length === 0) return false;

    args.push(id); // WHERE id = ?
    const result = await this.client.execute({
      sql: `UPDATE reminders SET ${fields.join(", ")} WHERE id = ?`,
      args,
    });
    return result.rowsAffected > 0;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.client.execute({
      sql: "DELETE FROM reminders WHERE id = ?",
      args: [id],
    });
    return result.rowsAffected > 0;
  }

  async deleteBulk(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => "?").join(",");
    const result = await this.client.execute({
      sql: `DELETE FROM reminders WHERE id IN (${placeholders})`,
      args: ids,
    });
    return result.rowsAffected;
  }

  async deactivate(id: number): Promise<boolean> {
    const result = await this.client.execute({
      sql: "UPDATE reminders SET is_active = 0 WHERE id = ?",
      args: [id],
    });
    return result.rowsAffected > 0;
  }

  async updateLastAlertTime(id: number, time: Date): Promise<boolean> {
    const result = await this.client.execute({
      sql: "UPDATE reminders SET last_alert_time = ? WHERE id = ?",
      args: [time.toISOString(), id],
    });
    return result.rowsAffected > 0;
  }
}
