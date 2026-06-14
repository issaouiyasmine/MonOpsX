import { Redirect } from "expo-router";

import { AppLoading } from "@/components/app-loading";
import { useAuth } from "@/providers/auth-provider";

export default function Index() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <AppLoading />;
  }

  return <Redirect href={session ? "/(main)/home" : "/(auth)/login"} />;
}
