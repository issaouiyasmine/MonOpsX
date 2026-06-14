import { api } from "./api.service";

export const AccountService = {
  async getAll() {
    return api.get("/accounts");
  },
};