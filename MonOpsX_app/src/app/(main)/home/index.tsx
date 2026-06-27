import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { AppShell } from "@/components/app-shell";
// Metro resolves this to .web.tsx or .native.tsx; eslint-import does not understand that Expo convention here.
// eslint-disable-next-line import/no-unresolved
import { GrafanaDashboardFrame } from "@/components/grafana-dashboard-frame";
import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
import { getGlobalGrafanaConfig, type GrafanaDashboard } from "@/utils/grafana";

export default function Home() {
  const config = useMemo(() => getGlobalGrafanaConfig(), []);
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
    if (selectedDashboard) {
      await Linking.openURL(selectedDashboard.url);
    }
  }

  return (
    <AppShell title="Dashboard">
      <View style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.heading}>État global des serveurs</Text>
            <Text style={styles.subheading}>Récapitulatif Grafana de tous les serveurs surveillés.</Text>
          </View>
          {selectedDashboard && (
            <Pressable style={styles.openButton} onPress={openGrafana}>
              <Ionicons name="open-outline" size={18} color={colors.text} />
              <Text style={styles.openButtonText}>Ouvrir dans Grafana</Text>
            </Pressable>
          )}
        </View>

        {!config.configured && <EmptyState />}

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

        {config.configured && !selectedDashboard && (
          <View style={styles.emptyCard}>
            <Ionicons name="analytics-outline" size={34} color={colors.muted} />
            <Text style={styles.emptyTitle}>Aucun tableau de bord valide trouvé</Text>
            <Text style={styles.emptyText}>Vérifiez EXPO_PUBLIC_GRAFANA_DASHBOARDS et utilisez le format Titre|URL.</Text>
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
                    Grafana ne s'est pas chargé dans l'application. Vérifiez que l'intégration est autorisée, puis essayez de l'ouvrir directement.
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

function EmptyState() {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="analytics-outline" size={36} color={colors.primary} />
      <Text style={styles.emptyTitle}>Le tableau de bord Grafana n'est pas configuré</Text>
      <Text style={styles.emptyText}>
        Ajoutez EXPO_PUBLIC_GRAFANA_BASE_URL et EXPO_PUBLIC_GRAFANA_GLOBAL_DASHBOARDS à votre environnement Expo.
      </Text>
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
    minHeight: 280,
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
