import type { NotificationSettings } from "@/models/settings.model";
import { api } from "@/services/api.service";

export const SettingsService = {
  async getNotificationSettings(): Promise<NotificationSettings> {
    const { data } = await api.get<NotificationSettings>("/settings/notifications");
    return data;
  },

  async updateNotificationSettings(payload: NotificationSettings): Promise<NotificationSettings> {
    const { data } = await api.patch<NotificationSettings>("/settings/notifications", payload);
    return data;
  },
};
