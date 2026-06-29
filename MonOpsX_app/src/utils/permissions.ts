import { Permissions } from "@/constants/permissions";

export interface PermissionSession {
  permissions: number[];
  is_principal?: boolean;
}

export function hasPermission(session: PermissionSession | null | undefined, permission: number) {
  return Boolean(session?.is_principal || session?.permissions.includes(permission));
}

export function canAccessNotifications(session: PermissionSession | null | undefined) {
  return hasPermission(session, Permissions.NOTIFICATIONS_ACCESS);
}

export function canUpdateNotifications(session: PermissionSession | null | undefined) {
  return hasPermission(session, Permissions.NOTIFICATIONS_UPDATE);
}
