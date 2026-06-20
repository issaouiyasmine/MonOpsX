export interface Server {
  id: string;
  name: string;
  hostname: string;
  ip: string;
  status: string;
  latest_metrics: Record<string, unknown>;
  last_seen_at: string | null;
}
