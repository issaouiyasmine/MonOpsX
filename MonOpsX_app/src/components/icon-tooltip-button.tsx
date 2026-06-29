import { Ionicons } from "@expo/vector-icons";
import type React from "react";
import { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, radii } from "@/constants/theme";
import { useTooltip } from "@/providers/tooltip-provider";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface IconTooltipButtonProps {
  label: string;
  icon: IconName;
  onPress: () => void;
  color?: string;
  danger?: boolean;
  disabled?: boolean;
}

export function IconTooltipButton({
  label,
  icon,
  onPress,
  color = colors.primary,
  danger = false,
  disabled = false,
}: IconTooltipButtonProps) {
  const ref = useRef<View | null>(null);
  const { showTooltip, hideTooltip } = useTooltip();

  function handleHoverIn() {
    ref.current?.measureInWindow((x, y, width, height) => {
      showTooltip(label, { x, y, width, height });
    });
  }

  return (
    <View ref={ref} style={styles.wrap}>
      <Pressable
        accessibilityLabel={label}
        disabled={disabled}
        style={[styles.button, danger && styles.dangerButton, disabled && styles.disabled]}
        onHoverIn={handleHoverIn}
        onHoverOut={hideTooltip}
        onPress={onPress}
      >
        <Ionicons name={icon} size={20} color={danger ? colors.danger : color} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    zIndex: 50,
  },
  button: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dangerButton: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderColor: "rgba(239,68,68,0.35)",
  },
  disabled: {
    opacity: 0.5,
  },
});
