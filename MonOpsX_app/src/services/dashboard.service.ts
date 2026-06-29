import { api } from "./api.service";
import type { DashboardEventType, DashboardMetrics, DashboardPeriod } from "@/models/dashboard.model";

export const DashboardService = {
  async getMetrics(params: {
    period: DashboardPeriod;
    serverId?: string;
    eventType?: DashboardEventType;
  }): Promise<DashboardMetrics> {
    const { data } = await api.get<DashboardMetrics>("/dashboard/metrics", {
      params: {
        period: params.period,
        server_id: params.serverId,
        event_type: params.eventType ?? "all",
      },
    });
    return data;
  },
};
