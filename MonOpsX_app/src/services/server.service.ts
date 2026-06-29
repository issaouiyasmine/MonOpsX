import { api } from "./api.service";
import type {
  CreatedServer,
  CreateServerPayload,
  RotatedServerToken,
  Server,
  ServerMetric,
  UpdateServerPayload,
} from "@/models/server.model";

export const ServerService = {
  async getAll(): Promise<Server[]> {
    const { data } = await api.get<Server[]>("/servers");
    return data;
  },

  async create(payload: CreateServerPayload): Promise<CreatedServer> {
    const { data } = await api.post<CreatedServer>("/servers", payload);
    return data;
  },

  async update(serverId: string, payload: UpdateServerPayload): Promise<Server> {
    const { data } = await api.patch<Server>(`/servers/${serverId}`, payload);
    return data;
  },

  async delete(serverId: string): Promise<void> {
    await api.delete(`/servers/${serverId}`);
  },

  async rotateToken(serverId: string): Promise<RotatedServerToken> {
    const { data } = await api.post<RotatedServerToken>(`/servers/${serverId}/rotate-token`);
    return data;
  },

  async getMetrics(serverId: string, limit = 100): Promise<ServerMetric[]> {
    const { data } = await api.get<ServerMetric[]>(`/servers/${serverId}/metrics`, { params: { limit } });
    return data;
  },
};
