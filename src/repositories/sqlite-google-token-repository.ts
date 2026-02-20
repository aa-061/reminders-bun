import type { Client } from "@libsql/client";
import type {
  GoogleTokenRepository,
  GoogleToken,
  SaveTokenInput,
} from "./google-token-repository.interface";

type RawRow = Record<string, string | number | bigint | ArrayBuffer | null>;

export class SqliteGoogleTokenRepository implements GoogleTokenRepository {
  constructor(private client: Client) {}

  private transformRow(row: RawRow): GoogleToken {
    return {
      id: Number(row.id),
      user_id: row.user_id as string,
      access_token: row.access_token as string,
      refresh_token: row.refresh_token as string | null,
      expiry_date: row.expiry_date as number | null,
      scope: row.scope as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }

  async getByUserId(userId: string): Promise<GoogleToken | null> {
    const result = await this.client.execute({
      sql: "SELECT * FROM google_tokens WHERE user_id = ?",
      args: [userId],
    });

    if (result.rows.length === 0) return null;

    return this.transformRow(result.rows[0] as RawRow);
  }

  async save(userId: string, tokens: SaveTokenInput): Promise<void> {
    await this.client.execute({
      sql: `
        INSERT INTO google_tokens (user_id, access_token, refresh_token, expiry_date, scope)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          access_token = excluded.access_token,
          refresh_token = COALESCE(excluded.refresh_token, google_tokens.refresh_token),
          expiry_date = excluded.expiry_date,
          scope = excluded.scope,
          updated_at = CURRENT_TIMESTAMP
      `,
      args: [
        userId,
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.expiry_date || null,
        tokens.scope || null,
      ],
    });
  }

  async delete(userId: string): Promise<boolean> {
    const result = await this.client.execute({
      sql: "DELETE FROM google_tokens WHERE user_id = ?",
      args: [userId],
    });
    return result.rowsAffected > 0;
  }
}
