import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppShell } from "@/components/app-shell";
import { FormField } from "@/components/form-field";
import { IconTooltipButton } from "@/components/icon-tooltip-button";
import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
import type { Server } from "@/models/server.model";
import { useToast } from "@/providers/toast-provider";
import { ServerService } from "@/services/server.service";
import { getApiErrorMessage } from "@/utils/api-error";

const statusFilters = ["all", "pending", "online", "degraded", "offline"] as const;
type StatusFilter = (typeof statusFilters)[number];

export default function Servers() {
  const { showToast } = useToast();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [editName, setEditName] = useState("");
  const [serverToDelete, setServerToDelete] = useState<Server | null>(null);
  const [serverToRotate, setServerToRotate] = useState<Server | null>(null);
  const [savingAction, setSavingAction] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadServers() {
      try {
        const data = await ServerService.getAll();
        if (mounted) setServers(data);
      } catch {
        if (mounted) setError("Impossible de charger les serveurs.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadServers();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredServers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return servers.filter((server) => {
      const matchesStatus = statusFilter === "all" || server.status === statusFilter;
      const searchable = `${server.name} ${server.hostname} ${server.ip}`.toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [search, servers, statusFilter]);

  function openDetails(server: Server) {
    router.push({
      pathname: "/(main)/servers/details",
      params: {
        serverId: server.id,
        serverName: server.name,
        hostname: server.hostname,
        ip: server.ip,
      },
    } as never);
  }

  function openEdit(server: Server) {
    setEditingServer(server);
    setEditName(server.name);
  }

  async function copyToken(server: Server) {
    if (!server.webhook_token) {
      showToast("Le token de ce serveur n'est pas disponible.", "warning");
      return;
    }

    if (await copyText(server.webhook_token)) {
      showToast("Token copié.");
    } else {
      showToast("Impossible de copier automatiquement le token.", "error");
    }
  }

  async function confirmRotateToken() {
    if (!serverToRotate) return;

    setSavingAction(true);
    try {
      const rotated = await ServerService.rotateToken(serverToRotate.id);
      setServers((current) =>
        current.map((server) =>
          server.id === rotated.server_id ? { ...server, webhook_token: rotated.webhook_token } : server
        )
      );
      setServerToRotate(null);
      const copied = await copyText(rotated.webhook_token);
      showToast(copied ? "Token régénéré." : "Token régénéré. Vous pouvez le copier depuis la liste.");
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setSavingAction(false);
    }
  }

  async function submitEdit() {
    if (!editingServer) return;
    const name = editName.trim();
    if (!name) {
      showToast("Le nom est obligatoire.", "warning");
      return;
    }

    setSavingAction(true);
    try {
      const updated = await ServerService.update(editingServer.id, { name });
      setServers((current) => current.map((server) => (server.id === updated.id ? updated : server)));
      setEditingServer(null);
      showToast("Serveur modifié.");
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setSavingAction(false);
    }
  }

  async function confirmDelete() {
    if (!serverToDelete) return;

    setSavingAction(true);
    try {
      await ServerService.delete(serverToDelete.id);
      setServers((current) => current.filter((server) => server.id !== serverToDelete.id));
      setServerToDelete(null);
      showToast("Serveur supprimé.");
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setSavingAction(false);
    }
  }

  return (
    <AppShell title="Serveurs">
      <View style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.heading}>Serveurs surveillés</Text>
            <Text style={styles.subheading}>{"Recherchez un serveur par nom, nom d'hôte ou adresse IP."}</Text>
          </View>
          <Pressable style={styles.addButton} onPress={() => router.push("/(main)/servers/create" as never)}>
            <Ionicons name="add-outline" size={20} color={colors.text} />
            <Text style={styles.addButtonText}>Ajouter un serveur</Text>
          </Pressable>
        </View>

        <View style={styles.filters}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher par nom, nom d'hôte ou IP"
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <View style={styles.statusFilters}>
            {statusFilters.map((status) => {
              const active = statusFilter === status;
              return (
                <Pressable
                  key={status}
                  style={[styles.filterButton, active && styles.filterButtonActive]}
                  onPress={() => setStatusFilter(status)}
                >
                  <Text style={[styles.filterButtonText, active && styles.filterButtonTextActive]}>
                    {statusFilterLabel(status)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {loading && (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Chargement des serveurs</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.stateCard}>
            <Ionicons name="warning-outline" size={28} color={colors.alert} />
            <Text style={styles.stateText}>{error}</Text>
          </View>
        )}

        {!loading && !error && servers.length === 0 && (
          <View style={styles.stateCard}>
            <Ionicons name="server-outline" size={32} color={colors.muted} />
            <Text style={styles.stateText}>Aucun serveur enregistré pour le moment.</Text>
          </View>
        )}

        {!loading && !error && servers.length > 0 && filteredServers.length === 0 && (
          <View style={styles.stateCard}>
            <Ionicons name="search-outline" size={32} color={colors.muted} />
            <Text style={styles.stateText}>Aucun serveur ne correspond aux filtres.</Text>
          </View>
        )}

        {!loading && !error && filteredServers.length > 0 && (
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.headerCell, styles.nameCell]}>Nom</Text>
              <Text style={[styles.headerCell, styles.statusCell]}>Statut</Text>
              <Text style={[styles.headerCell, styles.actionsCell]}>Actions</Text>
            </View>

            {filteredServers.map((server) => (
              <View key={server.id} style={styles.tableRow}>
                <View style={styles.nameCell}>
                  <Text style={styles.serverName} numberOfLines={1}>
                    {server.name}
                  </Text>
                  <Text style={styles.serverMeta} numberOfLines={1}>
                    {server.hostname} - {server.ip}
                  </Text>
                </View>
                <View style={styles.statusCell}>
                  <View style={styles.statusPill}>
                    <View style={[styles.statusDot, statusStyle(server.status)]} />
                    <Text style={styles.statusText}>{statusLabel(server.status)}</Text>
                  </View>
                </View>
                <View style={styles.actionsCell}>
                  <IconTooltipButton label="Voir les détails" icon="eye-outline" onPress={() => openDetails(server)} />
                  <IconTooltipButton label="Modifier le serveur" icon="create-outline" onPress={() => openEdit(server)} />
                  <IconTooltipButton label="Copier le token" icon="key-outline" onPress={() => copyToken(server)} />
                  <IconTooltipButton label="Régénérer le token" icon="refresh-outline" color={colors.warning} onPress={() => setServerToRotate(server)} />
                  <IconTooltipButton label="Supprimer le serveur" icon="trash-outline" danger onPress={() => setServerToDelete(server)} />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <Modal visible={Boolean(editingServer)} transparent animationType="fade" onRequestClose={() => setEditingServer(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier le serveur</Text>
              <Pressable accessibilityLabel="Fermer" onPress={() => setEditingServer(null)}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </Pressable>
            </View>
            <FormField label="Nom" value={editName} onChangeText={setEditName} placeholder="Nom du serveur" />
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setEditingServer(null)}>
                <Text style={styles.secondaryButtonText}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} disabled={savingAction} onPress={submitEdit}>
                <Text style={styles.primaryButtonText}>{savingAction ? "Enregistrement" : "Enregistrer"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(serverToRotate)} transparent animationType="fade" onRequestClose={() => setServerToRotate(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Régénérer le token</Text>
            <Text style={styles.confirmText}>
              {serverToRotate
                ? `Régénérer le token de ${serverToRotate.name} ? L'ancien token sera révoqué et l'agent devra être relancé avec le nouveau token.`
                : ""}
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setServerToRotate(null)}>
                <Text style={styles.secondaryButtonText}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} disabled={savingAction} onPress={confirmRotateToken}>
                <Text style={styles.primaryButtonText}>{savingAction ? "Régénération" : "Régénérer"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(serverToDelete)} transparent animationType="fade" onRequestClose={() => setServerToDelete(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Confirmation</Text>
            <Text style={styles.confirmText}>
              {serverToDelete
                ? `Supprimer le serveur ${serverToDelete.name} ? Le token sera révoqué et l'agent ne pourra plus envoyer de métriques.`
                : ""}
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setServerToDelete(null)}>
                <Text style={styles.secondaryButtonText}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.dangerButton} disabled={savingAction} onPress={confirmDelete}>
                <Text style={styles.dangerButtonText}>{savingAction ? "Suppression" : "Supprimer"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

function statusFilterLabel(status: StatusFilter) {
  if (status === "all") return "Tous";
  return statusLabel(status);
}

async function copyText(value: string) {
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard?.writeText) return false;

  try {
    await clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function statusLabel(status: string) {
  if (status === "online") return "En ligne";
  if (status === "degraded") return "Dégradé";
  if (status === "offline") return "Hors ligne";
  return "En attente";
}

function statusStyle(status: string) {
  if (status === "online") return { backgroundColor: colors.success };
  if (status === "degraded") return { backgroundColor: colors.warning };
  if (status === "offline") return { backgroundColor: colors.danger };
  return { backgroundColor: colors.muted };
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  heading: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.h2,
  },
  subheading: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
  },
  addButton: {
    minHeight: 42,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.medium,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primaryDark,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addButtonText: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  filters: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  searchBox: {
    minHeight: 46,
    flex: 1,
    minWidth: 0,
    maxWidth: 640,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.medium,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    minWidth: 180,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.body,
  },
  statusFilters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterButton: {
    minHeight: 36,
    justifyContent: "center",
    borderRadius: radii.medium,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButtonActive: {
    backgroundColor: "rgba(14,165,255,0.13)",
    borderColor: "rgba(14,165,255,0.35)",
  },
  filterButtonText: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: typography.caption,
  },
  filterButtonTextActive: {
    color: colors.primary,
  },
  stateCard: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.medium,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stateText: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: typography.body,
    textAlign: "center",
  },
  table: {
    minWidth: 0,
    borderRadius: radii.medium,
    overflow: "hidden",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tableRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tableHeader: {
    minHeight: 46,
    borderTopWidth: 0,
    backgroundColor: colors.surface,
  },
  headerCell: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: typography.caption,
    textTransform: "uppercase",
  },
  nameCell: {
    flex: 1.5,
    minWidth: 160,
  },
  statusCell: {
    flex: 1,
    minWidth: 130,
  },
  actionsCell: {
    flex: 1,
    minWidth: 190,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  serverName: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.bodyLarge,
  },
  serverMeta: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
  },
  statusPill: {
    minHeight: 34,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.caption,
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    backgroundColor: colors.overlay,
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    gap: spacing.md,
    borderRadius: radii.medium,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  modalTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.h3,
  },
  confirmText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  secondaryButton: {
    minHeight: 40,
    justifyContent: "center",
    borderRadius: radii.medium,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  primaryButton: {
    minHeight: 40,
    justifyContent: "center",
    borderRadius: radii.medium,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primaryDark,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  dangerButton: {
    minHeight: 40,
    justifyContent: "center",
    borderRadius: radii.medium,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.danger,
  },
  dangerButtonText: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
});
