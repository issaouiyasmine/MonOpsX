import type { CreateUserPayload, Role, RolePayload, UpdateUserPayload, User } from "@/models/administration.model";
import { api } from "./api.service";

export const AdministrationService = {
  async getUsers() { return (await api.get<User[]>("/users")).data; },
  async createUser(payload: CreateUserPayload) { return (await api.post<User>("/users", payload)).data; },
  async updateUser(id: string, payload: UpdateUserPayload) { return (await api.put<User>(`/users/${id}`, payload)).data; },
  async deleteUser(id: string) { await api.delete(`/users/${id}`); },
  async getRoles() { return (await api.get<Role[]>("/roles")).data; },
  async createRole(payload: RolePayload) { return (await api.post<Role>("/roles", payload)).data; },
  async updateRole(id: string, payload: RolePayload) { return (await api.put<Role>(`/roles/${id}`, payload)).data; },
  async deleteRole(id: string) { await api.delete(`/roles/${id}`); },
};
