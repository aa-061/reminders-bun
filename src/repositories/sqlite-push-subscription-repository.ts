import type { Client } from "@libsql/client";
import type {
  IPushSubscriptionRepository,
  PushSubscription,
  CreatePushSubscriptionInput,
} from "./push-subscription-repository.interface";

type RawRow = Record<string, string | number | bigint | ArrayBuffer | null>;

export class SQLitePushSubscriptionRepository implements IPushSubscriptionRepository {
  constructor(private client: Client) {}

  private transformRow(row: RawRow): PushSubscription {
    return {
      id: Number(row.id),
      user_id: row.user_id as string,
      endpoint: row.endpoint as string,
      keys_p256dh: row.keys_p256dh as string,
      keys_auth: row.keys_auth as string,
      created_at: row.created_at as string,
      last_used_at: row.last_used_at as string | null,
      user_agent: row.user_agent as string | null,
    };
  }

  async create(input: CreatePushSubscriptionInput): Promise<PushSubscription> {
    const { user_id, endpoint, keys_p256dh, keys_auth, user_agent } = input;

    // Upsert - update if exists, insert if not
    const result = await this.client.execute({
      sql: `
        INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth, user_agent)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET
          keys_p256dh = excluded.keys_p256dh,
          keys_auth = excluded.keys_auth,
          user_agent = excluded.user_agent,
          last_used_at = CURRENT_TIMESTAMP
        RETURNING *
      `,
      args: [user_id, endpoint, keys_p256dh, keys_auth, user_agent || null],
    });

    if (result.rows.length === 0) {
      throw new Error("Failed to create push subscription");
    }

    return this.transformRow(result.rows[0] as RawRow);
  }

  async getByUserId(userId: string): Promise<PushSubscription[]> {
    const result = await this.client.execute({
      sql: "SELECT * FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC",
      args: [userId],
    });

    return result.rows.map((row) => this.transformRow(row as RawRow));
  }

  async getByEndpoint(endpoint: string): Promise<PushSubscription | null> {
    const result = await this.client.execute({
      sql: "SELECT * FROM push_subscriptions WHERE endpoint = ?",
      args: [endpoint],
    });

    if (result.rows.length === 0) return null;
    return this.transformRow(result.rows[0] as RawRow);
  }

  async delete(endpoint: string): Promise<boolean> {
    const result = await this.client.execute({
      sql: "DELETE FROM push_subscriptions WHERE endpoint = ?",
      args: [endpoint],
    });
    return result.rowsAffected > 0;
  }

  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.client.execute({
      sql: "DELETE FROM push_subscriptions WHERE user_id = ?",
      args: [userId],
    });
    return result.rowsAffected;
  }

  async updateLastUsed(endpoint: string): Promise<void> {
    await this.client.execute({
      sql: "UPDATE push_subscriptions SET last_used_at = CURRENT_TIMESTAMP WHERE endpoint = ?",
      args: [endpoint],
    });
  }
}
