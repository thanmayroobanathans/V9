/** Tiny synchronous key-value store. Web: localStorage. (Native: see kv.native.ts.) */
export const kv = {
  get(key: string): string | null { try { return localStorage.getItem(key) } catch { return null } },
  set(key: string, value: string) { try { localStorage.setItem(key, value) } catch { /* full or blocked */ } },
  remove(key: string) { try { localStorage.removeItem(key) } catch { /* ignore */ } },
}
export async function hydrateKv() { /* web storage is already available */ }
