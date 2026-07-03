import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { AppShell } from "@/components/app-shell";
// Metro resolves this to .web.tsx or .native.tsx; eslint-import does not understand that Expo convention here.
// eslint-disable-next-line import/no-unresolved
import { GrafanaDashboardFrame } from "@/components/grafana-dashboard-frame";
import { DashboardHistoryCharts } from "@/components/metric-charts";
import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
import type { DashboardEventType, DashboardMetrics, DashboardPeriod } from "@/models/dashboard.model";
import type { Server } from "@/models/server.model";
import { useAuth } from "@/providers/auth-provider";
import { DashboardService } from "@/services/dashboard.service";
import { ServerService } from "@/services/server.service";
import { getGlobalGrafanaConfig, type GrafanaDashboard } from "@/utils/grafana";

const periods: DashboardPeriod[] = ["1h", "6h", "24h", "7d", "30d"];
const eventTypes: DashboardEventType[] = ["all", "deployment", "crash", "threshold", "status", "info"];

export default function Home() {
  const { session } = useAuth();
  const accountId = session?.account_id;
  const config = useMemo(() => (accountId ? getGlobalGrafanaConfig(accountId) : { dashboards: [], errors: [], configured: false }), [accountId]);
  const [servers, setServers] = useState<Server[]>([]);
  const [dashboard, setDashboard] = useState<DashboardMetrics | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("24h");
  const [serverId, setServerId] = useState("all");
  const [eventType, setEventType] = useState<DashboardEventType>("all");
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(config.dashboards[0]?.id);
  const [loading, setLoading] = useState(Boolean(config.dashboards[0]));
  const [frameError, setFrameError] = useState(false);

  const selectedDashboard = config.dashboards.find((dashboard) => dashboard.id === selectedId) ?? config.dashboards[0];

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setMetricsLoading(true);
      setMetricsError(null);
      try {
        const [serverData, dashboardData] = await Promise.all([
          ServerService.getAll(),
          DashboardService.getMetrics({
            period,
            serverId: serverId === "all" ? undefined : serverId,
            eventType,
          }),
        ]);
        if (mounted) {
          setServers(serverData);
          setDashboard(dashboardData);
        }
      } catch {
        if (mounted) setMetricsError("Impossible de charger les métriques historiques.");
      } finally {
        if (mounted) setMetricsLoading(false);
      }
    }

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, [eventType, period, serverId]);

  function selectDashboard(dashboard: GrafanaDashboard) {
    setSelectedId(dashboard.id);
    setLoading(true);
    setFrameError(false);
  }

  async function openGrafana() {
    if (selectedDashboard) {
      await Linking.openURL(selectedDashboard.url);
    }
  }

  return (
    <AppShell title="Tableau de bord">
      <View style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.heading}>Etat global des serveurs</Text>
            <Text style={styles.subheading}>Metriques collectees de tous les serveurs surveilles.</Text>
          </View>
          {selectedDashboard && (
            <Pressable style={styles.openButton} onPress={openGrafana}>
              <Ionicons name="open-outline" size={18} color={colors.text} />
              <Text style={styles.openButtonText}>Ouvrir dans Grafana</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.filterPanel}>
          <FilterGroup label="Période" options={periods} value={period} onChange={(value) => setPeriod(value as DashboardPeriod)} />
          <FilterGroup
            label="Serveur"
            options={["all", ...servers.map((server) => server.id)]}
            labels={{ all: "Tous les serveurs", ...Object.fromEntries(servers.map((server) => [server.id, server.name || server.hostname])) }}
            value={serverId}
            onChange={setServerId}
          />
          <FilterGroup
            label="Type événement"
            options={eventTypes}
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

        {metricsLoading && (
          <View style={styles.emptyCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.emptyText}>Chargement des metriques collectees</Text>
          </View>
        )}

        {metricsError && (
          <View style={styles.alert}>
            <Ionicons name="information-circle-outline" size={20} color={colors.info} />
            <Text style={styles.alertText}>{metricsError}</Text>
          </View>
        )}

        {!metricsLoading && !metricsError && dashboard && <DashboardHistoryCharts data={dashboard} />}

        {accountId && !config.configured && (
          <View style={styles.alert}>
            <Ionicons name="information-circle-outline" size={20} color={colors.info} />
            <Text style={styles.alertText}>
              {"Grafana n'est pas configure dans l'environnement Expo. Les graphiques natifs affichent les metriques collectees en attendant."}
            </Text>
          </View>
        )}

        {config.configured && config.errors.length > 0 && (
          <View style={styles.alert}>
            <Ionicons name="warning-outline" size={20} color={colors.alert} />
            <View style={styles.alertTextWrap}>
              <Text style={styles.alertTitle}>La configuration Grafana necessite votre attention</Text>
              {config.errors.map((error) => (
                <Text key={error} style={styles.alertText}>
                  {error}
                </Text>
              ))}
            </View>
          </View>
        )}

        {accountId && config.configured && !selectedDashboard && (
          <View style={styles.emptyCard}>
            <Ionicons name="analytics-outline" size={34} color={colors.muted} />
            <Text style={styles.emptyTitle}>Aucun tableau de bord valide trouve</Text>
            <Text style={styles.emptyText}>Verifiez EXPO_PUBLIC_GRAFANA_DASHBOARDS et utilisez le format Titre|URL.</Text>
          </View>
        )}

        {accountId && selectedDashboard && (
          <>
            {config.dashboards.length > 1 && (
              <View style={styles.tabs}>
                {config.dashboards.map((dashboard) => {
                  const active = dashboard.id === selectedDashboard.id;
                  return (
                    <Pressable
                      key={dashboard.id}
                      style={[styles.tab, active && styles.tabActive]}
                      onPress={() => selectDashboard(dashboard)}
                    >
                      <Ionicons name="stats-chart-outline" size={18} color={active ? colors.primary : colors.muted} />
                      <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
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
                    {"Grafana ne s'est pas charge dans l'application. Les graphiques natifs restent disponibles ci-dessus."}
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
      </View>
    </AppShell>
  );
}

function FilterGroup({
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
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]} numberOfLines={1}>
                {labels[option] ?? option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
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
    maxWidth: 220,
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
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tab: {
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
  tabActive: {
    backgroundColor: "rgba(14,165,255,0.13)",
    borderColor: "rgba(14,165,255,0.35)",
  },
  tabText: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  tabTextActive: {
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
  emptyCard: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.medium,
    padding: spacing.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    marginTop: spacing.sm,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.h3,
    textAlign: "center",
  },
  emptyText: {
    maxWidth: 520,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    textAlign: "center",
  },
});
