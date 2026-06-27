export interface Server {
  id: string;
  name: string;
  hostname: string;
  ip: string;
  status: string;
  latest_metrics: Record<string, unknown>;
  last_seen_at: string | null;
}

export interface CreateServerPayload {
  name: string;
  hostname: string;
  ip: string;
}

export interface CreatedServer extends Server {
  webhook_token: string;
}
