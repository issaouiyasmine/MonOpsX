import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { AppShell } from "@/components/app-shell";
// Metro resolves this to .web.tsx or .native.tsx; eslint-import does not understand that Expo convention here.
// eslint-disable-next-line import/no-unresolved
import { GrafanaDashboardFrame } from "@/components/grafana-dashboard-frame";
import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
import type { Server } from "@/models/server.model";
import { ServerService } from "@/services/server.service";
import { getServerGrafanaConfig, type GrafanaDashboard, type GrafanaServerContext } from "@/utils/grafana";

export default function ServerDetails() {
  const params = useLocalSearchParams();
  const initialServer = serverFromParams(params);
  const [server, setServer] = useState<GrafanaServerContext | null>(() => initialServer);
  const [loadingServer, setLoadingServer] = useState(Boolean(initialServer?.serverId && !initialServer.hostname));
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const initialServer = serverFromParams(params);

    if (!initialServer?.serverId || initialServer.hostname) {
      return () => {
        mounted = false;
      };
    }

    const serverId = initialServer.serverId;

    async function loadServer() {
      try {
        const servers = await ServerService.getAll();
        const found = servers.find((item) => item.id === serverId);
        if (mounted && found) setServer(serverFromRecord(found));
        if (mounted && !found) setServerError("Server not found.");
      } catch {
        if (mounted) setServerError("Unable to load server details.");
      } finally {
        if (mounted) setLoadingServer(false);
      }
    }

    loadServer();
    return () => {
      mounted = false;
    };
  }, [params]);

  return (
    <AppShell title="Server details">
      {loadingServer && (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading server</Text>
        </View>
      )}

      {!loadingServer && (!server?.serverId || serverError) && (
        <View style={styles.stateCard}>
          <Ionicons name="warning-outline" size={30} color={colors.alert} />
          <Text style={styles.stateTitle}>{serverError ?? "No server selected"}</Text>
          <Pressable style={styles.secondaryButton} onPress={() => router.push("/(main)/servers" as never)}>
            <Ionicons name="arrow-back-outline" size={18} color={colors.text} />
            <Text style={styles.secondaryButtonText}>Back to servers</Text>
          </Pressable>
        </View>
      )}

      {!loadingServer && server?.serverId && !serverError && <ServerGrafanaView key={server.serverId} server={server} />}
    </AppShell>
  );
}

function ServerGrafanaView({ server }: { server: GrafanaServerContext }) {
  const config = useMemo(() => getServerGrafanaConfig(server), [server]);
  const [selectedId, setSelectedId] = useState(config.dashboards[0]?.id);
  const [loading, setLoading] = useState(Boolean(config.dashboards[0]));
  const [frameError, setFrameError] = useState(false);
  const selectedDashboard = config.dashboards.find((dashboard) => dashboard.id === selectedId) ?? config.dashboards[0];

  function selectDashboard(dashboard: GrafanaDashboard) {
    setSelectedId(dashboard.id);
    setLoading(true);
    setFrameError(false);
  }

  async function openGrafana() {
    if (selectedDashboard) await Linking.openURL(selectedDashboard.url);
  }

  return (
    <View style={styles.page}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>{server.serverName || server.hostname || "Server metrics"}</Text>
          <Text style={styles.subheading}>
            Grafana metrics filtered for {server.hostname || server.ip || server.serverId}.
          </Text>
        </View>
        {selectedDashboard && (
          <Pressable style={styles.openButton} onPress={openGrafana}>
            <Ionicons name="open-outline" size={18} color={colors.text} />
            <Text style={styles.openButtonText}>Open in Grafana</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.identityRow}>
        <Identity label="Server ID" value={server.serverId} />
        <Identity label="Hostname" value={server.hostname || "--"} />
        <Identity label="IP" value={server.ip || "--"} />
      </View>

      {!config.configured && (
        <View style={styles.stateCard}>
          <Ionicons name="analytics-outline" size={34} color={colors.primary} />
          <Text style={styles.stateTitle}>Server Grafana dashboard is not configured</Text>
          <Text style={styles.stateText}>
            Add EXPO_PUBLIC_GRAFANA_SERVER_DASHBOARDS with placeholders like {"{serverId}"}, {"{hostname}"}, or {"{ip}"}.
          </Text>
        </View>
      )}

      {config.configured && config.errors.length > 0 && (
        <View style={styles.alert}>
          <Ionicons name="warning-outline" size={20} color={colors.alert} />
          <View style={styles.alertTextWrap}>
            <Text style={styles.alertTitle}>Grafana configuration needs attention</Text>
            {config.errors.map((error) => (
              <Text key={error} style={styles.alertText}>
                {error}
              </Text>
            ))}
          </View>
        </View>
      )}

      {selectedDashboard && (
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
                  Grafana did not load inside the app. Confirm Grafana allows embedding and that the server variables exist.
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

function serverFromParams(params: ReturnType<typeof useLocalSearchParams>): GrafanaServerContext | null {
  const serverId = paramValue(params.serverId);
  if (!serverId) return null;

  return {
    serverId,
    serverName: paramValue(params.serverName),
    hostname: paramValue(params.hostname),
    ip: paramValue(params.ip),
  };
}

function serverFromRecord(server: Server): GrafanaServerContext {
  return {
    serverId: server.id,
    serverName: server.name,
    hostname: server.hostname,
    ip: server.ip,
  };
}

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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
});
