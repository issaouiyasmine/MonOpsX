import type { NotificationItem, PushTokenRequest } from "@/models/notification.model";
import { api } from "@/services/api.service";

interface NotificationFilters {
  unread?: boolean;
  type?: string;
  severity?: string;
  limit?: number;
}

export const NotificationService = {
  async getAll(filters: NotificationFilters = {}): Promise<NotificationItem[]> {
    const response = await api.get<NotificationItem[]>("/notifications", { params: filters });
    return response.data;
  },

  async markRead(id: string): Promise<NotificationItem> {
    const response = await api.patch<NotificationItem>(`/notifications/${id}/read`);
    return response.data;
  },

  async markAllRead(): Promise<{ updated: number }> {
    const response = await api.patch<{ updated: number }>("/notifications/read-all");
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/notifications/${id}`);
  },

  async deleteAll(): Promise<void> {
    await api.delete("/notifications");
  },

  async savePushToken(payload: PushTokenRequest): Promise<void> {
    await api.post("/notifications/push-token", payload);
  },

  async deletePushToken(payload: PushTokenRequest): Promise<void> {
    await api.delete("/notifications/push-token", { data: payload });
  },
};
