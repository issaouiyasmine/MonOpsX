import { StyleSheet, View } from "react-native";

import { colors, radii } from "@/constants/theme";

interface GrafanaDashboardFrameProps {
  url: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function GrafanaDashboardFrame({ url, onLoad, onError }: GrafanaDashboardFrameProps) {
  return (
    <View style={styles.frameShell}>
      {createIframe(url, onLoad, onError)}
    </View>
  );
}

function createIframe(url: string, onLoad?: () => void, onError?: () => void) {
  return (
    <iframe
      src={url}
      title="Grafana dashboard"
      onLoad={onLoad}
      onError={onError}
      allowFullScreen
      style={{
        width: "100%",
        height: "100%",
        border: 0,
        display: "block",
        backgroundColor: colors.background,
      }}
    />
  );
}

const styles = StyleSheet.create({
  frameShell: {
    height: 720,
    overflow: "hidden",
    borderRadius: radii.medium,
    backgroundColor: colors.background,
  },
});
