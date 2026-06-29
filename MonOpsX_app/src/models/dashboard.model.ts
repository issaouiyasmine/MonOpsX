export type DashboardPeriod = "1h" | "6h" | "24h" | "7d" | "30d";
export type DashboardEventType = "all" | "deployment" | "crash" | "threshold" | "status" | "info";
export type DashboardHistorySource = "range" | "latest_available";

export interface DashboardServer {
  id: string;
  name: string;
  hostname: string;
  ip: string;
  status: string;
}

export interface DashboardPoint {
  server_id: string;
  server: string;
  hostname: string;
  ip: string;
  collected_at: string;
  status: string;
  cpu_percent?: number | null;
  memory_percent?: number | null;
  disk_percent?: number | null;
  load_average_1m?: number | null;
  uptime_seconds?: number | null;
}

export interface DashboardEvent {
  server_id: string;
  server: string;
  hostname: string;
  ip: string;
  collected_at: string;
  type: string;
  severity: string;
  message: string;
}

export interface DashboardMetrics {
  summary: {
    servers: number;
    online: number;
    degraded: number;
    offline: number;
    containers?: number;
    points: number;
    events: number;
  };
  servers: DashboardServer[];
  points: DashboardPoint[];
  events: DashboardEvent[];
  event_types: DashboardEventType[];
  history_source?: DashboardHistorySource;
}
