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
import { TooltipProvider } from "@/providers/tooltip-provider";
import { NotificationProvider } from "@/providers/notification-provider";

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
        <TooltipProvider>
          <AuthProvider>
            <ProfileProvider>
              <NotificationProvider><StatusBar style="light" /><Stack screenOptions={{ headerShown: false }} /></NotificationProvider>
            </ProfileProvider>
          </AuthProvider>
        </TooltipProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
