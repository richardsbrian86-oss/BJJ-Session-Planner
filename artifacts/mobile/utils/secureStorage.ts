import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

async function rawGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function rawSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function rawDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function secureGet(key: string): Promise<string | null> {
  try {
    const raw = await rawGet(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as string;
    } catch {
      return raw;
    }
  } catch {
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  await rawSet(key, JSON.stringify(value));
}

export async function secureDelete(key: string): Promise<void> {
  try {
    await rawDelete(key);
  } catch {
  }
}
