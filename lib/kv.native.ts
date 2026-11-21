import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Synchronous key-value store for the native app: an in-memory copy that is loaded from
 * AsyncStorage once at startup (hydrateKv) and written back in the background.
 */
const mem = new Map<string, string>()
const PREFIX = 'kv:'
export const kv = {
  get(key: string): string | null { return mem.get(key) ?? null },
  set(key: string, value: string) { mem.set(key, value); AsyncStorage.setItem(PREFIX + key, value).catch(() => {}) },
  remove(key: string) { mem.delete(key); AsyncStorage.removeItem(PREFIX + key).catch(() => {}) },
}
export async function hydrateKv() {
  const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(PREFIX))
  for (const [k, v] of await AsyncStorage.multiGet(keys)) if (v != null) mem.set(k.slice(PREFIX.length), v)
}
