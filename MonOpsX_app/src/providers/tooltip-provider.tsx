import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii, spacing, typography } from "@/constants/theme";

interface TooltipValue {
  showTooltip: (label: string, frame: { x: number; y: number; width: number; height: number }) => void;
  hideTooltip: () => void;
}

const TooltipContext = createContext<TooltipValue | null>(null);

export function TooltipProvider({ children }: PropsWithChildren) {
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number; width: number; height: number } | null>(null);

  const showTooltip = useCallback((label: string, frame: { x: number; y: number; width: number; height: number }) => {
    setTooltip({ label, ...frame });
  }, []);
  const hideTooltip = useCallback(() => setTooltip(null), []);
  const value = useMemo(() => ({ showTooltip, hideTooltip }), [showTooltip, hideTooltip]);

  return (
    <TooltipContext.Provider value={value}>
      {children}
      {tooltip ? (
        <View pointerEvents="none" style={styles.host}>
          <View style={[styles.tooltip, { left: Math.max(8, tooltip.x + tooltip.width / 2 - 90), top: Math.max(8, tooltip.y - 42) }]}>
            <Text style={styles.tooltipText} numberOfLines={1}>
              {tooltip.label}
            </Text>
          </View>
        </View>
      ) : null}
    </TooltipContext.Provider>
  );
}

export function useTooltip() {
  const context = useContext(TooltipContext);
  if (!context) throw new Error("useTooltip must be used inside TooltipProvider");
  return context;
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 999999,
    elevation: 999999,
  },
  tooltip: {
    position: "absolute",
    width: 180,
    borderRadius: radii.small,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.black,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tooltipText: {
    color: colors.white,
    fontFamily: fonts.medium,
    fontSize: typography.caption,
    textAlign: "center",
  },
});
