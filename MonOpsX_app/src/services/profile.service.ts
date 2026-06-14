import type { Profile, UpdateProfileAccount, UpdateProfileUser } from "@/models/profile.model";
import { api } from "./api.service";

export const ProfileService = {
  async get() { return (await api.get<Profile>("/profile")).data; },
  async updateUser(payload: UpdateProfileUser) { return (await api.patch<Profile>("/profile/user", payload)).data; },
  async updateAccount(payload: UpdateProfileAccount) { return (await api.patch<Profile>("/profile/account", payload)).data; },
};
