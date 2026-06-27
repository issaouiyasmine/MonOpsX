import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { AppShell } from "@/components/app-shell";
import { FormField } from "@/components/form-field";
import { PrimaryButton } from "@/components/primary-button";
import { permissionRows, Permissions, type PermissionAction, type PermissionRow } from "@/constants/permissions";
import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
import type { Role, User } from "@/models/administration.model";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import { AdministrationService } from "@/services/administration.service";
import { getApiErrorMessage } from "@/utils/api-error";
import { getPasswordError, isValidEmail } from "@/utils/validation";

type Tab = "users" | "roles";
type Editor = { kind: "user"; item?: User } | { kind: "role"; item?: Role } | null;
type UserForm = {
  first_name: string;
  last_name: string;
  email: string;
  role_id: string;
  temporary_password: string;
};
const emptyUser: UserForm = {
  first_name: "",
  last_name: "",
  email: "",
  role_id: "",
  temporary_password: "",
};
const emptyRole = { name: "", permissions: [] as number[] };
const permissionColumns: PermissionAction[] = ["Consulter", "Créer", "Modifier", "Supprimer"];
const allPermissionIds = permissionRows.flatMap((row) => Object.values(row.permissions));

function getPermissionIds(row: PermissionRow) {
  return Object.values(row.permissions);
}

function getPermissionTreeIds(rowIndex: number) {
  const row = permissionRows[rowIndex];
  const rowLevel = row.level ?? 0;
  const rows = [row];

  for (let index = rowIndex + 1; index < permissionRows.length; index += 1) {
    const nextRow = permissionRows[index];
    const nextLevel = nextRow.level ?? 0;
    if (nextLevel <= rowLevel) break;
    rows.push(nextRow);
  }

  return rows.flatMap(getPermissionIds);
}

function generateTemporaryPassword() {
  const required = ["M", "x", "7", "!"];
  const pool = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const characters = [...required];

  while (characters.length < 14) {
    characters.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  return characters
    .sort(() => Math.random() - 0.5)
    .join("");
}

export default function Administration() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const canUsers = session?.permissions.includes(Permissions.USERS_ACCESS) ?? false;
  const canRoles = session?.permissions.includes(Permissions.ROLES_ACCESS) ?? false;

  const [tab, setTab] = useState<Tab>(canUsers ? "users" : "roles");
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [confirm, setConfirm] = useState<{ label: string; run: () => Promise<void> } | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(emptyUser);
  const [roleForm, setRoleForm] = useState(emptyRole);
  const [saving, setSaving] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedUsers, loadedRoles] = await Promise.all([
        canUsers ? AdministrationService.getUsers() : Promise.resolve([]),
        canRoles || canUsers ? AdministrationService.getRoles() : Promise.resolve([]),
      ]);
      setUsers(loadedUsers);
      setRoles(loadedRoles);
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  }, [canUsers, canRoles, showToast]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const selectedRole = roles.find((role) => role.id === userForm.role_id);
  const roleName = (id: string) => roles.find((role) => role.id === id)?.name ?? "Rôle inconnu";
  const filteredUsers = useMemo(
    () => users.filter((user) => `${user.first_name} ${user.last_name} ${user.email}`.toLowerCase().includes(query.toLowerCase())),
    [users, query],
  );
  const filteredRoles = useMemo(
    () => roles.filter((role) => role.name.toLowerCase().includes(query.toLowerCase())),
    [roles, query],
  );
  const allPermissionsChecked = allPermissionIds.every((id) => roleForm.permissions.includes(id));

  function openUser(item?: User) {
    setUserForm(
      item
        ? {
            first_name: item.first_name,
            last_name: item.last_name,
            email: item.email,
            role_id: item.role_id,
            temporary_password: "",
          }
        : { ...emptyUser, role_id: roles[0]?.id ?? "", temporary_password: generateTemporaryPassword() },
    );
    setEditor({ kind: "user", item });
  }

  function openRole(item?: Role) {
    setRoleForm(item ? { name: item.name, permissions: [...item.permissions] } : emptyRole);
    setEditor({ kind: "role", item });
  }

  function togglePermission(permissionId: number) {
    setRoleForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permissionId)
        ? current.permissions.filter((id) => id !== permissionId)
        : [...current.permissions, permissionId],
    }));
  }

  function togglePermissionRow(rowIndex: number) {
    const ids = getPermissionTreeIds(rowIndex);
    const hasEveryPermission = ids.every((id) => roleForm.permissions.includes(id));
    setRoleForm((current) => ({
      ...current,
      permissions: hasEveryPermission
        ? current.permissions.filter((id) => !ids.includes(id))
        : Array.from(new Set([...current.permissions, ...ids])),
    }));
  }

  function toggleAllPermissions() {
    setRoleForm((current) => ({
      ...current,
      permissions: allPermissionsChecked ? [] : [...allPermissionIds],
    }));
  }

  async function saveUser() {
    if (!userForm.first_name.trim() || !userForm.last_name.trim() || !isValidEmail(userForm.email) || !userForm.role_id) {
      showToast("Complétez correctement tous les champs.", "warning");
      return;
    }

    if (editor?.kind === "user" && editor.item?.is_principal) {
      showToast("L'utilisateur principal est en lecture seule.", "warning");
      return;
    }

    if (editor?.kind === "user" && !editor.item) {
      const error = getPasswordError(userForm.temporary_password);
      if (error) {
        showToast(error, "warning");
        return;
      }
    }

    setSaving(true);
    try {
      if (editor?.kind === "user" && editor.item) {
        await AdministrationService.updateUser(editor.item.id, {
          first_name: userForm.first_name,
          last_name: userForm.last_name,
          email: userForm.email,
          role_id: userForm.role_id,
        });
        showToast("Utilisateur modifié.");
      } else {
        await AdministrationService.createUser(userForm);
        showToast("Utilisateur créé.");
      }
      setEditor(null);
      await load();
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveRole() {
    if (!roleForm.name.trim() || !roleForm.permissions.length) {
      showToast("Le nom et au moins une permission sont obligatoires.", "warning");
      return;
    }

    setSaving(true);
    try {
      if (editor?.kind === "role" && editor.item) {
        await AdministrationService.updateRole(editor.item.id, roleForm);
        showToast("Rôle modifié.");
      } else {
        await AdministrationService.createRole(roleForm);
        showToast("Rôle créé.");
      }
      setEditor(null);
      await load();
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  }

  function askDeleteUser(user: User) {
    setConfirm({
      label: `Supprimer ${user.first_name} ${user.last_name} ?`,
      run: async () => {
        await AdministrationService.deleteUser(user.id);
        showToast("Utilisateur supprimé.");
        await load();
      },
    });
  }

  function askDeleteRole(role: Role) {
    setConfirm({
      label: `Supprimer le rôle ${role.name} ? Les utilisateurs associés seront désactivés.`,
      run: async () => {
        await AdministrationService.deleteRole(role.id);
        showToast("Rôle supprimé.");
        await load();
      },
    });
  }

  if (!canUsers && !canRoles) {
    return (
      <AppShell title="Administration">
        <View style={styles.empty}>
          <Ionicons name="lock-closed-outline" size={44} color={colors.muted} />
          <Text style={styles.emptyTitle}>Accès non autorisé</Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell title="Administration">
      <View style={styles.toolbar}>
        <View style={styles.tabs}>
          {canUsers ? (
            <Pressable style={[styles.tab, tab === "users" && styles.tabActive]} onPress={() => setTab("users")}>
              <Text style={[styles.tabText, tab === "users" && styles.tabTextActive]}>Utilisateurs</Text>
            </Pressable>
          ) : null}
          {canRoles ? (
            <Pressable style={[styles.tab, tab === "roles" && styles.tabActive]} onPress={() => setTab("roles")}>
              <Text style={[styles.tabText, tab === "roles" && styles.tabTextActive]}>Rôles</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.tools}>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput placeholder="Rechercher..." placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={styles.searchInput} />
          </View>
          {tab === "users" && session?.permissions.includes(Permissions.USERS_CREATE) ? (
            <Pressable style={styles.add} onPress={() => openUser()}>
              <Ionicons name="add" size={20} color={colors.text} />
              <Text style={styles.addText}>Utilisateur</Text>
            </Pressable>
          ) : null}
          {tab === "roles" && session?.permissions.includes(Permissions.ROLES_CREATE) ? (
            <Pressable style={styles.add} onPress={() => openRole()}>
              <Ionicons name="add" size={20} color={colors.text} />
              <Text style={styles.addText}>Rôle</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : tab === "users" ? (
        <View style={styles.list}>
          {filteredUsers.map((user) => (
            <View key={user.id} style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user.first_name[0]}{user.last_name[0]}</Text>
              </View>
              <View style={styles.grow}>
                <Text style={styles.name}>{user.first_name} {user.last_name}{user.is_principal ? " · Principal" : ""}</Text>
                <Text style={styles.sub}>{user.email} · {roleName(user.role_id)}</Text>
              </View>
              <View style={[styles.badge, user.is_active ? styles.badgeOn : styles.badgeOff]}>
                <Text style={styles.badgeText}>{user.is_active ? "Actif" : "Inactif"}</Text>
              </View>
              {session?.permissions.includes(Permissions.USERS_UPDATE) && !user.is_principal ? (
                <Pressable style={styles.action} onPress={() => openUser(user)}>
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </Pressable>
              ) : null}
              {session?.permissions.includes(Permissions.USERS_UPDATE) && !user.is_principal ? (
                <Pressable
                  style={styles.action}
                  onPress={async () => {
                    try {
                      await AdministrationService.updateUser(user.id, { is_active: !user.is_active });
                      showToast(user.is_active ? "Utilisateur désactivé." : "Utilisateur activé.");
                      await load();
                    } catch (error) {
                      showToast(getApiErrorMessage(error), "error");
                    }
                  }}
                >
                  <Ionicons name={user.is_active ? "pause-circle-outline" : "play-circle-outline"} size={20} color={colors.warning} />
                </Pressable>
              ) : null}
              {session?.permissions.includes(Permissions.USERS_DELETE) && !user.is_principal ? (
                <Pressable style={styles.action} onPress={() => askDeleteUser(user)}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.list}>
          {filteredRoles.map((role) => (
            <View key={role.id} style={styles.row}>
              <View style={styles.roleIcon}>
                <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.grow}>
                <Text style={styles.name}>{role.name}{role.is_default ? " · Par défaut" : ""}</Text>
                <Text style={styles.sub}>{role.permissions.length} permission(s)</Text>
              </View>
              {session?.permissions.includes(Permissions.ROLES_UPDATE) && !role.is_default ? (
                <Pressable style={styles.action} onPress={() => openRole(role)}>
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </Pressable>
              ) : null}
              {session?.permissions.includes(Permissions.ROLES_DELETE) && !role.is_default ? (
                <Pressable style={styles.action} onPress={() => askDeleteRole(role)}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      )}

      <Modal visible={!!editor} transparent animationType="fade" onRequestClose={() => setEditor(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, compact && styles.modalCompact]}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>
                {editor?.kind === "user"
                  ? editor.item
                    ? "Modifier l'utilisateur"
                    : "Créer un utilisateur"
                  : editor?.item
                    ? "Modifier le rôle"
                    : "Créer un rôle"}
              </Text>
              <Pressable onPress={() => setEditor(null)}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {editor?.kind === "user" ? (
                <>
                  <FormField label="Prénom" value={userForm.first_name} onChangeText={(value) => setUserForm({ ...userForm, first_name: value })} />
                  <FormField label="Nom" value={userForm.last_name} onChangeText={(value) => setUserForm({ ...userForm, last_name: value })} />
                  <FormField label="E-mail" keyboardType="email-address" value={userForm.email} onChangeText={(value) => setUserForm({ ...userForm, email: value })} />
                  <Text style={styles.fieldLabel}>Rôle</Text>
                  <Pressable style={styles.dropdown} onPress={() => setRoleMenuOpen(true)}>
                    <Text style={[styles.dropdownText, !selectedRole && styles.placeholderText]}>{selectedRole?.name ?? "Sélectionner un rôle"}</Text>
                    <Ionicons name="chevron-down" size={18} color={colors.muted} />
                  </Pressable>
                  {!editor.item ? (
                    <View style={styles.passwordLine}>
                      <View style={styles.passwordField}>
                        <FormField
                          label="Mot de passe temporaire"
                          password
                          value={userForm.temporary_password}
                          onChangeText={(value) => setUserForm({ ...userForm, temporary_password: value })}
                        />
                      </View>
                      <Pressable style={styles.generateButton} onPress={() => setUserForm({ ...userForm, temporary_password: generateTemporaryPassword() })}>
                        <Ionicons name="refresh" size={17} color={colors.text} />
                        <Text style={styles.addText}>Générer</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <PrimaryButton label="Enregistrer" loading={saving} onPress={saveUser} />
                </>
              ) : (
                <>
                  <FormField label="Nom du rôle" value={roleForm.name} onChangeText={(value) => setRoleForm({ ...roleForm, name: value })} />
                  <Pressable style={styles.globalPermissionToggle} onPress={toggleAllPermissions}>
                    <Ionicons name={allPermissionsChecked ? "checkbox" : "square-outline"} size={21} color={allPermissionsChecked ? colors.primary : colors.muted} />
                    <Text style={styles.globalPermissionText}>Tout cocher</Text>
                  </Pressable>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.permissionScroll}>
                    <View style={styles.permissionGrid}>
                      <View style={[styles.permissionRow, styles.permissionHeader]}>
                        <View style={[styles.permissionCell, styles.permissionNameCell]}>
                          <Text style={styles.permissionHeaderText}>Permission</Text>
                        </View>
                        {permissionColumns.map((column) => (
                          <View key={column} style={styles.permissionCell}>
                            <Text style={styles.permissionHeaderText}>{column}</Text>
                          </View>
                        ))}
                        <View style={styles.permissionCell}>
                          <Text style={styles.permissionHeaderText}>Tout cocher</Text>
                        </View>
                      </View>
                      {permissionRows.map((row, rowIndex) => {
                        const rowIds = getPermissionTreeIds(rowIndex);
                        const rowChecked = rowIds.every((id) => roleForm.permissions.includes(id));

                        return (
                          <View key={`${row.level ?? 0}-${row.title}`} style={styles.permissionRow}>
                            <View style={[styles.permissionCell, styles.permissionNameCell, row.level ? styles.permissionChildNameCell : null]}>
                              <Text style={[styles.permissionText, row.level ? styles.permissionChildText : null]}>{row.title}</Text>
                            </View>
                            {permissionColumns.map((column) => {
                              const permissionId = row.permissions[column];
                              const checked = permissionId ? roleForm.permissions.includes(permissionId) : false;

                              return (
                                <Pressable
                                  key={column}
                                  disabled={!permissionId}
                                  style={[styles.permissionCell, styles.permissionCheck, !permissionId && styles.permissionDisabled]}
                                  onPress={() => permissionId && togglePermission(permissionId)}
                                >
                                  {permissionId ? (
                                    <Ionicons name={checked ? "checkbox" : "square-outline"} size={20} color={checked ? colors.primary : colors.muted} />
                                  ) : (
                                    <Text style={styles.permissionDash}>-</Text>
                                  )}
                                </Pressable>
                              );
                            })}
                            <Pressable style={[styles.permissionCell, styles.permissionCheck]} onPress={() => togglePermissionRow(rowIndex)}>
                              <Ionicons name={rowChecked ? "checkbox" : "square-outline"} size={20} color={rowChecked ? colors.primary : colors.muted} />
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                  <PrimaryButton label="Enregistrer" loading={saving} onPress={saveRole} />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={roleMenuOpen} transparent animationType="fade" onRequestClose={() => setRoleMenuOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRoleMenuOpen(false)}>
          <Pressable style={styles.roleMenu} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Sélectionner un rôle</Text>
            <View style={styles.roleMenuList}>
              {roles.map((role) => (
                <Pressable
                  key={role.id}
                  style={[styles.roleMenuItem, userForm.role_id === role.id && styles.roleMenuItemActive]}
                  onPress={() => {
                    setUserForm({ ...userForm, role_id: role.id });
                    setRoleMenuOpen(false);
                  }}
                >
                  <Text style={[styles.roleMenuText, userForm.role_id === role.id && styles.choiceTextActive]}>{role.name}</Text>
                  {userForm.role_id === role.id ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!confirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirm}>
            <Text style={styles.modalTitle}>Confirmation</Text>
            <Text style={styles.confirmText}>{confirm?.label}</Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.secondary} onPress={() => setConfirm(null)}>
                <Text style={styles.secondaryText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={styles.danger}
                onPress={async () => {
                  const action = confirm;
                  setConfirm(null);
                  try {
                    await action?.run();
                  } catch (error) {
                    showToast(getApiErrorMessage(error), "error");
                  }
                }}
              >
                <Text style={styles.addText}>Confirmer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  toolbar: { gap: spacing.md, marginBottom: spacing.lg },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { paddingHorizontal: spacing.md, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { color: colors.muted, fontFamily: fonts.medium, fontSize: typography.bodyLarge },
  tabTextActive: { color: colors.primary },
  tools: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "space-between" },
  search: { flex: 1, minWidth: 220, maxWidth: 520, height: 44, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radii.medium, paddingHorizontal: 12, backgroundColor: colors.input },
  searchInput: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: typography.body },
  add: { height: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, borderRadius: radii.medium, backgroundColor: colors.primaryDark },
  addText: { color: colors.text, fontFamily: fonts.medium, fontSize: typography.body },
  list: { gap: spacing.sm },
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.medium, backgroundColor: colors.card },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryDark },
  avatarText: { color: colors.text, fontFamily: fonts.bold },
  roleIcon: { width: 42, height: 42, borderRadius: radii.medium, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14,165,255,.12)" },
  grow: { flex: 1, minWidth: 120 },
  name: { color: colors.text, fontFamily: fonts.medium, fontSize: typography.bodyLarge },
  sub: { color: colors.muted, fontFamily: fonts.regular, fontSize: typography.caption, marginTop: 4 },
  badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.round },
  badgeOn: { backgroundColor: "rgba(34,197,94,.16)" },
  badgeOff: { backgroundColor: "rgba(239,68,68,.16)" },
  badgeText: { color: colors.text, fontFamily: fonts.medium, fontSize: typography.caption },
  action: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: radii.medium, borderWidth: 1, borderColor: colors.border },
  empty: { minHeight: 400, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: colors.muted, fontFamily: fonts.medium, fontSize: typography.h3, marginTop: spacing.md },
  modalOverlay: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.overlay, padding: spacing.md },
  modal: { width: "100%", maxWidth: 720, maxHeight: "92%", borderRadius: radii.large, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.lg },
  modalCompact: { height: "100%", maxHeight: "100%", borderRadius: 0 },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  modalBody: { paddingBottom: spacing.sm },
  modalTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: typography.h3 },
  fieldLabel: { color: colors.text, fontFamily: fonts.medium, fontSize: typography.body, marginBottom: 8 },
  dropdown: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, paddingHorizontal: 14, marginBottom: spacing.md },
  dropdownText: { color: colors.text, fontFamily: fonts.regular, fontSize: typography.body },
  placeholderText: { color: colors.muted },
  passwordLine: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  passwordField: { flex: 1, minWidth: 0 },
  generateButton: { height: 50, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.primaryDark, marginTop: 27 },
  globalPermissionToggle: { minHeight: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radii.medium, backgroundColor: colors.input, paddingHorizontal: 12, marginBottom: spacing.sm },
  globalPermissionText: { color: colors.text, fontFamily: fonts.medium, fontSize: typography.body },
  permissionScroll: { marginBottom: spacing.md },
  permissionGrid: { minWidth: 660, borderWidth: 1, borderColor: colors.border, borderRadius: radii.medium, overflow: "hidden" },
  permissionRow: { minHeight: 48, flexDirection: "row", alignItems: "stretch", borderTopWidth: 1, borderTopColor: colors.border },
  permissionHeader: { borderTopWidth: 0, backgroundColor: colors.card },
  permissionCell: { width: 104, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 12, borderLeftWidth: 1, borderLeftColor: colors.border },
  permissionNameCell: { width: 140, alignItems: "flex-start", borderLeftWidth: 0 },
  permissionChildNameCell: { paddingLeft: 28 },
  permissionHeaderText: { color: colors.text, fontFamily: fonts.medium, fontSize: typography.caption, textAlign: "center" },
  permissionText: { color: colors.text, fontFamily: fonts.medium, fontSize: typography.caption },
  permissionChildText: { color: colors.muted },
  permissionCheck: { display: "flex" },
  permissionDisabled: { opacity: 0.45 },
  permissionDash: { color: colors.muted, fontFamily: fonts.medium },
  roleMenu: { width: "100%", maxWidth: 420, borderRadius: radii.large, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.lg },
  roleMenuList: { gap: spacing.sm, marginTop: spacing.md },
  roleMenuItem: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.border, borderRadius: radii.medium, paddingHorizontal: 12, backgroundColor: colors.input },
  roleMenuItemActive: { borderColor: colors.primary, backgroundColor: "rgba(14,165,255,.1)" },
  roleMenuText: { color: colors.text, fontFamily: fonts.regular, fontSize: typography.body },
  choiceTextActive: { color: colors.primary },
  confirm: { width: "100%", maxWidth: 460, borderRadius: radii.large, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.lg },
  confirmText: { color: colors.muted, fontFamily: fonts.regular, fontSize: typography.bodyLarge, lineHeight: 24, marginVertical: spacing.lg },
  confirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  secondary: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: radii.medium, borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.text, fontFamily: fonts.medium },
  danger: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: radii.medium, backgroundColor: colors.danger },
});
