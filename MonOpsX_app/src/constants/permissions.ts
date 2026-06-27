export const Permissions = {
  USERS_ACCESS: 1,
  USERS_CREATE: 2,
  USERS_UPDATE: 3,
  USERS_DELETE: 4,
  ROLES_ACCESS: 5,
  ROLES_CREATE: 6,
  ROLES_UPDATE: 7,
  ROLES_DELETE: 8,
  ACCOUNT_ACCESS: 9,
  ACCOUNT_UPDATE: 10,
  ACCOUNT_DELETE: 11,
  DASHBOARDS_ACCESS: 12,
  DASHBOARDS_CREATE: 13,
  DASHBOARDS_UPDATE: 14,
  DASHBOARDS_DELETE: 15,
  SERVERS_ACCESS: 16,
  SERVER_INFORMATION_ACCESS: 17,
  SERVER_INFORMATION_CREATE: 18,
  SERVER_INFORMATION_UPDATE: 19,
  SERVER_INFORMATION_DELETE: 20,
  SERVER_DASHBOARDS_ACCESS: 21,
  ADMINISTRATION_ACCESS: 22,
  SETTINGS_ACCESS: 23,
  NOTIFICATIONS_ACCESS: 24,
  NOTIFICATIONS_UPDATE: 25,
} as const;

export type PermissionAction = "Consulter" | "Créer" | "Modifier" | "Supprimer";

export interface PermissionRow {
  title: string;
  level?: number;
  permissions: Partial<Record<PermissionAction, number>>;
}

export const permissionRows: PermissionRow[] = [
  {
    title: "Tableaux de bord",
    permissions: {
      Consulter: Permissions.DASHBOARDS_ACCESS,
      Créer: Permissions.DASHBOARDS_CREATE,
      Modifier: Permissions.DASHBOARDS_UPDATE,
      Supprimer: Permissions.DASHBOARDS_DELETE,
    },
  },
  {
    title: "Serveurs",
    permissions: { Consulter: Permissions.SERVERS_ACCESS },
  },
  {
    title: "Informations",
    level: 1,
    permissions: {
      Consulter: Permissions.SERVER_INFORMATION_ACCESS,
      Créer: Permissions.SERVER_INFORMATION_CREATE,
      Modifier: Permissions.SERVER_INFORMATION_UPDATE,
      Supprimer: Permissions.SERVER_INFORMATION_DELETE,
    },
  },
  {
    title: "Tableaux de bord",
    level: 1,
    permissions: { Consulter: Permissions.SERVER_DASHBOARDS_ACCESS },
  },
  {
    title: "Administration",
    permissions: { Consulter: Permissions.ADMINISTRATION_ACCESS },
  },
  {
    title: "Utilisateurs",
    level: 1,
    permissions: {
      Consulter: Permissions.USERS_ACCESS,
      Créer: Permissions.USERS_CREATE,
      Modifier: Permissions.USERS_UPDATE,
      Supprimer: Permissions.USERS_DELETE,
    },
  },
  {
    title: "Rôles",
    level: 1,
    permissions: {
      Consulter: Permissions.ROLES_ACCESS,
      Créer: Permissions.ROLES_CREATE,
      Modifier: Permissions.ROLES_UPDATE,
      Supprimer: Permissions.ROLES_DELETE,
    },
  },
  {
    title: "Paramètres",
    permissions: { Consulter: Permissions.SETTINGS_ACCESS },
  },
  {
    title: "Notifications",
    level: 1,
    permissions: {
      Consulter: Permissions.NOTIFICATIONS_ACCESS,
      Modifier: Permissions.NOTIFICATIONS_UPDATE,
    },
  },
  {
    title: "Compte",
    permissions: {
      Consulter: Permissions.ACCOUNT_ACCESS,
      Modifier: Permissions.ACCOUNT_UPDATE,
    },
  },
];
