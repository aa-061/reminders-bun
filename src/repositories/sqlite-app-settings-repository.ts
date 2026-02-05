import type { Client } from "@libsql/client";
import type { IAppSettingsRepository } from "./app-settings-repository.interface";

export class SQLiteAppSettingsRepository implements IAppSettingsRepository {
  constructor(private client: Client) {}

  async get(key: string): Promise<string | null> {
    const result = await this.client.execute({
      sql: "SELECT value FROM app_settings WHERE key = ?",
      args: [key],
    });
    const row = result.rows[0];
    return row ? (row.value as string) : null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.execute({
      sql: "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
      args: [key, value],
    });
  }
}
