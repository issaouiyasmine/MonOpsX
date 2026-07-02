import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { AppShell } from "@/components/app-shell";
import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
import type { NotificationItem } from "@/models/notification.model";
import { useAuth } from "@/providers/auth-provider";
import { useNotifications } from "@/providers/notification-provider";
import { canAccessNotifications, canUpdateNotifications } from "@/utils/permissions";

export default function NotificationsPage() {
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const {
    notifications,
    loading,
    load,
    markRead,
    markAllRead,
    deleteNotification,
    deleteAll,
  } = useNotifications();
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const canAccess = canAccessNotifications(session);
  const canUpdate = canUpdateNotifications(session);
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  async function handleMarkAllRead() {
    setSavingAction(true);
    try {
      await markAllRead();
    } finally {
      setSavingAction(false);
    }
  }

  async function handleDeleteAll() {
    setSavingAction(true);
    try {
      await deleteAll();
      setDeleteAllOpen(false);
    } finally {
      setSavingAction(false);
    }
  }

  async function openNotification(item: NotificationItem) {
    if (canUpdate && !item.is_read) {
      await markRead(item.id).catch(() => undefined);
    }

    router.push({
      pathname: "/(main)/servers/details",
      params: {
        serverId: item.server_id,
        serverName: item.server_name ?? item.server_id,
      },
    } as never);
  }

  if (!canAccess) return <Redirect href="/(main)/home" />;

  return (
    <AppShell title="Notifications">
      <View style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.heading}>Notifications</Text>
            <Text style={styles.subheading}>
              {unreadCount > 0 ? `${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}` : "Toutes les notifications sont lues"}
            </Text>
          </View>

          {canUpdate && (
            <View style={styles.headerActions}>
              <Pressable
                disabled={savingAction || unreadCount === 0}
                style={[styles.secondaryButton, (savingAction || unreadCount === 0) && styles.disabled]}
                onPress={handleMarkAllRead}
              >
                <Ionicons name="checkmark-done-outline" size={18} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Tout marquer comme lu</Text>
              </Pressable>
              <Pressable
                disabled={savingAction || notifications.length === 0}
                style={[styles.dangerButton, (savingAction || notifications.length === 0) && styles.disabled]}
                onPress={() => setDeleteAllOpen(true)}
              >
                <Ionicons name="trash-outline" size={18} color={colors.text} />
                <Text style={styles.dangerButtonText}>Tout supprimer</Text>
              </Pressable>
            </View>
          )}
        </View>

        {loading && (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Chargement des notifications</Text>
          </View>
        )}

        {!loading && notifications.length === 0 && (
          <View style={styles.stateCard}>
            <Ionicons name="checkmark-circle-outline" size={32} color={colors.success} />
            <Text style={styles.stateText}>Aucune notification</Text>
          </View>
        )}

        {!loading && notifications.length > 0 && (
          <View style={styles.list}>
            {notifications.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                canUpdate={canUpdate}
                compact={compact}
                onOpen={() => openNotification(item)}
                onDelete={() => deleteNotification(item.id).catch(() => undefined)}
              />
            ))}
          </View>
        )}
      </View>

      <Modal visible={deleteAllOpen} transparent animationType="fade" onRequestClose={() => setDeleteAllOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Supprimer toutes les notifications</Text>
            <Text style={styles.confirmText}>
              Cette action supprimera toutes les notifications du compte courant.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setDeleteAllOpen(false)}>
                <Text style={styles.secondaryButtonText}>Annuler</Text>
              </Pressable>
              <Pressable disabled={savingAction} style={[styles.dangerButton, savingAction && styles.disabled]} onPress={handleDeleteAll}>
                <Text style={styles.dangerButtonText}>{savingAction ? "Suppression" : "Supprimer"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

function NotificationRow({
  item,
  canUpdate,
  compact,
  onOpen,
  onDelete,
}: {
  item: NotificationItem;
  canUpdate: boolean;
  compact: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const tone = severityColor(item.severity);

  return (
    <Pressable style={[styles.notificationRow, compact && styles.notificationRowCompact, !item.is_read && styles.notificationUnread]} onPress={onOpen}>
      <View style={[styles.notificationDot, { backgroundColor: tone }]} />
      <View style={styles.notificationBody}>
        <View style={[styles.notificationMeta, compact && styles.notificationMetaCompact]}>
          <Text numberOfLines={compact ? 2 : 1} style={styles.notificationType}>
            {labelForType(item.type)} - {labelForSeverity(item.severity)}
          </Text>
          <Text style={styles.notificationTime}>{formatFullDate(item.created_at)}</Text>
        </View>
        <Text numberOfLines={3} style={styles.notificationMessage}>{item.message}</Text>
        <Text numberOfLines={compact ? 2 : 1} style={styles.notificationServer}>{item.server_name ?? item.server_id}</Text>
        {compact && canUpdate ? (
          <View style={styles.notificationActionsCompact}>
            <Pressable
              accessibilityLabel="Supprimer"
              style={styles.deleteButton}
              onPress={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
        ) : null}
      </View>
      {canUpdate && !compact ? (
        <View style={styles.notificationActions}>
          <Pressable
            accessibilityLabel="Supprimer"
            style={styles.deleteButton}
            onPress={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

function severityColor(severity: string) {
  if (severity === "critical" || severity === "error") return colors.danger;
  if (severity === "warning") return colors.warning;
  if (severity === "info") return colors.info;
  return colors.primary;
}

function labelForType(type: string) {
  if (type === "threshold") return "Seuil";
  if (type === "prediction") return "Prediction";
  if (type === "crash") return "Crash";
  if (type === "deployment") return "Deploiement";
  if (type === "status") return "Statut";
  return "Info";
}

function labelForSeverity(severity: string) {
  if (severity === "critical") return "Critique";
  if (severity === "warning") return "Avertissement";
  if (severity === "error") return "Erreur";
  return "Info";
}

function formatFullDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    marginTop: spacing.xs,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: spacing.sm,
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
  dangerButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.medium,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.danger,
  },
  dangerButtonText: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  disabled: {
    opacity: 0.5,
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
  stateText: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: typography.body,
    textAlign: "center",
  },
  list: {
    gap: spacing.sm,
  },
  notificationRow: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
  },
  notificationRowCompact: {
    alignItems: "flex-start",
  },
  notificationUnread: {
    borderColor: "rgba(14,165,255,0.35)",
    backgroundColor: "rgba(14,165,255,0.08)",
  },
  notificationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  notificationBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  notificationMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  notificationMetaCompact: {
    alignItems: "flex-start",
  },
  notificationType: {
    flex: 1,
    minWidth: 160,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.body,
  },
  notificationTime: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  notificationMessage: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 20,
  },
  notificationServer: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  notificationActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  notificationActionsCompact: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: spacing.xs,
  },
  deleteButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
    backgroundColor: "rgba(239,68,68,0.1)",
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
});
