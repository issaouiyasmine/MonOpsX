import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, typography } from "@/constants/theme";

type ToastType = "success" | "warning" | "error";

interface ToastValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setToast({ message, type });
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();

      timeoutRef.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, 3200);
    },
    [opacity],
  );

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const toastColor = toast?.type === "error"
    ? colors.danger
    : toast?.type === "warning"
      ? colors.warning
      : colors.success;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <Animated.View
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            { top: insets.top + 12, backgroundColor: toastColor, borderColor: toastColor, opacity },
          ]}
        >
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    zIndex: 999998,
    elevation: 999998,
    left: 20,
    right: 20,
    alignSelf: "center",
    maxWidth: 560,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12
  },
  toastText: {
    color: colors.white,
    fontFamily: fonts.medium,
    fontSize: typography.body,
    textAlign: "center",
  },
});
