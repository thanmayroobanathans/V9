// Web APIs the shared code expects, provided natively.
import * as Crypto from 'expo-crypto'

const g = globalThis as unknown as { crypto?: { getRandomValues?: <T extends ArrayBufferView>(a: T) => T; randomUUID?: () => string } }
g.crypto ??= {}
g.crypto.getRandomValues ??= (<T extends ArrayBufferView>(a: T) => Crypto.getRandomValues(a as unknown as Uint8Array) as unknown as T)
g.crypto.randomUUID ??= () => Crypto.randomUUID()
