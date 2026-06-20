import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

import { colors, radii } from "@/constants/theme";

interface GrafanaDashboardFrameProps {
  url: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function GrafanaDashboardFrame({ url, onLoad, onError }: GrafanaDashboardFrameProps) {
  return (
    <WebView
      source={{ uri: url }}
      style={styles.frame}
      containerStyle={styles.container}
      onLoadEnd={onLoad}
      onError={onError}
      startInLoadingState
      javaScriptEnabled
      domStorageEnabled
    />
  );
}

const styles = StyleSheet.create({
  container: {
    height: 720,
    overflow: "hidden",
    borderRadius: radii.medium,
    backgroundColor: colors.background,
  },
  frame: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
