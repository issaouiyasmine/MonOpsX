import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppShell } from "@/components/app-shell";
import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
import type { Server } from "@/models/server.model";
import { ServerService } from "@/services/server.service";

export default function Servers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <AppShell title="Serveurs">
      <View style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.heading}>Serveurs surveillés</Text>
            <Text style={styles.subheading}>Ouvrez un serveur pour consulter ses métriques Grafana dédiées.</Text>
          </View>
          <Pressable style={styles.addButton} onPress={() => router.push("/(main)/servers/create" as never)}>
            <Ionicons name="add-outline" size={20} color={colors.text} />
            <Text style={styles.addButtonText}>Ajouter un serveur</Text>
          </Pressable>
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

        {!loading && !error && servers.length > 0 && (
          <View style={styles.grid}>
            {servers.map((server) => (
              <Pressable key={server.id} style={styles.serverCard} onPress={() => openDetails(server)}>
                <View style={styles.serverHeader}>
                  <View style={[styles.statusDot, statusStyle(server.status)]} />
                  <Text style={styles.serverName} numberOfLines={1}>
                    {server.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                </View>
                <Text style={styles.serverStatus}>{statusLabel(server.status)}</Text>
                <Text style={styles.serverMeta} numberOfLines={1}>
                  {server.hostname}
                </Text>
                <Text style={styles.serverMeta} numberOfLines={1}>
                  {server.ip}
                </Text>
                <View style={styles.metricsRow}>
                  <Metric label="CPU" value={metricValue(server.latest_metrics.cpu_percent)} />
                  <Metric label="RAM" value={metricValue(server.latest_metrics.memory_percent)} />
                  <Metric label="Disque" value={metricValue(server.latest_metrics.disk_percent)} />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </AppShell>
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

function metricValue(value: unknown) {
  return typeof value === "number" ? `${value.toFixed(0)}%` : "--";
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
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  serverCard: {
    width: 320,
    maxWidth: "100%",
    gap: spacing.sm,
    borderRadius: radii.medium,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serverHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  serverName: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.bodyLarge,
  },
  serverStatus: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: typography.caption,
  },
  serverMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
  },
  metricsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  metric: {
    flex: 1,
    minHeight: 58,
    justifyContent: "center",
    borderRadius: radii.small,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  metricValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.bodyLarge,
  },
  metricLabel: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
  },
});
