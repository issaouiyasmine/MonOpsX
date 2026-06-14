import { api } from "./api.service";

export const ServerService = {
  async getAll() {
    return api.get("/servers");
  },
};