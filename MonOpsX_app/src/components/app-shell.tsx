import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, usePathname } from "expo-router";
import { useEffect, useState, type PropsWithChildren } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Permissions } from "@/constants/permissions";
import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";
import { useProfile } from "@/providers/profile-provider";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const items: { label: string; path: string; icon: IconName; permissions?: number[] }[] = [
  { label: "Dashboard", path: "/(main)/home", icon: "grid-outline" },
  { label: "Serveurs", path: "/(main)/servers", icon: "server-outline" },
  { label: "Administration", path: "/(main)/administrations", icon: "people-outline", permissions: [Permissions.USERS_ACCESS, Permissions.ROLES_ACCESS] },
  { label: "Paramètres", path: "/(main)/settings", icon: "settings-outline" },
];

function Sidebar({ close }: { close?: () => void }) {
  const pathname = usePathname();
  const { session, logout } = useAuth();
  const { clear } = useProfile();
  const visible = items.filter((item) => !item.permissions || item.permissions.some((p) => session?.permissions.includes(p)));
  return <View style={styles.sidebar}>
    <View style={styles.brand}><Image source={require("@/assets/images/logo-monopsx.png")} style={styles.logo} contentFit="contain" /><View><Text style={styles.brandName}>MONOPS<Text style={styles.brandX}>X</Text></Text><Text style={styles.brandCaption}>SERVER MONITORING</Text></View></View>
    <View style={styles.nav}>{visible.map((item) => { const active = pathname.startsWith(item.path.replace("/(main)", "")); return <Pressable key={item.path} onPress={() => { router.push(item.path as never); close?.(); }} style={[styles.navItem, active && styles.navActive]}><Ionicons name={item.icon} size={21} color={active ? colors.primary : colors.muted} /><Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text></Pressable>; })}</View>
    <Pressable style={styles.navItem} onPress={async () => { await logout(); clear(); router.replace("/(auth)/login"); }}><Ionicons name="log-out-outline" size={21} color={colors.muted} /><Text style={styles.navText}>Déconnexion</Text></Pressable>
  </View>;
}

export function AppShell({ title, children }: PropsWithChildren<{ title: string }>) {
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const [open, setOpen] = useState(false);
  const { profile, loading, load } = useProfile();
  useEffect(() => { if (!profile) load().catch(() => undefined); }, [profile, load]);
  const initials = profile ? `${profile.user.first_name[0] ?? ""}${profile.user.last_name[0] ?? ""}`.toUpperCase() : "MX";
  return <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
    <View style={styles.layout}>{!compact && <Sidebar />}
      <View style={styles.main}>
        <View style={styles.header}>{compact && <Pressable onPress={() => setOpen(true)} style={styles.iconButton}><Ionicons name="menu" size={24} color={colors.text} /></Pressable>}<Text style={styles.pageTitle}>{title}</Text><Pressable style={styles.account} onPress={() => router.push("/(main)/profile" as never)}><View style={styles.accountText}>{loading ? <ActivityIndicator color={colors.primary} size="small" /> : <><Text numberOfLines={1} style={styles.accountName}>{profile?.account.name ?? "MonOpsX"}</Text><Text numberOfLines={1} style={styles.accountEmail}>{profile?.user.email ?? "Profil"}</Text></>}</View><View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View></Pressable></View>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>{children}</ScrollView>
      </View>
    </View>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><Pressable style={styles.overlay} onPress={() => setOpen(false)}><Pressable style={styles.drawer} onPress={(e) => e.stopPropagation()}><Sidebar close={() => setOpen(false)} /></Pressable></Pressable></Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},layout:{flex:1,flexDirection:"row"},sidebar:{width:258,flex:1,backgroundColor:colors.sidebar,borderRightWidth:1,borderRightColor:colors.border,padding:spacing.md},brand:{height:82,flexDirection:"row",alignItems:"center",gap:10,borderBottomWidth:1,borderBottomColor:colors.border,marginBottom:spacing.lg},logo:{width:48,height:48},brandName:{color:colors.text,fontFamily:fonts.bold,fontSize:20,letterSpacing:1},brandX:{color:colors.primary},brandCaption:{color:colors.muted,fontFamily:fonts.medium,fontSize:9,letterSpacing:1.3},nav:{flex:1,gap:spacing.sm},navItem:{minHeight:48,flexDirection:"row",alignItems:"center",gap:12,borderRadius:radii.medium,paddingHorizontal:14},navActive:{backgroundColor:"rgba(14,165,255,0.13)",borderWidth:1,borderColor:"rgba(14,165,255,0.3)"},navText:{color:colors.muted,fontFamily:fonts.medium,fontSize:typography.body},navTextActive:{color:colors.primary},main:{flex:1},header:{height:78,flexDirection:"row",alignItems:"center",gap:12,justifyContent:"space-between",paddingHorizontal:spacing.lg,backgroundColor:colors.sidebar,borderBottomWidth:1,borderBottomColor:colors.border},pageTitle:{flex:1,color:colors.text,fontFamily:fonts.bold,fontSize:typography.h2},iconButton:{width:42,height:42,borderRadius:radii.medium,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:colors.border},account:{flexDirection:"row",alignItems:"center",gap:10,maxWidth:260},accountText:{alignItems:"flex-end",maxWidth:180},accountName:{color:colors.text,fontFamily:fonts.medium,fontSize:typography.body},accountEmail:{color:colors.muted,fontFamily:fonts.regular,fontSize:typography.caption},avatar:{width:42,height:42,borderRadius:21,alignItems:"center",justifyContent:"center",backgroundColor:colors.primaryDark,borderWidth:1,borderColor:colors.primary},avatarText:{color:colors.text,fontFamily:fonts.bold,fontSize:typography.body},content:{flex:1},contentInner:{padding:spacing.lg,flexGrow:1},overlay:{flex:1,backgroundColor:colors.overlay},drawer:{width:280,maxWidth:"84%",height:"100%"},
});
