import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { AuthSession } from "@/models/auth.model";

const SESSION_KEY = "monopsx.auth.session";

function getWebStorage(): Storage | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  return window.localStorage;
}

async function readSession(): Promise<string | null> {
  const webStorage = getWebStorage();
  if (Platform.OS === "web") return webStorage?.getItem(SESSION_KEY) ?? null;

  return SecureStore.getItemAsync(SESSION_KEY);
}

async function writeSession(value: string): Promise<void> {
  const webStorage = getWebStorage();
  if (Platform.OS === "web") {
    webStorage?.setItem(SESSION_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(SESSION_KEY, value);
}

async function removeSession(): Promise<void> {
  const webStorage = getWebStorage();
  if (Platform.OS === "web") {
    webStorage?.removeItem(SESSION_KEY);
    return;
  }

  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch (error) {
    const isMissingNativeDelete =
      error instanceof TypeError &&
      error.message.includes("deleteValueWithKeyAsync is not a function");

    if (!isMissingNativeDelete) throw error;

    // Some Expo Go builds expose SecureStore read/write but not the SDK 56
    // native delete method. An empty value is treated as no session by get().
    await writeSession("");
  }
}

export const SessionStorageService = {
  async get(): Promise<AuthSession | null> {
    const value = await readSession();
    if (!value) return null;

    try {
      return JSON.parse(value) as AuthSession;
    } catch {
      await removeSession();
      return null;
    }
  },

  save(session: AuthSession) {
    return writeSession(JSON.stringify(session));
  },

  clear() {
    return removeSession();
  },
};
