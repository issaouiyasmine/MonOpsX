import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import type { AuthSession, LoginRequest, RegisterRequest } from "@/models/auth.model";
import { api } from "@/services/api.service";
import { AuthService } from "@/services/auth.service";
import { SessionStorageService } from "@/services/session-storage.service";

interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionRef = useRef<AuthSession | null>(null);
  const refreshPromiseRef = useRef<Promise<AuthSession> | null>(null);

  const persistSession = useCallback(async (nextSession: AuthSession) => {
    await SessionStorageService.save(nextSession);
    sessionRef.current = nextSession;
    setSession(nextSession);
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use((config) => {
      const accessToken = sessionRef.current?.access_token;
      if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
      return config;
    });

    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const request = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
        const isRefreshRequest = request?.url?.endsWith("/refresh");

        if (error.response?.status !== 401 || !request || request._retry || isRefreshRequest) {
          return Promise.reject(error);
        }

        const refreshToken = sessionRef.current?.refresh_token;
        if (!refreshToken) return Promise.reject(error);

        request._retry = true;
        try {
          if (!refreshPromiseRef.current) {
            refreshPromiseRef.current = AuthService.refresh(refreshToken)
              .then(async (nextSession) => {
                await persistSession(nextSession);
                return nextSession;
              })
              .finally(() => { refreshPromiseRef.current = null; });
          }

          const nextSession = await refreshPromiseRef.current;
          request.headers.Authorization = `Bearer ${nextSession.access_token}`;
          return api(request);
        } catch (refreshError) {
          sessionRef.current = null;
          setSession(null);
          await SessionStorageService.clear();
          return Promise.reject(refreshError);
        }
      },
    );

    return () => {
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [persistSession]);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const storedSession = await SessionStorageService.get();
        if (!storedSession) return;

        const refreshedSession = await AuthService.refresh(storedSession.refresh_token);
        await SessionStorageService.save(refreshedSession);
        if (isMounted) setSession(refreshedSession);
      } catch {
        await SessionStorageService.clear();
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    restoreSession();
    return () => { isMounted = false; };
  }, []);

  const login = useCallback(async (payload: LoginRequest) => {
    await persistSession(await AuthService.login(payload));
  }, [persistSession]);

  const register = useCallback(async (payload: RegisterRequest) => {
    await persistSession(await AuthService.register(payload));
  }, [persistSession]);

  const logout = useCallback(async () => {
    const refreshToken = session?.refresh_token;
    sessionRef.current = null;
    setSession(null);
    await SessionStorageService.clear();

    if (refreshToken) {
      try {
        await AuthService.logout(refreshToken);
      } catch {
        // The local session is already cleared; a network failure must not block logout.
      }
    }
  }, [session]);

  const value = useMemo(
    () => ({ session, isLoading, login, register, logout }),
    [session, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
