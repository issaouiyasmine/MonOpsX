import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type React from "react";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { AppShell } from "@/components/app-shell";
import { Permissions } from "@/constants/permissions";
import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
import type { NotificationMetricSettings, NotificationSettings } from "@/models/settings.model";
import { useAuth } from "@/providers/auth-provider";
import { useProfile } from "@/providers/profile-provider";
import { useToast } from "@/providers/toast-provider";
import { ProfileService } from "@/services/profile.service";
import { SettingsService } from "@/services/settings.service";
import { getApiErrorMessage } from "@/utils/api-error";

const defaultNotificationSettings: NotificationSettings = {
  enabled: true,
  metrics: {
    cpu_percent: { threshold: 85, in_app_enabled: true, push_enabled: false },
    memory_percent: { threshold: 85, in_app_enabled: true, push_enabled: false },
    disk_percent: { threshold: 90, in_app_enabled: true, push_enabled: false },
  },
};

const notificationMetricRows: {
  key: keyof NotificationMetricSettings;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  { key: "cpu_percent", label: "CPU", icon: "hardware-chip-outline" },
  { key: "memory_percent", label: "RAM", icon: "server-outline" },
  { key: "disk_percent", label: "Disque", icon: "save-outline" },
];

export default function Settings() {
  const { session, logout } = useAuth();
  const { profile, load, clear } = useProfile();
  const { showToast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings>(defaultNotificationSettings);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canAccessSettings = Boolean(session?.permissions.includes(Permissions.SETTINGS_ACCESS));
  const canUpdateNotifications = Boolean(session?.permissions.includes(Permissions.NOTIFICATIONS_UPDATE));
  const canDeleteAccount = Boolean(
    profile?.user.is_principal && session?.permissions.includes(Permissions.ACCOUNT_DELETE)
  );

  useEffect(() => {
    if (!profile) load().catch(() => undefined);
  }, [profile, load]);

  useEffect(() => {
    let mounted = true;

    async function loadNotificationSettings() {
      if (!canAccessSettings) {
        setLoadingSettings(false);
        return;
      }

      setLoadingSettings(true);
      try {
        const data = await SettingsService.getNotificationSettings();
        if (mounted) setSettings(data);
      } catch (error) {
        if (mounted) showToast(getApiErrorMessage(error), "error");
      } finally {
        if (mounted) setLoadingSettings(false);
      }
    }

    loadNotificationSettings();
    return () => {
      mounted = false;
    };
  }, [canAccessSettings, showToast]);

  async function saveNotificationSettings(nextSettings: NotificationSettings) {
    if (!canUpdateNotifications) return;

    nextSettings = normalizeNotificationSettings(nextSettings);
    setSettings(nextSettings);
    setSavingSettings(true);
    try {
      setSettings(await SettingsService.updateNotificationSettings(nextSettings));
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
      SettingsService.getNotificationSettings()
        .then(setSettings)
        .catch(() => undefined);
    } finally {
      setSavingSettings(false);
    }
  }

  async function confirmDeleteAccount() {
    const password = deletePassword.trim();
    if (!password) {
      showToast("Le mot de passe est obligatoire.", "warning");
      return;
    }

    setDeleting(true);
    try {
      await ProfileService.deleteAccount({ password });
      clear();
      await logout();
      router.replace("/(auth)/login");
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell title="Parametres">
      <View style={styles.page}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Parametres des notifications</Text>
              <Text style={styles.sectionSubtitle}>Choisissez comment ce compte recoit les alertes.</Text>
            </View>
            {savingSettings && <ActivityIndicator color={colors.primary} />}
          </View>

          {!canAccessSettings && (
            <View style={styles.stateRow}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.warning} />
              <Text style={styles.stateText}>{"Vous n'avez pas la permission de consulter ces parametres."}</Text>
            </View>
          )}

          {canAccessSettings && loadingSettings && (
            <View style={styles.stateRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.stateText}>Chargement des parametres</Text>
            </View>
          )}

          {canAccessSettings && !loadingSettings && (
            <>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Desactiver toutes les notifications</Text>
                  <Text style={styles.settingDescription}>
                    {"Coupez cette option pour arreter toutes les notifications in-app et push."}
                  </Text>
                </View>
                <Switch
                  disabled={!canUpdateNotifications || savingSettings}
                  value={!settings.enabled}
                  onValueChange={(disabled) => saveNotificationSettings({ ...settings, enabled: !disabled })}
                  trackColor={{ false: colors.border, true: colors.primaryDark }}
                  thumbColor={!settings.enabled ? colors.primary : colors.muted}
                />
              </View>

              <View style={styles.settingBlock}>
                <Text style={styles.settingTitle}>Canaux par type</Text>
                <Text style={styles.settingDescription}>
                  {"Choisissez les canaux de notification pour chaque ressource."}
                </Text>
                {notificationMetricRows.map((row) => (
                  <MetricNotificationRow
                    key={row.key}
                    disabled={!canUpdateNotifications || savingSettings || !settings.enabled}
                    icon={row.icon}
                    label={row.label}
                    inAppEnabled={settings.metrics[row.key].in_app_enabled}
                    pushEnabled={settings.metrics[row.key].push_enabled}
                    onInAppChange={(in_app_enabled) => saveNotificationSettings({
                      ...settings,
                      metrics: {
                        ...settings.metrics,
                        [row.key]: {
                          ...settings.metrics[row.key],
                          in_app_enabled,
                        },
                      },
                    })}
                    onPushChange={(push_enabled) => saveNotificationSettings({
                      ...settings,
                      metrics: {
                        ...settings.metrics,
                        [row.key]: {
                          ...settings.metrics[row.key],
                          push_enabled,
                        },
                      },
                    })}
                  />
                ))}
                {!canUpdateNotifications && (
                  <Text style={styles.permissionHint}>{"Vous n'avez pas la permission de modifier les notifications."}</Text>
                )}
              </View>
            </>
          )}
        </View>

        <View style={[styles.section, styles.dangerSection]}>
          <View>
            <Text style={styles.sectionTitle}>Supprimer le compte</Text>
            <Text style={styles.sectionSubtitle}>
              {"Cette action supprime le compte, invalide toutes les sessions et renvoie les utilisateurs vers la connexion."}
            </Text>
          </View>

          {canDeleteAccount ? (
            <Pressable style={styles.deleteAccountButton} onPress={() => setDeleteOpen(true)}>
              <Ionicons name="trash-outline" size={20} color={colors.text} />
              <Text style={styles.deleteAccountText}>Supprimer le compte</Text>
            </Pressable>
          ) : (
            <View style={styles.stateRow}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.muted} />
              <Text style={styles.stateText}>{"Seul l'administrateur principal peut supprimer le compte."}</Text>
            </View>
          )}
        </View>
      </View>

      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Confirmer la suppression</Text>
            <Text style={styles.confirmText}>
              {"Entrez votre mot de passe pour supprimer definitivement ce compte."}
            </Text>
            <TextInput
              secureTextEntry
              style={styles.passwordInput}
              placeholder="Mot de passe"
              placeholderTextColor={colors.muted}
              value={deletePassword}
              onChangeText={setDeletePassword}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                disabled={deleting}
                onPress={() => {
                  setDeleteOpen(false);
                  setDeletePassword("");
                }}
              >
                <Text style={styles.secondaryButtonText}>Annuler</Text>
              </Pressable>
              <Pressable
                disabled={deleting}
                style={[styles.deleteAccountButton, deleting && styles.disabled]}
                onPress={confirmDeleteAccount}
              >
                <Text style={styles.deleteAccountText}>{deleting ? "Suppression" : "Supprimer"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

function MetricNotificationRow({
  disabled,
  icon,
  label,
  inAppEnabled,
  pushEnabled,
  onInAppChange,
  onPushChange,
}: {
  disabled: boolean;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  onInAppChange: (value: boolean) => void;
  onPushChange: (value: boolean) => void;
}) {
  return (
    <View style={[styles.metricNotificationRow, disabled && styles.disabled]}>
      <View style={styles.metricNotificationLabel}>
        <View style={styles.toggleLabel}>
          <Ionicons name={icon} size={20} color={colors.primary} />
          <Text style={styles.toggleText}>{label}</Text>
        </View>
      </View>

      <View style={styles.metricChannels}>
        <ChannelSwitch
          disabled={disabled}
          icon="albums-outline"
          label="In-app"
          value={inAppEnabled}
          onChange={onInAppChange}
        />
        <ChannelSwitch
          disabled={disabled}
          icon="phone-portrait-outline"
          label="Push"
          value={pushEnabled}
          onChange={onPushChange}
        />
      </View>
    </View>
  );
}

function ChannelSwitch({
  disabled,
  icon,
  label,
  value,
  onChange,
}: {
  disabled: boolean;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.channelSwitch}>
      <View style={styles.channelLabel}>
        <Ionicons name={icon} size={16} color={value ? colors.primary : colors.muted} />
        <Text style={styles.channelText}>{label}</Text>
      </View>
      <Switch
        disabled={disabled}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primaryDark }}
        thumbColor={value ? colors.primary : colors.muted}
      />
    </View>
  );
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(100, value));
}

function normalizeNotificationSettings(settings: NotificationSettings): NotificationSettings {
  return {
    ...settings,
    metrics: {
      cpu_percent: {
        ...settings.metrics.cpu_percent,
        threshold: clampPercent(settings.metrics.cpu_percent.threshold),
      },
      memory_percent: {
        ...settings.metrics.memory_percent,
        threshold: clampPercent(settings.metrics.memory_percent.threshold),
      },
      disk_percent: {
        ...settings.metrics.disk_percent,
        threshold: clampPercent(settings.metrics.disk_percent.threshold),
      },
    },
  };
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
    borderRadius: radii.medium,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dangerSection: {
    borderColor: "rgba(239,68,68,0.35)",
  },
  sectionHeader: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
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
    lineHeight: 21,
  },
  stateRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.medium,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  stateText: {
    flex: 1,
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  settingRow: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderRadius: radii.medium,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  settingText: {
    flex: 1,
    minWidth: 0,
  },
  settingBlock: {
    gap: spacing.sm,
    borderRadius: radii.medium,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  settingTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.bodyLarge,
  },
  settingDescription: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 20,
  },
  toggleLabel: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  toggleText: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  permissionHint: {
    color: colors.warning,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
  },
  metricNotificationRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.md,
    borderRadius: radii.medium,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricNotificationLabel: {
    flex: 1,
    minWidth: 140,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  metricChannels: {
    flex: 1,
    minWidth: 240,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  channelSwitch: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  channelLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  channelText: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.caption,
  },
  deleteAccountButton: {
    minHeight: 42,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.medium,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.danger,
  },
  deleteAccountText: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  disabled: {
    opacity: 0.5,
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
  passwordInput: {
    minHeight: 46,
    borderRadius: radii.medium,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  secondaryButton: {
    minHeight: 42,
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
});
