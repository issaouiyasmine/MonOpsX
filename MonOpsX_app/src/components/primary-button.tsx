import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { colors, fonts, typography } from "@/constants/theme";

interface PrimaryButtonProps {
  label: string;
  loading?: boolean;
  onPress: () => void;
}

export function PrimaryButton({ label, loading = false, onPress }: PrimaryButtonProps) {
  return (
    <Pressable
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && !loading ? styles.pressed : null,
        loading ? styles.disabled : null,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    marginTop: 4,
  },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.65 },
  label: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: typography.bodyLarge,
  },
});
