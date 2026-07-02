import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { AppShell } from "@/components/app-shell";
import { FormField } from "@/components/form-field";
import { IconTooltipButton } from "@/components/icon-tooltip-button";
import { PrimaryButton } from "@/components/primary-button";
import { SearchInput } from "@/components/search-input";
import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
import type { CreatedServer, CreateServerPayload, Server } from "@/models/server.model";
import { useToast } from "@/providers/toast-provider";
import { ServerService } from "@/services/server.service";
import { getApiErrorMessage } from "@/utils/api-error";

const statusFilters = ["all", "pending", "online", "degraded", "offline"] as const;
type StatusFilter = (typeof statusFilters)[number];
type FormErrors = Partial<Record<keyof CreateServerPayload, string>>;

const initialCreateForm: CreateServerPayload = {
  name: "",
  hostname: "",
  ip: "",
};

const agentDownloadUrl = process.env.EXPO_PUBLIC_MONOPSX_AGENT_DOWNLOAD_URL?.trim();

export default function Servers() {
  const { showToast } = useToast();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateServerPayload>(initialCreateForm);
  const [createErrors, setCreateErrors] = useState<FormErrors>({});
  const [creatingServer, setCreatingServer] = useState(false);
  const [createdServer, setCreatedServer] = useState<CreatedServer | null>(null);
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

  function openCreate() {
    setCreateForm(initialCreateForm);
    setCreateErrors({});
    setCreatedServer(null);
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    setCreatingServer(false);
  }

  function updateCreateField(field: keyof CreateServerPayload, value: string) {
    setCreateForm((current) => ({ ...current, [field]: value }));
    setCreateErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submitCreate() {
    const nextErrors = validateCreateForm(createForm);
    setCreateErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setCreatingServer(true);
    try {
      const server = await ServerService.create({
        name: createForm.name.trim(),
        hostname: createForm.hostname.trim(),
        ip: createForm.ip.trim(),
      });
      setCreatedServer(server);
      setServers((current) => [server, ...current.filter((item) => item.id !== server.id)]);
      setExpandedServerId(server.id);
      showToast("Serveur crÃ©Ã© avec succÃ¨s.");
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setCreatingServer(false);
    }
  }

  function openCreatedDetails() {
    if (!createdServer) return;
    openDetails(createdServer);
    closeCreate();
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

  async function copyCreatedToken() {
    if (!createdServer) return;

    if (await copyText(createdServer.webhook_token)) {
      showToast("Token copiÃ©.");
    } else {
      showToast("Impossible de copier automatiquement. Le token reste sÃ©lectionnable.", "error");
    }
  }

  async function copyCreatedCommand() {
    if (!createdServer) return;

    if (await copyText(`python agent.py --token ${createdServer.webhook_token}`)) {
      showToast("Commande copiÃ©e.");
    } else {
      showToast("Impossible de copier automatiquement. La commande reste sÃ©lectionnable.", "error");
    }
  }

  async function openAgentDownload() {
    if (agentDownloadUrl) await Linking.openURL(agentDownloadUrl);
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
          <View style={styles.headerText}>
            <Text style={styles.heading}>Serveurs surveillés</Text>
            <Text style={styles.subheading}>{"Recherchez un serveur par nom, nom d'hôte ou adresse IP."}</Text>
          </View>
          <Pressable style={styles.addButton} onPress={openCreate}>
            <Ionicons name="add-outline" size={20} color={colors.text} />
            <Text style={styles.addButtonText}>Ajouter un serveur</Text>
          </Pressable>
        </View>

        <View style={styles.filters}>
          <SearchInput
            containerStyle={styles.searchBox}
            placeholder="Rechercher par nom, nom d'hôte ou IP"
            value={search}
            onChangeText={setSearch}
          />
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
            {!compact ? (
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.headerCell, styles.nameCell]}>Nom</Text>
                <Text style={[styles.headerCell, styles.statusCell]}>Statut</Text>
                <Text style={[styles.headerCell, styles.actionsCell]}>Actions</Text>
              </View>
            ) : null}

            {filteredServers.map((server) => {
              const expanded = expandedServerId === server.id;

              return (
                <View key={server.id} style={[styles.tableRow, compact && styles.compactTableRow]}>
                  <Pressable
                    disabled={!compact}
                    style={[styles.nameCell, compact && styles.compactRowMain]}
                    onPress={() => setExpandedServerId(expanded ? null : server.id)}
                  >
                    <View style={styles.serverTextWrap}>
                      <Text style={styles.serverName} numberOfLines={compact ? 2 : 1}>
                        {server.name}
                      </Text>
                      <Text style={styles.serverMeta} numberOfLines={compact ? 2 : 1}>
                        {server.hostname} - {server.ip}
                      </Text>
                    </View>
                    {compact ? (
                      <Ionicons name={expanded ? "chevron-up-outline" : "chevron-down-outline"} size={20} color={colors.muted} />
                    ) : null}
                  </Pressable>
                  {!compact || expanded ? (
                    <>
                      <View style={[styles.statusCell, compact && styles.expandedLine]}>
                        <View style={styles.statusPill}>
                          <View style={[styles.statusDot, statusStyle(server.status)]} />
                          <Text style={styles.statusText}>{statusLabel(server.status)}</Text>
                        </View>
                      </View>
                      <View style={[styles.actionsCell, compact && styles.expandedActions]}>
                        <IconTooltipButton label="Voir les détails" icon="eye-outline" onPress={() => openDetails(server)} />
                        <IconTooltipButton label="Modifier le serveur" icon="create-outline" onPress={() => openEdit(server)} />
                        <IconTooltipButton label="Copier le token" icon="key-outline" onPress={() => copyToken(server)} />
                        <IconTooltipButton label="Régénérer le token" icon="refresh-outline" color={colors.warning} onPress={() => setServerToRotate(server)} />
                        <IconTooltipButton label="Supprimer le serveur" icon="trash-outline" danger onPress={() => setServerToDelete(server)} />
                      </View>
                    </>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>

      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={closeCreate}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, styles.createModal, compact && styles.compactModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{createdServer ? "Token de l'agent" : "Nouveau serveur"}</Text>
              <Pressable accessibilityLabel="Fermer" onPress={closeCreate}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.createModalBody}>
              {!createdServer ? (
                <>
                  <Text style={styles.modalDescription}>
                    {"Créez le serveur, puis copiez le token dans la configuration de l'agent MonOpsX."}
                  </Text>
                  <FormField
                    label="Nom"
                    value={createForm.name}
                    placeholder="Machine locale"
                    error={createErrors.name}
                    onChangeText={(value) => updateCreateField("name", value)}
                  />
                  <FormField
                    label="Nom d'hôte"
                    value={createForm.hostname}
                    placeholder="localhost"
                    error={createErrors.hostname}
                    onChangeText={(value) => updateCreateField("hostname", value)}
                  />
                  <FormField
                    label="Adresse IP"
                    value={createForm.ip}
                    placeholder="127.0.0.1"
                    error={createErrors.ip}
                    keyboardType="numeric"
                    onChangeText={(value) => updateCreateField("ip", value)}
                  />
                  <PrimaryButton label="Créer le serveur" loading={creatingServer} onPress={submitCreate} />
                </>
              ) : (
                <View style={styles.tokenCard}>
                  <Text style={styles.tokenHelp}>
                    {"Ce token est affiché uniquement après la création. Donnez-le à l'agent MonOpsX en ligne de commande."}
                  </Text>
                  <Text selectable style={styles.tokenValue}>
                    {createdServer.webhook_token}
                  </Text>

                  <View style={styles.copyRow}>
                    <Text selectable style={styles.commandValue}>
                      python agent.py --token {createdServer.webhook_token}
                    </Text>
                    <Pressable accessibilityLabel="Copier la commande" style={styles.iconButton} onPress={copyCreatedCommand}>
                      <Ionicons name="copy-outline" size={18} color={colors.text} />
                    </Pressable>
                  </View>

                  <View style={styles.tokenActions}>
                    <Pressable style={styles.secondaryButton} onPress={copyCreatedToken}>
                      <Text style={styles.secondaryButtonText}>Copier le token</Text>
                    </Pressable>
                    {agentDownloadUrl ? (
                      <Pressable style={styles.secondaryButton} onPress={openAgentDownload}>
                        <Ionicons name="logo-github" size={18} color={colors.primary} />
                        <Text style={styles.secondaryButtonText}>{"Télécharger l'agent"}</Text>
                      </Pressable>
                    ) : null}
                    <Pressable style={styles.primaryButton} onPress={openCreatedDetails}>
                      <Text style={styles.primaryButtonText}>Voir le serveur</Text>
                    </Pressable>
                  </View>

                  {!agentDownloadUrl ? (
                    <Text style={styles.deployNote}>
                      {"Configurez EXPO_PUBLIC_MONOPSX_AGENT_DOWNLOAD_URL pour afficher le lien GitHub de téléchargement de l'agent."}
                    </Text>
                  ) : null}
                  <Text style={styles.deployNote}>
                    {"Pour plusieurs instances, créez un serveur séparé et utilisez un token différent pour chaque agent."}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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

function validateCreateForm(form: CreateServerPayload) {
  const nextErrors: FormErrors = {};
  if (!form.name.trim()) nextErrors.name = "Le nom est obligatoire.";
  if (!form.hostname.trim()) nextErrors.hostname = "Le nom d'hôte est obligatoire.";
  if (!form.ip.trim()) nextErrors.ip = "L'adresse IP est obligatoire.";
  return nextErrors;
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
  headerText: {
    flex: 1,
    minWidth: 220,
  },
  heading: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.h2,
  },
  subheading: {
    maxWidth: 720,
    marginTop: spacing.xs,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 21,
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
    flex: 1,
    minWidth: 220,
    maxWidth: 640,
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
  compactTableRow: {
    alignItems: "stretch",
    gap: spacing.sm,
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
  compactRowMain: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  serverTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  statusCell: {
    flex: 1,
    minWidth: 130,
  },
  expandedLine: {
    width: "100%",
    minWidth: 0,
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
  expandedActions: {
    width: "100%",
    minWidth: 0,
    justifyContent: "flex-start",
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
    maxHeight: "92%",
    gap: spacing.md,
    borderRadius: radii.medium,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  createModal: {
    maxWidth: 680,
  },
  compactModal: {
    maxHeight: "100%",
  },
  createModalBody: {
    paddingBottom: spacing.sm,
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
    flexShrink: 1,
  },
  modalDescription: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 21,
    marginBottom: spacing.sm,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
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
  tokenCard: {
    gap: spacing.md,
  },
  tokenHelp: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 21,
  },
  tokenValue: {
    borderRadius: radii.small,
    padding: spacing.md,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
    lineHeight: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.sm,
  },
  commandValue: {
    flex: 1,
    minWidth: 0,
    borderRadius: radii.small,
    padding: spacing.md,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
    lineHeight: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconButton: {
    width: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tokenActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  deployNote: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 21,
  },
});
