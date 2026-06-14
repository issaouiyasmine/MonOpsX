import type { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, fonts, typography } from "@/constants/theme";

interface AuthShellProps extends PropsWithChildren {
  title: string;
  subtitle: string;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}><Image source={require("@/assets/images/logo-monopsx.png")} style={styles.logoMark} contentFit="contain"/><View><Text style={styles.brand}>MONOPS<Text style={styles.brandX}>X</Text></Text><Text style={styles.brandCaption}>SERVER MONITORING</Text></View></View>

          <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  logoMark: { width: 54, height: 54 },
  brand: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 22,
    letterSpacing: 1,
  },
  brandX:{color:colors.primary},brandCaption:{color:colors.muted,fontFamily:fonts.medium,fontSize:9,letterSpacing:1.4},
  card: {
    width: "100%",
    maxWidth: 560,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 24,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.h2,
    marginBottom: 8,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 21,
    marginBottom: 24,
  },
});
