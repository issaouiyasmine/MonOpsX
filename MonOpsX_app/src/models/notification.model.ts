export interface NotificationItem {
  id: string;
  server_id: string;
  server_name?: string | null;
  type: string;
  severity: string;
  message: string;
  metric_name?: string | null;
  metric_value?: number | null;
  created_at: string;
  acknowledged_at?: string | null;
  is_read: boolean;
}

export interface PushTokenRequest {
  token: string;
  platform?: string;
}
