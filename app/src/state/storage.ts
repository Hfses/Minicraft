import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Tiny typed JSON persistence layer over AsyncStorage.
 * All feature stores (servers, friends, history) build on these helpers so
 * serialization and error handling live in one place.
 */

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is best-effort; never crash the UI over storage errors.
  }
}
