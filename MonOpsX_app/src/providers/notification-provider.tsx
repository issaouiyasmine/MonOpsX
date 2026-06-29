import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";

import type { NotificationItem } from "@/models/notification.model";
import { useAuth } from "@/providers/auth-provider";
import { NotificationService } from "@/services/notification.service";
import { canAccessNotifications } from "@/utils/permissions";

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  load: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function NotificationProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const canAccess = canAccessNotifications(session);

  const load = useCallback(async () => {
    if (!canAccess) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    try {
      setNotifications(await NotificationService.getAll({ limit: 80 }));
    } finally {
      setLoading(false);
    }
  }, [canAccess]);

  const markRead = useCallback(async (id: string) => {
    const updated = await NotificationService.markRead(id);
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, ...updated } : item));
  }, []);

  const markAllRead = useCallback(async () => {
    await NotificationService.markAllRead();
    const now = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true, acknowledged_at: item.acknowledged_at ?? now })));
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    await NotificationService.delete(id);
    setNotifications((current) => current.filter((item) => item.id !== id));
  }, []);

  const deleteAll = useCallback(async () => {
    await NotificationService.deleteAll();
    setNotifications([]);
  }, []);

  useEffect(() => {
    if (!session || !canAccess) {
      Promise.resolve().then(() => setNotifications([]));
      return;
    }

    Promise.resolve().then(() => load().catch(() => undefined));
    const interval = setInterval(() => {
      load().catch(() => undefined);
    }, 45000);
    return () => clearInterval(interval);
  }, [session, canAccess, load]);

  useEffect(() => {
    if (!session || !canAccess) return;
    registerPushToken().catch(() => undefined);
  }, [session, canAccess]);

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const value = useMemo(
    () => ({ notifications, unreadCount, loading, load, markRead, markAllRead, deleteNotification, deleteAll }),
    [notifications, unreadCount, loading, load, markRead, markAllRead, deleteNotification, deleteAll],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

async function registerPushToken() {
  if (Platform.OS === "web" || !Device.isDevice) return;

  const current = await Notifications.getPermissionsAsync();
  const finalStatus = current.status === "granted"
    ? current.status
    : (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== "granted") return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  await NotificationService.savePushToken({ token, platform: Platform.OS });
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationProvider");
  return context;
}
