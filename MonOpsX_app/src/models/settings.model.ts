export interface NotificationThresholds {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
}

export interface NotificationMetricSetting {
  threshold: number;
  in_app_enabled: boolean;
  push_enabled: boolean;
}

export interface NotificationMetricSettings {
  cpu_percent: NotificationMetricSetting;
  memory_percent: NotificationMetricSetting;
  disk_percent: NotificationMetricSetting;
}

export interface NotificationSettings {
  enabled: boolean;
  metrics: NotificationMetricSettings;
}
