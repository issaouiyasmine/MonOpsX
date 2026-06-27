import { api } from "./api.service";
import type { CreatedServer, CreateServerPayload, Server } from "@/models/server.model";

export const ServerService = {
  async getAll(): Promise<Server[]> {
    const { data } = await api.get<Server[]>("/servers");
    return data;
  },

  async create(payload: CreateServerPayload): Promise<CreatedServer> {
    const { data } = await api.post<CreatedServer>("/servers", payload);
    return data;
  },
};
