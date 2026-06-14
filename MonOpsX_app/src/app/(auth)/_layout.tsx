import { Redirect, Stack } from "expo-router";

import { AppLoading } from "@/components/app-loading";
import { useAuth } from "@/providers/auth-provider";

export default function AuthLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) return <AppLoading />;
  if (session) return <Redirect href="/(main)/home" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
