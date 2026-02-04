import { Database } from "bun:sqlite";
import type { IReminderRepository } from "./reminder-repository.interface";
import type { TReminder, TReminderDTO, TCreateReminderInput } from "../schemas";

export class SQLiteReminderRepository implements IReminderRepository {
  constructor(private db: Database) {}

  private getChanges(): number {
    return (
      this.db.query("SELECT changes() as changes").get() as { changes: number }
    ).changes;
  }

  private transformRow(row: TReminderDTO): TReminder {
    return {
      ...row,
      location: row.location ? JSON.parse(row.location) : null,
      reminders: row.reminders ? JSON.parse(row.reminders) : [],
      alerts: row.alerts ? JSON.parse(row.alerts) : [],
      is_recurring: !!row.is_recurring,
      is_active: !!row.is_active,
    };
  }

  findAll(): TReminder[] {
    const results = this.db.query("SELECT * FROM reminders").all() as TReminderDTO[];
    return results.map(this.transformRow);
  }

  findActive(): TReminder[] {
    const results = this.db
      .query("SELECT * FROM reminders WHERE is_active = 1")
      .all() as TReminderDTO[];
    return results.map(this.transformRow);
  }

  findById(id: number): TReminder | null {
    const row = this.db
      .query("SELECT * FROM reminders WHERE id = $id")
      .get({ $id: id }) as TReminderDTO | null;
    return row ? this.transformRow(row) : null;
  }

  create(data: TCreateReminderInput): { id: number } {
    const stmt = this.db.prepare(`
      INSERT INTO reminders (
        title, date, location, description, reminders, alerts,
        is_recurring, recurrence, start_date, end_date, is_active
      ) VALUES (
        $title, $date, $location, $description, $reminders, $alerts,
        $is_recurring, $recurrence, $start_date, $end_date, $is_active
      )
    `);

    stmt.run({
      $title: data.title,
      $date: data.date,
      $location: data.location ? JSON.stringify(data.location) : null,
      $description: data.description,
      $reminders: JSON.stringify(data.reminders ?? []),
      $alerts: JSON.stringify(data.alerts ?? []),
      $is_recurring: data.is_recurring ? 1 : 0,
      $recurrence: data.recurrence ?? null,
      $start_date: data.start_date ?? null,
      $end_date: data.end_date ?? null,
      $is_active: data.is_active !== false ? 1 : 0,
    });

    const result = this.db.query("SELECT last_insert_rowid() as id").get() as {
      id: number;
    };
    return { id: result.id };
  }

  update(id: number, data: Partial<TCreateReminderInput>): boolean {
    const fields: string[] = [];
    const values: Record<string, string | number | null> = { $id: id };

    if (data.title !== undefined) {
      fields.push("title = $title");
      values.$title = data.title;
    }
    if (data.date !== undefined) {
      fields.push("date = $date");
      values.$date = data.date;
    }
    if (data.location !== undefined) {
      fields.push("location = $location");
      values.$location = data.location ? JSON.stringify(data.location) : null;
    }
    if (data.description !== undefined) {
      fields.push("description = $description");
      values.$description = data.description;
    }
    if (data.reminders !== undefined) {
      fields.push("reminders = $reminders");
      values.$reminders = JSON.stringify(data.reminders ?? []);
    }
    if (data.alerts !== undefined) {
      fields.push("alerts = $alerts");
      values.$alerts = JSON.stringify(data.alerts ?? []);
    }
    if (data.is_recurring !== undefined) {
      fields.push("is_recurring = $is_recurring");
      values.$is_recurring = data.is_recurring ? 1 : 0;
    }
    if (data.recurrence !== undefined) {
      fields.push("recurrence = $recurrence");
      values.$recurrence = data.recurrence;
    }
    if (data.start_date !== undefined) {
      fields.push("start_date = $start_date");
      values.$start_date = data.start_date;
    }
    if (data.end_date !== undefined) {
      fields.push("end_date = $end_date");
      values.$end_date = data.end_date;
    }
    if (data.is_active !== undefined) {
      fields.push("is_active = $is_active");
      values.$is_active = data.is_active === false ? 0 : 1;
    }

    if (fields.length === 0) return false;

    const sql = `UPDATE reminders SET ${fields.join(", ")} WHERE id = $id`;
    this.db.prepare(sql).run(values);
    return this.getChanges() > 0;
  }

  delete(id: number): boolean {
    this.db.prepare("DELETE FROM reminders WHERE id = ?").run(id);
    return this.getChanges() > 0;
  }

  deleteBulk(ids: number[]): number {
    if (ids.length === 0) return 0;
    const stmt = this.db.prepare("DELETE FROM reminders WHERE id = ?");
    let totalChanges = 0;
    for (const id of ids) {
      stmt.run(id);
      totalChanges += this.getChanges();
    }
    return totalChanges;
  }

  deactivate(id: number): boolean {
    this.db.prepare("UPDATE reminders SET is_active = 0 WHERE id = ?").run(id);
    return this.getChanges() > 0;
  }

  updateLastAlertTime(id: number, time: Date): boolean {
    this.db
      .prepare("UPDATE reminders SET last_alert_time = ? WHERE id = ?")
      .run(time.toISOString(), id);
    return this.getChanges() > 0;
  }
}
