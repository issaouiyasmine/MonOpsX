export interface Server {
  id: string;
  name: string;
  hostname: string;
  ip: string;
  operating_system?: string | null;
  webhook_token?: string;
  status: string;
  latest_metrics: ServerLatestMetrics;
  last_seen_at: string | null;
}

export interface ServerContainer {
  name: string;
  image: string;
  status: string;
  restart_count: number;
  last_build_at?: string | null;
  started_at?: string | null;
  uptime_seconds?: number | null;
}

export interface ServerDockerState {
  available: boolean;
  containers: ServerContainer[];
}

export interface ServerEvent {
  type: string;
  severity: string;
  message: string;
}

export interface ServerLatestMetrics extends Record<string, unknown> {
  cpu_percent?: number;
  memory_percent?: number;
  disk_percent?: number;
  load_average_1m?: number | null;
  uptime_seconds?: number;
  docker?: ServerDockerState | null;
  events?: ServerEvent[];
  agent_version?: string;
  operating_system?: string | null;
  collected_at?: string;
}

export interface ServerMetric {
  id: string;
  server_id: string;
  agent_version: string;
  collected_at: string;
  hostname: string;
  ip: string;
  operating_system?: string | null;
  metrics: ServerLatestMetrics;
  docker?: ServerDockerState | null;
  events: ServerEvent[];
  status: string;
  created_at: string;
}

export interface CreateServerPayload {
  name: string;
  hostname: string;
  ip: string;
}

export interface UpdateServerPayload {
  name: string;
}

export interface CreatedServer extends Server {
  webhook_token: string;
}

export interface RotatedServerToken {
  server_id: string;
  webhook_token: string;
}
