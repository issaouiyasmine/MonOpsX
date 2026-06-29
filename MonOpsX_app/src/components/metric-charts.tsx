import { Ionicons } from "@expo/vector-icons";
import type React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
import type { DashboardEvent, DashboardMetrics, DashboardPoint } from "@/models/dashboard.model";
import type { Server, ServerMetric, ServerLatestMetrics } from "@/models/server.model";

type MetricKey = "cpu_percent" | "memory_percent" | "disk_percent" | "load_average_1m";

const metricDefinitions: { key: MetricKey; label: string; unit: string; color: string; max?: number }[] = [
  { key: "cpu_percent", label: "CPU", unit: "%", color: colors.primary, max: 100 },
  { key: "memory_percent", label: "RAM", unit: "%", color: colors.info, max: 100 },
  { key: "disk_percent", label: "Disque", unit: "%", color: colors.warning, max: 100 },
  { key: "load_average_1m", label: "Charge", unit: "", color: colors.success },
];

export function GlobalMetricCharts({ servers }: { servers: Server[] }) {
  const online = servers.filter((server) => server.status === "online").length;
  const degraded = servers.filter((server) => server.status === "degraded").length;
  const offline = servers.filter((server) => server.status === "offline").length;

  return (
    <View style={styles.section}>
      <View style={styles.summaryGrid}>
        <SummaryCard label="Serveurs" value={String(servers.length)} icon="server-outline" />
        <SummaryCard label="En ligne" value={String(online)} icon="checkmark-circle-outline" tone={colors.success} />
        <SummaryCard label="Degrades" value={String(degraded)} icon="warning-outline" tone={colors.warning} />
        <SummaryCard label="Hors ligne" value={String(offline)} icon="close-circle-outline" tone={colors.danger} />
      </View>

      {servers.length === 0 ? (
        <View style={styles.stateCard}>
          <Ionicons name="analytics-outline" size={34} color={colors.muted} />
          <Text style={styles.stateTitle}>Aucune metrique collectee</Text>
          <Text style={styles.stateText}>{"Ajoutez un serveur et lancez l'agent MonOpsX pour alimenter les graphiques."}</Text>
        </View>
      ) : (
        <View style={styles.chartGrid}>
          {metricDefinitions.map((metric) => (
            <MetricBarChart
              key={metric.key}
              title={metric.label}
              unit={metric.unit}
              color={metric.color}
              max={metric.max}
              values={servers.map((server) => ({
                label: server.name || server.hostname || server.ip || "Serveur",
                value: numberValue(server.latest_metrics?.[metric.key]),
              }))}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export function ServerMetricHistory({ metrics }: { metrics: ServerMetric[] }) {
  const ordered = [...metrics].reverse();

  if (ordered.length === 0) {
    return (
      <View style={styles.stateCard}>
        <Ionicons name="analytics-outline" size={34} color={colors.muted} />
        <Text style={styles.stateTitle}>Aucune metrique recente</Text>
        <Text style={styles.stateText}>{"L'agent n'a pas encore envoye d'historique pour ce serveur."}</Text>
      </View>
    );
  }

  const latest = ordered[ordered.length - 1]?.metrics ?? {};

  return (
    <View style={styles.section}>
      <View style={styles.summaryGrid}>
        {metricDefinitions.map((metric) => (
          <SummaryCard
            key={metric.key}
            label={metric.label}
            value={formatMetric(numberValue(latest[metric.key]), metric.unit)}
            icon="speedometer-outline"
            tone={metric.color}
          />
        ))}
      </View>

      <View style={styles.chartGrid}>
        {metricDefinitions.map((metric) => (
          <MetricBarChart
            key={metric.key}
            title={`${metric.label} recent`}
            unit={metric.unit}
            color={metric.color}
            max={metric.max}
            compact
            values={ordered.map((item) => ({
              label: timeLabel(item.collected_at),
              value: numberValue(item.metrics?.[metric.key]),
            }))}
          />
        ))}
      </View>
    </View>
  );
}

export function DashboardHistoryCharts({ data }: { data: DashboardMetrics }) {
  if (data.points.length === 0) {
    return (
      <View style={styles.stateCard}>
        <Ionicons name="analytics-outline" size={34} color={colors.muted} />
        <Text style={styles.stateTitle}>Aucune donnée historique</Text>
        <Text style={styles.stateText}>Aucune métrique ne correspond aux filtres sélectionnés.</Text>
      </View>
    );
  }

  return (
    <View style={styles.monitorBoard}>
      <View style={styles.kpiStrip}>
        <Kpi label="Serveurs" value={String(data.summary.servers)} tone={colors.primary} />
        <Kpi label="En ligne" value={String(data.summary.online)} tone={colors.success} />
        <Kpi label="Dégradés" value={String(data.summary.degraded)} tone={colors.warning} />
        <Kpi label="Conteneurs" value={String(data.summary.containers ?? 0)} tone={colors.info} />
        <Kpi label="Événements" value={String(data.summary.events)} tone={colors.alert} />
      </View>

      {data.history_source === "latest_available" && (
        <View style={styles.historyNotice}>
          <Ionicons name="time-outline" size={18} color={colors.info} />
          <Text style={styles.historyNoticeText}>
            Dernier historique disponible affiché, aucune métrique récente ne correspond à la période sélectionnée.
          </Text>
        </View>
      )}

      <View style={styles.resourceGrid}>
        {metricDefinitions.map((metric) => (
          <DenseResourceChart
            key={metric.key}
            title={metric.label}
            unit={metric.unit}
            color={metric.color}
            max={metric.max}
            values={data.points.map((point) => ({
              label: pointLabel(point),
              value: dashboardPointValue(point, metric.key),
            }))}
          />
        ))}
      </View>

      <DashboardEvents events={data.events} />
    </View>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={[styles.kpiValue, { color: tone }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone = colors.primary,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  tone?: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <Ionicons name={icon} size={20} color={tone} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function MetricBarChart({
  title,
  values,
  color,
  unit,
  max,
  compact = false,
}: {
  title: string;
  values: { label: string; value: number | null }[];
  color: string;
  unit: string;
  max?: number;
  compact?: boolean;
}) {
  const numericValues = values.map((item) => item.value).filter((value): value is number => value !== null);
  const scaleMax = max ?? Math.max(1, ...numericValues);
  const visibleValues = compact ? values.slice(-24) : values.slice(0, 12);

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Text style={styles.chartMeta}>{numericValues.length} points</Text>
      </View>

      <View style={styles.bars}>
        {visibleValues.map((item, index) => {
          const height = item.value === null ? 4 : Math.max(6, Math.min(100, (item.value / scaleMax) * 100));
          return (
            <View key={`${item.label}-${index}`} style={styles.barItem}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${height}%`, backgroundColor: item.value === null ? colors.border : color }]} />
              </View>
              {!compact && (
                <Text style={styles.barLabel} numberOfLines={1}>
                  {item.label}
                </Text>
              )}
              <Text style={styles.barValue} numberOfLines={1}>
                {formatMetric(item.value, unit)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function DenseResourceChart({
  title,
  values,
  color,
  unit,
  max,
}: {
  title: string;
  values: { label: string; value: number | null }[];
  color: string;
  unit: string;
  max?: number;
}) {
  const numericValues = values.map((item) => item.value).filter((value): value is number => value !== null);
  const latest = numericValues[numericValues.length - 1] ?? null;
  const scaleMax = max ?? Math.max(1, ...numericValues);
  const visibleValues = values.slice(-32);

  return (
    <View style={styles.resourceCard}>
      <View style={styles.resourceHeader}>
        <View>
          <Text style={styles.resourceTitle}>{title}</Text>
          <Text style={styles.resourceSub}>{numericValues.length} points</Text>
        </View>
        <Text style={[styles.resourceValue, { color }]}>{formatMetric(latest, unit)}</Text>
      </View>
      <View style={styles.sparkline}>
        {visibleValues.map((item, index) => {
          const height = item.value === null ? 3 : Math.max(5, Math.min(82, (item.value / scaleMax) * 82));
          return <View key={`${item.label}-${index}`} style={[styles.sparkBar, { height, backgroundColor: item.value === null ? colors.border : color }]} />;
        })}
      </View>
    </View>
  );
}

function numberValue(value: ServerLatestMetrics[keyof ServerLatestMetrics]) {
  return typeof value === "number" ? value : null;
}

function dashboardPointValue(point: DashboardPoint, key: MetricKey) {
  const value = point[key];
  return typeof value === "number" ? value : null;
}

function formatMetric(value: number | null, unit: string) {
  if (value === null) return "--";
  if (unit === "%") return `${value.toFixed(0)}%`;
  return value.toFixed(2);
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function pointLabel(point: DashboardPoint) {
  return `${point.server} ${timeLabel(point.collected_at)}`;
}

function DashboardEvents({ events }: { events: DashboardEvent[] }) {
  return (
    <View style={styles.eventsCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Événements filtrés</Text>
        <Text style={styles.chartMeta}>{events.length} événements</Text>
      </View>

      {events.length === 0 ? (
        <Text style={styles.stateText}>Aucun événement ne correspond aux filtres.</Text>
      ) : (
        <View style={styles.eventsList}>
          {events.slice(0, 12).map((event, index) => (
            <View key={`${event.server_id}-${event.collected_at}-${index}`} style={styles.eventRow}>
              <View style={[styles.eventDot, severityStyle(event.severity)]} />
              <View style={styles.eventContent}>
                <Text style={styles.eventTitle} numberOfLines={1}>
                  {event.server} - {event.type}
                </Text>
                <Text style={styles.eventMessage}>{event.message}</Text>
                <Text style={styles.eventTime}>{new Date(event.collected_at).toLocaleString("fr-FR")}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function severityStyle(severity: string) {
  if (severity === "critical") return { backgroundColor: colors.danger };
  if (severity === "warning") return { backgroundColor: colors.warning };
  return { backgroundColor: colors.info };
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.lg,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryCard: {
    minWidth: 150,
    flex: 1,
    gap: spacing.xs,
    borderRadius: radii.medium,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.h3,
  },
  summaryLabel: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
  },
  chartGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  monitorBoard: {
    gap: spacing.md,
  },
  kpiStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    borderRadius: radii.medium,
    padding: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpi: {
    minWidth: 116,
    flex: 1,
    padding: spacing.sm,
    borderRadius: radii.small,
    backgroundColor: colors.surface,
  },
  kpiValue: {
    fontFamily: fonts.bold,
    fontSize: typography.h3,
  },
  kpiLabel: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: typography.caption,
    textTransform: "uppercase",
  },
  resourceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  historyNotice: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.medium,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyNoticeText: {
    flex: 1,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
  },
  resourceCard: {
    flex: 1,
    minWidth: 230,
    gap: spacing.md,
    borderRadius: radii.medium,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resourceHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  resourceTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.bodyLarge,
  },
  resourceSub: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
  },
  resourceValue: {
    fontFamily: fonts.bold,
    fontSize: typography.h3,
  },
  sparkline: {
    height: 86,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  sparkBar: {
    flex: 1,
    minWidth: 3,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  chartCard: {
    minWidth: 280,
    flex: 1,
    gap: spacing.md,
    borderRadius: radii.medium,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  chartTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.bodyLarge,
  },
  chartMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
  },
  bars: {
    minHeight: 180,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  barItem: {
    flex: 1,
    minWidth: 18,
    alignItems: "center",
    gap: spacing.xs,
  },
  barTrack: {
    width: "100%",
    height: 120,
    justifyContent: "flex-end",
    overflow: "hidden",
    borderRadius: radii.small,
    backgroundColor: colors.surface,
  },
  barFill: {
    width: "100%",
    borderTopLeftRadius: radii.small,
    borderTopRightRadius: radii.small,
  },
  barLabel: {
    maxWidth: 80,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
  },
  barValue: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.caption,
  },
  stateCard: {
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
  stateTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.h3,
    textAlign: "center",
  },
  stateText: {
    maxWidth: 560,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    textAlign: "center",
  },
  eventsCard: {
    gap: spacing.md,
    borderRadius: radii.medium,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventsList: {
    gap: spacing.sm,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.small,
    padding: spacing.sm,
    backgroundColor: colors.surface,
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
  eventTitle: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  eventMessage: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
  },
  eventTime: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
  },
});
