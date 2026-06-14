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
} as const;

export const permissionGroups = [
  { title: "Utilisateurs", items: [[1, "Consulter"], [2, "Créer"], [3, "Modifier"], [4, "Supprimer"]] },
  { title: "Rôles", items: [[5, "Consulter"], [6, "Créer"], [7, "Modifier"], [8, "Supprimer"]] },
  { title: "Compte", items: [[9, "Consulter"], [10, "Modifier"], [11, "Supprimer"]] },
] as const;
