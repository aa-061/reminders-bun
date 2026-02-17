export interface PushSubscription {
  id: number;
  user_id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
  created_at: string;
  last_used_at: string | null;
  user_agent: string | null;
}

export interface CreatePushSubscriptionInput {
  user_id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
  user_agent?: string;
}

export interface IPushSubscriptionRepository {
  create(input: CreatePushSubscriptionInput): Promise<PushSubscription>;
  getByUserId(userId: string): Promise<PushSubscription[]>;
  getByEndpoint(endpoint: string): Promise<PushSubscription | null>;
  delete(endpoint: string): Promise<boolean>;
  deleteByUserId(userId: string): Promise<number>;
  updateLastUsed(endpoint: string): Promise<void>;
}
