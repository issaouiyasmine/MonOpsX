import { api } from "./api.service";
import type { Server } from "@/models/server.model";

export const ServerService = {
  async getAll(): Promise<Server[]> {
    const { data } = await api.get<Server[]>("/servers");
    return data;
  },
};
