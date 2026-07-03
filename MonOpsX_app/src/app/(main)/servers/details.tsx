import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { AppShell } from "@/components/app-shell";
import { FormField } from "@/components/form-field";
// Metro resolves this to .web.tsx or .native.tsx; eslint-import does not understand that Expo convention here.
// eslint-disable-next-line import/no-unresolved
import { GrafanaDashboardFrame } from "@/components/grafana-dashboard-frame";
import { IconTooltipButton } from "@/components/icon-tooltip-button";
import { DashboardHistoryCharts } from "@/components/metric-charts";
import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
import type { DashboardEventType, DashboardMetrics, DashboardPeriod } from "@/models/dashboard.model";
import type { Server, ServerContainer, ServerEvent } from "@/models/server.model";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import { DashboardService } from "@/services/dashboard.service";
import { ServerService } from "@/services/server.service";
import { getApiErrorMessage } from "@/utils/api-error";
import { getServerGrafanaConfig, type GrafanaDashboard, type GrafanaServerContext } from "@/utils/grafana";

type ServerDetailsTab = "informations" | "dashboards" | "containers";
type IconName = React.ComponentProps<typeof Ionicons>["name"];
const dashboardPeriods: DashboardPeriod[] = ["1h", "6h", "24h", "7d", "30d"];
const dashboardEventTypes: DashboardEventType[] = ["all", "deployment", "crash", "threshold", "status", "info"];

export default function ServerDetails() {
  const { showToast } = useToast();
  const { session } = useAuth();
  const params = useLocalSearchParams();
  const serverId = paramValue(params.serverId);
  const initialServer = serverFromValues(
    serverId,
    paramValue(params.serverName),
    paramValue(params.hostname),
    paramValue(params.ip)
  );

  const [server, setServer] = useState<Server | null>(() => initialServer);
  const [activeTab, setActiveTab] = useState<ServerDetailsTab>("informations");
  const [loadingServer, setLoadingServer] = useState(!initialServer && Boolean(serverId));
  const [serverError, setServerError] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [savingAction, setSavingAction] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!serverId) {
      return () => {
        mounted = false;
      };
    }

    async function loadServer() {
      setLoadingServer(true);
      setServerError(null);
      try {
        const servers = await ServerService.getAll();
        const found = servers.find((item) => item.id === serverId);
        if (mounted && found) setServer(found);
        if (mounted && !found) {
          setServer(null);
          setServerError("Serveur introuvable.");
        }
      } catch {
        if (mounted) setServerError("Impossible d'actualiser les détails du serveur.");
      } finally {
        if (mounted) setLoadingServer(false);
      }
    }

    loadServer();
    return () => {
      mounted = false;
    };
  }, [serverId]);

  function openEdit() {
    if (!server) return;
    setEditingName(server.name);
    setActionsOpen(false);
    setEditOpen(true);
  }

  function openDelete() {
    setActionsOpen(false);
    setDeleteOpen(true);
  }

  function openRotate() {
    setActionsOpen(false);
    setRotateOpen(true);
  }

  async function submitEdit() {
    if (!server) return;
    const name = editingName.trim();
    if (!name) {
      showToast("Le nom est obligatoire.", "warning");
      return;
    }

    setSavingAction(true);
    try {
      const updated = await ServerService.update(server.id, { name });
      setServer(updated);
      setEditOpen(false);
      showToast("Serveur modifié.");
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setSavingAction(false);
    }
  }

  async function confirmDelete() {
    if (!server) return;

    setSavingAction(true);
    try {
      await ServerService.delete(server.id);
      setDeleteOpen(false);
      showToast("Serveur supprimé.");
      router.push("/(main)/servers" as never);
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setSavingAction(false);
    }
  }

  async function confirmRotateToken() {
    if (!server) return;

    setSavingAction(true);
    try {
      const rotated = await ServerService.rotateToken(server.id);
      setServer((current) => (current ? { ...current, webhook_token: rotated.webhook_token } : current));
      setRotateOpen(false);
      const copied = await copyText(rotated.webhook_token);
      showToast(copied ? "Token régénéré." : "Token régénéré. Vous pouvez le copier depuis la liste.");
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setSavingAction(false);
    }
  }

  return (
    <AppShell title="Détails du serveur">
      {loadingServer && !server && (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Chargement du serveur</Text>
        </View>
      )}

      {!loadingServer && !server?.id && (
        <View style={styles.stateCard}>
          <Ionicons name="warning-outline" size={30} color={colors.alert} />
          <Text style={styles.stateTitle}>{serverError ?? "Aucun serveur sélectionné."}</Text>
          <IconTooltipButton label="Retour aux serveurs" icon="arrow-back-outline" color={colors.text} onPress={() => router.push("/(main)/servers" as never)} />
        </View>
      )}

      {server?.id && (
        <View style={styles.page}>
          <ServerHeader
            actionsOpen={actionsOpen}
            server={server}
            onCloseActions={() => setActionsOpen(false)}
            onDelete={openDelete}
            onEdit={openEdit}
            onRotate={openRotate}
            onToggleActions={() => setActionsOpen((open) => !open)}
          />

          {serverError && (
            <View style={styles.alert}>
              <Ionicons name="information-circle-outline" size={20} color={colors.info} />
              <Text style={styles.alertText}>{serverError}</Text>
            </View>
          )}

          <View style={styles.mainTabs}>
            <MainTab
              active={activeTab === "informations"}
              icon="information-circle-outline"
              label="Informations"
              onPress={() => setActiveTab("informations")}
            />
            <MainTab
              active={activeTab === "dashboards"}
              icon="stats-chart-outline"
              label="Tableaux de bord"
              onPress={() => setActiveTab("dashboards")}
            />
            <MainTab
              active={activeTab === "containers"}
              icon="cube-outline"
              label="Conteneurs"
              onPress={() => setActiveTab("containers")}
            />
          </View>

          {activeTab === "informations" && <ServerInformation server={server} />}
          {activeTab === "dashboards" && <ServerGrafanaView server={serverToGrafanaContext(server, session?.account_id)} />}
          {activeTab === "containers" && (
            <ServerContainers docker={server.latest_metrics.docker} events={server.latest_metrics.events} />
          )}
        </View>
      )}

      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier le serveur</Text>
              <Pressable accessibilityLabel="Fermer" onPress={() => setEditOpen(false)}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </Pressable>
            </View>
            <FormField label="Nom" value={editingName} onChangeText={setEditingName} placeholder="Nom du serveur" />
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setEditOpen(false)}>
                <Text style={styles.secondaryButtonText}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} disabled={savingAction} onPress={submitEdit}>
                <Text style={styles.primaryButtonText}>{savingAction ? "Enregistrement" : "Enregistrer"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={rotateOpen} transparent animationType="fade" onRequestClose={() => setRotateOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Régénérer le token</Text>
            <Text style={styles.confirmText}>
              {server
                ? `Régénérer le token de ${server.name} ? L'ancien token sera révoqué et l'agent devra être relancé avec le nouveau token.`
                : ""}
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setRotateOpen(false)}>
                <Text style={styles.secondaryButtonText}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} disabled={savingAction} onPress={confirmRotateToken}>
                <Text style={styles.primaryButtonText}>{savingAction ? "Régénération" : "Régénérer"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Confirmation</Text>
            <Text style={styles.confirmText}>
              {server
                ? `Supprimer le serveur ${server.name} ? Le token sera révoqué et l'agent ne pourra plus envoyer de métriques.`
                : ""}
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setDeleteOpen(false)}>
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

function ServerHeader({
  actionsOpen,
  server,
  onCloseActions,
  onDelete,
  onEdit,
  onRotate,
  onToggleActions,
}: {
  actionsOpen: boolean;
  server: Server;
  onCloseActions: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onRotate: () => void;
  onToggleActions: () => void;
}) {
  return (
    <View style={styles.headerRow}>
      <View>
        <Text style={styles.heading}>{server.name || server.hostname || "Serveur"}</Text>
        <Text style={styles.subheading}>
          {server.hostname} - {server.ip}
        </Text>
      </View>
      <View style={styles.headerActions}>
        <IconTooltipButton label="Retour aux serveurs" icon="arrow-back-outline" color={colors.text} onPress={() => router.push("/(main)/servers" as never)} />
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, statusStyle(server.status)]} />
          <Text style={styles.statusText}>{statusLabel(server.status)}</Text>
        </View>
        <View style={styles.actionsMenuWrap}>
          <IconTooltipButton label="Actions du serveur" icon="ellipsis-horizontal" color={colors.text} onPress={onToggleActions} />
          {actionsOpen && (
            <>
              <Pressable style={styles.actionScrim} onPress={onCloseActions} />
              <View style={styles.actionMenu}>
                <Pressable style={styles.actionMenuItem} onPress={onEdit}>
                  <Ionicons name="create-outline" size={18} color={colors.text} />
                  <Text style={styles.actionMenuText}>Modifier</Text>
                </Pressable>
                <Pressable style={styles.actionMenuItem} onPress={onRotate}>
                  <Ionicons name="refresh-outline" size={18} color={colors.text} />
                  <Text style={styles.actionMenuText}>Régénérer le token</Text>
                </Pressable>
                <Pressable style={styles.actionMenuItem} onPress={onDelete}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  <Text style={[styles.actionMenuText, styles.actionMenuDanger]}>Supprimer</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function MainTab({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.mainTab, active && styles.mainTabActive]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={active ? colors.primary : colors.muted} />
      <Text style={[styles.mainTabText, active && styles.mainTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ServerInformation({ server }: { server: Server }) {
  const metrics = server.latest_metrics;
  const uptime = durationValue(metrics.uptime_seconds);

  return (
    <View style={styles.section}>
      <View style={styles.identityRow}>
        <Identity label="ID du serveur" value={server.id} />
        <Identity label="Nom d'hôte" value={server.hostname || "--"} />
        <Identity label="Adresse IP" value={server.ip || "--"} />
        <Identity label="Système d'exploitation" value={textValue(server.operating_system ?? metrics.operating_system)} />
        <Identity label="Dernière activité" value={formatDate(server.last_seen_at)} />
        <Identity label="Disponibilité" value={uptime} />
      </View>

      <View style={styles.metricsGrid}>
        <Metric label="CPU" value={percentValue(metrics.cpu_percent)} />
        <Metric label="RAM" value={percentValue(metrics.memory_percent)} />
        <Metric label="Disque" value={percentValue(metrics.disk_percent)} />
        <Metric label="Charge système" value={numberValue(metrics.load_average_1m)} />
        <Metric label="Temps actif" value={uptime} />
        <Metric label="Version agent" value={textValue(metrics.agent_version)} />
      </View>

    </View>
  );
}

function ServerContainers({
  docker,
  events,
}: {
  docker: Server["latest_metrics"]["docker"];
  events: Server["latest_metrics"]["events"];
}) {
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const [expandedContainerKey, setExpandedContainerKey] = useState<string | null>(null);
  const containers = docker?.containers ?? [];
  const latestEvents = events ?? [];

  return (
    <View style={styles.containersSection}>
      <View>
        <Text style={styles.sectionTitle}>Conteneurs</Text>
        <Text style={styles.sectionSubtitle}>Statuts, images, dernier build, temps actif et événements récents.</Text>
      </View>

      {!docker?.available && (
        <View style={styles.stateCard}>
          <Ionicons name="cube-outline" size={32} color={colors.muted} />
          <Text style={styles.stateTitle}>{"Docker n'est pas disponible"}</Text>
          <Text style={styles.stateText}>{"L'agent n'a pas envoyé d'informations sur les conteneurs."}</Text>
        </View>
      )}

      {docker?.available && containers.length === 0 && (
        <View style={styles.stateCard}>
          <Ionicons name="cube-outline" size={32} color={colors.muted} />
          <Text style={styles.stateTitle}>Aucun conteneur détecté</Text>
          <Text style={styles.stateText}>{"L'agent fonctionne, mais aucun conteneur Docker n'a été trouvé."}</Text>
        </View>
      )}

      {docker?.available && containers.length > 0 && (
        <View style={styles.containerList}>
          {containers.map((container) => {
            const key = `${container.name}-${container.image}`;
            return (
              <ContainerRow
                key={key}
                compact={compact}
                container={container}
                expanded={expandedContainerKey === key}
                onToggle={() => setExpandedContainerKey((current) => (current === key ? null : key))}
              />
            );
          })}
        </View>
      )}

      <View style={styles.eventsBlock}>
        <Text style={styles.eventsTitle}>Événements</Text>
        {latestEvents.length === 0 ? (
          <Text style={styles.emptyText}>Aucun événement récent.</Text>
        ) : (
          <View style={styles.eventsList}>
            {latestEvents.map((event, index) => (
              <EventRow key={`${event.type}-${event.message}-${index}`} event={event} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function ContainerRow({
  compact,
  container,
  expanded,
  onToggle,
}: {
  compact: boolean;
  container: ServerContainer;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={[styles.containerRow, compact && styles.containerRowCompact]}>
      <Pressable disabled={!compact} style={styles.containerMainRow} onPress={onToggle}>
        <View style={styles.containerMain}>
          <Text style={styles.containerName} numberOfLines={compact ? 2 : 1}>
            {container.name}
          </Text>
          <Text style={styles.containerImage} numberOfLines={compact ? 2 : 1}>
            {container.image}
          </Text>
        </View>
        {compact ? <Ionicons name={expanded ? "chevron-up-outline" : "chevron-down-outline"} size={20} color={colors.muted} /> : null}
      </Pressable>
      {!compact || expanded ? (
        <View style={[styles.containerInfo, compact && styles.containerInfoCompact]}>
          <InfoPill label="Statut" value={containerStatusLabel(container.status)} />
          <InfoPill label="Dernier build" value={formatDate(container.last_build_at ?? null)} />
          <InfoPill label="Temps actif" value={durationValue(container.uptime_seconds)} />
          <InfoPill label="Redémarrages" value={String(container.restart_count ?? 0)} />
        </View>
      ) : null}
    </View>
  );
}

function EventRow({ event }: { event: ServerEvent }) {
  return (
    <View style={styles.eventRow}>
      <View style={[styles.eventDot, severityStyle(event.severity)]} />
      <View style={styles.eventContent}>
        <Text style={styles.eventType}>
          {eventTypeLabel(event.type)} - {severityLabel(event.severity)}
        </Text>
        <Text style={styles.eventMessage}>{event.message}</Text>
      </View>
    </View>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ServerGrafanaView({ server }: { server: GrafanaServerContext }) {
  const config = useMemo(
    () => (server.accountId ? getServerGrafanaConfig(server) : { dashboards: [], errors: [], configured: false }),
    [server]
  );
  const [selectedId, setSelectedId] = useState(config.dashboards[0]?.id);
  const [loading, setLoading] = useState(Boolean(config.dashboards[0]));
  const [frameError, setFrameError] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardMetrics | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("24h");
  const [eventType, setEventType] = useState<DashboardEventType>("all");
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const selectedDashboard = config.dashboards.find((dashboard) => dashboard.id === selectedId) ?? config.dashboards[0];

  useEffect(() => {
    let mounted = true;

    async function loadMetrics() {
      setMetricsLoading(true);
      setMetricsError(null);
      try {
        const data = await DashboardService.getMetrics({
          period,
          serverId: server.serverId,
          eventType,
        });
        if (mounted) setDashboard(data);
      } catch {
        if (mounted) setMetricsError("Impossible de charger l'historique des métriques.");
      } finally {
        if (mounted) setMetricsLoading(false);
      }
    }

    loadMetrics();
    return () => {
      mounted = false;
    };
  }, [eventType, period, server.serverId]);

  function selectDashboard(dashboard: GrafanaDashboard) {
    setSelectedId(dashboard.id);
    setLoading(true);
    setFrameError(false);
  }

  async function openGrafana() {
    if (selectedDashboard) await Linking.openURL(selectedDashboard.url);
  }

  return (
    <View style={styles.section}>
      <View style={styles.dashboardHeader}>
        <View>
          <Text style={styles.sectionTitle}>Tableaux de bord Grafana</Text>
          <Text style={styles.sectionSubtitle}>
            Métriques filtrées pour {server.hostname || server.ip || server.serverId}.
          </Text>
        </View>
        {server.accountId && selectedDashboard && (
          <Pressable style={styles.openButton} onPress={openGrafana}>
            <Ionicons name="open-outline" size={18} color={colors.text} />
            <Text style={styles.openButtonText}>Ouvrir dans Grafana</Text>
          </Pressable>
        )}
      </View>

      {server.accountId && !config.configured && (
        <View style={styles.alert}>
          <Ionicons name="information-circle-outline" size={20} color={colors.info} />
          <Text style={styles.alertText}>
            {"Grafana n'est pas configuré pour ce serveur. Les graphiques natifs utilisent l'historique collecté par l'agent."}
          </Text>
        </View>
      )}

      <View style={styles.filterPanel}>
        <ServerDashboardFilter label="Période" options={dashboardPeriods} value={period} onChange={(value) => setPeriod(value as DashboardPeriod)} />
        <ServerDashboardFilter
          label="Type événement"
          options={dashboardEventTypes}
          labels={{
            all: "Tous",
            deployment: "Déploiement",
            crash: "Incident",
            threshold: "Seuil",
            status: "Statut",
            info: "Info",
          }}
          value={eventType}
          onChange={(value) => setEventType(value as DashboardEventType)}
        />
      </View>

      {config.configured && config.errors.length > 0 && (
        <View style={styles.alert}>
          <Ionicons name="warning-outline" size={20} color={colors.alert} />
          <View style={styles.alertTextWrap}>
            <Text style={styles.alertTitle}>La configuration Grafana nécessite votre attention</Text>
            {config.errors.map((error) => (
              <Text key={error} style={styles.alertText}>
                {error}
              </Text>
            ))}
          </View>
        </View>
      )}

      {server.accountId && selectedDashboard && (
        <>
          {config.dashboards.length > 1 && (
            <View style={styles.dashboardTabs}>
              {config.dashboards.map((dashboard) => {
                const active = dashboard.id === selectedDashboard.id;
                return (
                  <Pressable
                    key={dashboard.id}
                    style={[styles.dashboardTab, active && styles.dashboardTabActive]}
                    onPress={() => selectDashboard(dashboard)}
                  >
                    <Ionicons name="stats-chart-outline" size={18} color={active ? colors.primary : colors.muted} />
                    <Text style={[styles.dashboardTabText, active && styles.dashboardTabTextActive]} numberOfLines={1}>
                      {dashboard.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.embedCard}>
            <View style={styles.embedHeader}>
              <View>
                <Text style={styles.embedTitle}>{selectedDashboard.title}</Text>
                <Text style={styles.embedUrl} numberOfLines={1}>
                  {selectedDashboard.url}
                </Text>
              </View>
              {loading && <ActivityIndicator color={colors.primary} size="small" />}
            </View>

            {frameError && (
              <View style={styles.alert}>
                <Ionicons name="information-circle-outline" size={20} color={colors.info} />
                <Text style={styles.alertText}>
                  {"Grafana ne s'est pas chargé dans l'application. Les graphiques natifs utilisent l'historique collecté par l'agent."}
                </Text>
              </View>
            )}

            <GrafanaDashboardFrame
              key={selectedDashboard.id}
              url={selectedDashboard.url}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setFrameError(true);
              }}
            />
          </View>
        </>
      )}

      {metricsLoading && (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>{"Chargement de l'historique des métriques"}</Text>
        </View>
      )}

      {metricsError && (
        <View style={styles.alert}>
          <Ionicons name="warning-outline" size={20} color={colors.alert} />
          <Text style={styles.alertText}>{metricsError}</Text>
        </View>
      )}

      {!metricsLoading && !metricsError && dashboard && (
        <DashboardHistoryCharts data={dashboard} />
      )}
    </View>
  );
}

function ServerDashboardFilter({
  label,
  options,
  labels = {},
  value,
  onChange,
}: {
  label: string;
  options: string[];
  labels?: Record<string, string>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.filterOptions}>
        {options.map((option) => {
          const active = option === value;
          return (
            <Pressable key={option} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => onChange(option)}>
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{labels[option] ?? option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Identity({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.identityItem}>
      <Text style={styles.identityLabel}>{label}</Text>
      <Text style={styles.identityValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function serverFromValues(
  serverId: string | undefined,
  serverName: string | undefined,
  hostname: string | undefined,
  ip: string | undefined
): Server | null {
  if (!serverId) return null;

  return {
    id: serverId,
    name: serverName ?? "",
    hostname: hostname ?? "",
    ip: ip ?? "",
    operating_system: null,
    status: "pending",
    latest_metrics: {},
    last_seen_at: null,
  };
}

function serverToGrafanaContext(server: Server, accountId?: string): GrafanaServerContext {
  return {
    accountId,
    serverId: server.id,
    serverName: server.name,
    hostname: server.hostname,
    ip: server.ip,
  };
}

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

function percentValue(value: unknown) {
  return typeof value === "number" ? `${value.toFixed(0)}%` : "--";
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value.toFixed(2) : "--";
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "--";
}

function durationValue(value: unknown) {
  if (typeof value !== "number") return "--";
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (days > 0) return `${days} j ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

function formatDate(value: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString("fr-FR");
}

function containerStatusLabel(status: string) {
  if (status === "running") return "En cours";
  if (status === "exited") return "Arrêté";
  if (status === "paused") return "En pause";
  if (status === "restarting") return "Redémarrage";
  return status || "--";
}

function eventTypeLabel(type: string) {
  if (type === "deployment") return "Déploiement";
  if (type === "crash") return "Incident";
  if (type === "threshold") return "Seuil";
  if (type === "status") return "Statut";
  return "Information";
}

function severityLabel(severity: string) {
  if (severity === "critical") return "Critique";
  if (severity === "warning") return "Avertissement";
  return "Info";
}

function severityStyle(severity: string) {
  if (severity === "critical") return { backgroundColor: colors.danger };
  if (severity === "warning") return { backgroundColor: colors.warning };
  return { backgroundColor: colors.info };
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
    position: "relative",
    zIndex: 1000,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  actionsMenuWrap: {
    position: "relative",
    zIndex: 2000,
  },
  actionMenuButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionScrim: {
    position: "absolute",
    top: -400,
    right: -400,
    bottom: -400,
    left: -400,
    zIndex: 1,
  },
  actionMenu: {
    position: "absolute",
    top: 46,
    right: 0,
    zIndex: 2001,
    elevation: 20,
    minWidth: 220,
    gap: spacing.xs,
    borderRadius: radii.medium,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionMenuItem: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.small,
    paddingHorizontal: spacing.sm,
  },
  actionMenuText: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  actionMenuDanger: {
    color: colors.danger,
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
  statusPill: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
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
    fontSize: typography.body,
  },
  mainTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 1,
  },
  mainTab: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  mainTabActive: {
    borderBottomColor: colors.primary,
  },
  mainTabText: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  mainTabTextActive: {
    color: colors.primary,
  },
  section: {
    gap: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.h3,
  },
  sectionSubtitle: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
  },
  identityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  identityItem: {
    minWidth: 190,
    flex: 1,
    borderRadius: radii.medium,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  identityLabel: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
  },
  identityValue: {
    marginTop: spacing.xs,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  containersSection: {
    gap: spacing.md,
  },
  containerList: {
    gap: spacing.sm,
  },
  containerRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    borderRadius: radii.medium,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  containerRowCompact: {
    alignItems: "stretch",
  },
  containerMainRow: {
    flex: 1.4,
    minWidth: 220,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  containerMain: {
    flex: 1,
    minWidth: 0,
  },
  containerName: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.bodyLarge,
    lineHeight: 22,
  },
  containerImage: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  containerInfo: {
    flex: 3,
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  containerInfoCompact: {
    width: "100%",
    flex: 0,
  },
  infoPill: {
    minWidth: 130,
    flexGrow: 1,
    gap: spacing.xs,
    borderRadius: radii.small,
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  infoLabel: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
  },
  infoValue: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  eventsBlock: {
    gap: spacing.sm,
  },
  eventsTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.bodyLarge,
  },
  eventsList: {
    gap: spacing.sm,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.medium,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventDot: {
    width: 10,
    height: 10,
    marginTop: 5,
    borderRadius: 5,
  },
  eventContent: {
    flex: 1,
    gap: spacing.xs,
  },
  eventType: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  eventMessage: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 21,
  },
  emptyText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
  },
  metric: {
    width: 190,
    maxWidth: "100%",
    minHeight: 76,
    justifyContent: "center",
    borderRadius: radii.medium,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.bodyLarge,
  },
  metricLabel: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
  },
  dashboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  openButton: {
    minHeight: 42,
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
  openButtonText: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  filterPanel: {
    gap: spacing.md,
    borderRadius: radii.medium,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterGroup: {
    gap: spacing.sm,
  },
  filterLabel: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  filterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterChip: {
    minHeight: 34,
    justifyContent: "center",
    borderRadius: radii.medium,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: "rgba(14,165,255,0.13)",
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: typography.caption,
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  secondaryButton: {
    minHeight: 42,
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
  dashboardTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  dashboardTab: {
    minHeight: 42,
    maxWidth: 220,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.medium,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dashboardTabActive: {
    backgroundColor: "rgba(14,165,255,0.13)",
    borderColor: "rgba(14,165,255,0.35)",
  },
  dashboardTabText: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  dashboardTabTextActive: {
    color: colors.primary,
  },
  embedCard: {
    gap: spacing.md,
    borderRadius: radii.medium,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  embedHeader: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  embedTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.h3,
  },
  embedUrl: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
  },
  alert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.medium,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alertTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  alertTitle: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  alertText: {
    flex: 1,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
  },
  stateCard: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.medium,
    padding: spacing.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stateTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.h3,
    textAlign: "center",
  },
  stateText: {
    maxWidth: 620,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    textAlign: "center",
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
