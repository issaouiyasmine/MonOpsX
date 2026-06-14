import { api } from "./api.service";
import type {
  AuthSession,
  LoginRequest,
  RegisterRequest,
} from "@/models/auth.model";

export const AuthService = {
  async login(payload: LoginRequest): Promise<AuthSession> {
    const { data } = await api.post<AuthSession>("/login", payload);
    return data;
  },

  async register(payload: RegisterRequest): Promise<AuthSession> {
    const { data } = await api.post<AuthSession>("/register", payload);
    return data;
  },

  async refresh(refreshToken: string): Promise<AuthSession> {
    const { data } = await api.post<AuthSession>("/refresh", {
      refresh_token: refreshToken,
    });
    return data;
  },

  async logout(refreshToken: string): Promise<void> {
    await api.post("/logout", { refresh_token: refreshToken });
  },
};
