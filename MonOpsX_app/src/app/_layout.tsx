import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
  useFonts,
} from "@expo-google-fonts/roboto";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/providers/auth-provider";
import { ToastProvider } from "@/providers/toast-provider";
import { ProfileProvider } from "@/providers/profile-provider";

export default function Layout() {
  const [fontsLoaded] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <ProfileProvider><StatusBar style="light" /><Stack screenOptions={{ headerShown: false }} /></ProfileProvider>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
