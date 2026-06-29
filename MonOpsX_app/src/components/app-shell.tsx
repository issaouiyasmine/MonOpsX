import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams, usePathname } from "expo-router";
import { useEffect, useState, type PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ChatWidget } from "@/components/chat-widget";
import { Permissions } from "@/constants/permissions";
import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";
import { useNotifications } from "@/providers/notification-provider";
import { useProfile } from "@/providers/profile-provider";
import { canAccessNotifications } from "@/utils/permissions";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
type SidebarVariant = "desktop" | "drawer";

const items: { label: string; path: string; icon: IconName; permissions?: number[] }[] = [
  { label: "Tableau de bord", path: "/(main)/home", icon: "grid-outline" },
  { label: "Serveurs", path: "/(main)/servers", icon: "server-outline" },
  { label: "Administration", path: "/(main)/administrations", icon: "people-outline", permissions: [Permissions.USERS_ACCESS, Permissions.ROLES_ACCESS] },
  { label: "Parametres", path: "/(main)/settings", icon: "settings-outline" },
];

function Sidebar({ close, variant = "desktop" }: { close?: () => void; variant?: SidebarVariant }) {
  const pathname = usePathname();
  const { session, logout } = useAuth();
  const { clear } = useProfile();
  const notifications = useNotifications();
  const visible = items.filter((item) => !item.permissions || item.permissions.some((p) => session?.permissions.includes(p)));
  const canViewNotifications = canAccessNotifications(session);

  return (
    <View style={[styles.sidebarBase, variant === "desktop" ? styles.sidebarDesktop : styles.sidebarDrawer]}>
      <View style={styles.brand}>
        <Image source={require("@/assets/images/logo-monopsx.png")} style={styles.logo} contentFit="contain" />
        <View style={styles.brandText}>
          <Text style={styles.brandName}>MONOPS<Text style={styles.brandX}>X</Text></Text>
          <Text style={styles.brandCaption}>SURVEILLANCE SERVEURS</Text>
        </View>
        {canViewNotifications && (
          <Pressable
            accessibilityLabel="Notifications"
            style={styles.sidebarBellButton}
            onPress={() => {
              router.push("/(main)/notifications" as never);
              close?.();
            }}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            {notifications.unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notifications.unreadCount > 9 ? "9+" : notifications.unreadCount}</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>

      <View style={styles.sidebarBody}>
        <View style={styles.nav}>
          {visible.map((item) => {
            const active = pathname.startsWith(item.path.replace("/(main)", ""));
            return (
              <Pressable
                key={item.path}
                onPress={() => {
                  router.push(item.path as never);
                  close?.();
                }}
                style={[styles.navItem, active && styles.navActive]}
              >
                <Ionicons name={item.icon} size={22} color={active ? colors.primary : colors.muted} />
                <Text numberOfLines={1} style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.logoutFooter}>
          <Pressable
            style={[styles.navItem, styles.logoutItem]}
            onPress={async () => {
              await logout();
              clear();
              router.replace("/(auth)/login");
            }}
          >
            <Ionicons name="log-out-outline" size={21} color={colors.muted} />
            <Text numberOfLines={1} style={styles.navText}>Deconnexion</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function AppShell({ title, children }: PropsWithChildren<{ title: string }>) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const compact = width < 1060;
  const veryCompact = width < 520;
  const drawerWidth = Math.min(width * 0.84, 280);
  const [open, setOpen] = useState(false);
  const { profile, loading, load } = useProfile();

  useEffect(() => {
    if (!profile) load().catch(() => undefined);
  }, [profile, load]);

  const initials = profile ? `${profile.user.first_name[0] ?? ""}${profile.user.last_name[0] ?? ""}`.toUpperCase() : "MX";
  const serverId = pathname.includes("/servers/details") ? paramValue(params.serverId) : undefined;
  const serverLabel = pathname.includes("/servers/details") ? paramValue(params.serverName) ?? paramValue(params.hostname) : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.layout}>
        {!compact && <Sidebar variant="desktop" />}

        <View style={styles.main}>
          <View style={styles.header}>
            {compact && (
              <Pressable accessibilityLabel="Menu" style={styles.headerIconButton} onPress={() => setOpen(true)}>
                <Ionicons name="menu" size={22} color={colors.text} />
              </Pressable>
            )}

            <Text numberOfLines={1} style={styles.pageTitle}>{title}</Text>

            <View style={styles.headerRight}>
              <Pressable style={styles.account} onPress={() => router.push("/(main)/profile" as never)}>
                {!veryCompact && (
                  <View style={styles.accountText}>
                    {loading ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <>
                        <Text numberOfLines={1} style={styles.accountName}>{profile?.account.name ?? "MonOpsX"}</Text>
                        <Text numberOfLines={1} style={styles.accountEmail}>{profile?.user.email ?? "Profil"}</Text>
                      </>
                    )}
                  </View>
                )}
                <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>{children}</ScrollView>
          <ChatWidget serverId={serverId} serverLabel={serverLabel} />
        </View>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={[styles.drawer, { width: drawerWidth }]} onPress={(event) => event.stopPropagation()}>
            <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerScrollContent}>
              <Sidebar variant="drawer" close={() => setOpen(false)} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  layout: { flex: 1, flexDirection: "row", minWidth: 0 },
  sidebarBase: {
    height: "100%",
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: "column",
    backgroundColor: colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    padding: spacing.md,
  },
  sidebarDesktop: {
    width: 254,
    flexBasis: 254,
  },
  sidebarDrawer: {
    width: "100%",
    minHeight: "100%",
  },
  brand: {
    height: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg,
  },
  brandText: { flex: 1, minWidth: 0, paddingRight: spacing.xs },
  logo: { width: 48, height: 48 },
  brandName: { color: colors.text, fontFamily: fonts.bold, fontSize: 20, letterSpacing: 1 },
  brandX: { color: colors.primary },
  brandCaption: { color: colors.muted, fontFamily: fonts.medium, fontSize: 9, letterSpacing: 1.3 },
  sidebarBellButton: {
    width: 36,
    height: 36,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sidebarBody: { flexGrow: 1 },
  nav: { flex: 1, gap: spacing.sm, paddingBottom: spacing.md },
  navItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radii.medium,
    paddingHorizontal: 14,
  },
  logoutFooter: {
    flexShrink: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  logoutItem: {
    marginTop: spacing.xs,
  },
  navActive: {
    backgroundColor: "rgba(14,165,255,0.13)",
    borderWidth: 1,
    borderColor: "rgba(14,165,255,0.3)",
  },
  navText: { flex: 1, color: colors.muted, fontFamily: fonts.medium, fontSize: typography.body },
  navTextActive: { color: colors.primary },
  main: { flex: 1, minWidth: 0 },
  header: {
    height: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.sidebar,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 20,
  },
  pageTitle: { flex: 1, minWidth: 0, color: colors.text, fontFamily: fonts.bold, fontSize: typography.h2 },
  headerRight: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: radii.medium,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  badge: {
    position: "absolute",
    right: -4,
    top: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.sidebar,
  },
  badgeText: { color: colors.text, fontFamily: fonts.bold, fontSize: 10 },
  account: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 10, maxWidth: 260 },
  accountText: { alignItems: "flex-end", maxWidth: 180 },
  accountName: { color: colors.text, fontFamily: fonts.medium, fontSize: typography.body },
  accountEmail: { color: colors.muted, fontFamily: fonts.regular, fontSize: typography.caption },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDark,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  avatarText: { color: colors.text, fontFamily: fonts.bold, fontSize: typography.body },
  content: { flex: 1, minWidth: 0 },
  contentInner: { padding: spacing.md, flexGrow: 1 },
  overlay: { flex: 1, alignItems: "flex-start", backgroundColor: colors.overlay },
  drawer: {
    height: "100%",
    maxWidth: 280,
    backgroundColor: colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    overflow: "hidden",
  },
  drawerScroll: { flex: 1 },
  drawerScrollContent: { minHeight: "100%" },
});
