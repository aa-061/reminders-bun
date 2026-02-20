export interface GoogleToken {
  id: number;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expiry_date: number | null;
  scope: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveTokenInput {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  scope?: string;
}

export interface GoogleTokenRepository {
  getByUserId(userId: string): Promise<GoogleToken | null>;
  save(userId: string, tokens: SaveTokenInput): Promise<void>;
  delete(userId: string): Promise<boolean>;
}
