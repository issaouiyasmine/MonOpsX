export const colors = {
  background: "#081220",
  sidebar: "#081220",
  surface: "#1E293B",
  card: "#111F33",
  primary: "#0EA5FF",
  primaryDark: "#2563EB",
  text: "#FFFFFF",
  muted: "#64748B",
  border: "#263B55",
  input: "#0B1728",
  success: "#22C55E",
  alert: "#FACC15",
  warning: "#F97316",
  danger: "#EF4444",
  info: "#8B5CF6",
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(2, 8, 23, 0.76)",
} as const;

export const typography = { h1: 32, h2: 24, h3: 20, bodyLarge: 16, body: 14, caption: 12 } as const;

export const fonts = {
  regular: "Roboto_400Regular",
  medium: "Roboto_500Medium",
  semiBold: "Roboto_500Medium",
  bold: "Roboto_700Bold",
} as const;

export const radii = { small: 4, medium: 8, large: 12, xlarge: 16, round: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 40 } as const;
