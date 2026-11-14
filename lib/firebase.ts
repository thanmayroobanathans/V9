'use client'

import { initializeApp, getApps, getApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, GoogleAuthProvider, setPersistence, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth'
import { getFirestore, initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDQQMTFQ8W0mj0jGdvdeVxIB8kgc419OaU',
  authDomain: 'vit-pulse.firebaseapp.com',
  projectId: 'vit-pulse',
  storageBucket: 'vit-pulse.firebasestorage.app',
  messagingSenderId: '208680450066',
  appId: '1:208680450066:web:06fcae6d6431a799af40cb',
  measurementId: 'G-32DR3BLRTE',
}

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean)
const app = firebaseConfigured ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null
export const auth = app ? getAuth(app) : null
// Offline cache: messages and swipes made without signal are queued and synced on reconnect,
// and reopening the app shows chats instantly from the local cache.
function makeDb(): Firestore | null {
  if (!app) return null
  try {
    return initializeFirestore(app, { localCache: typeof window !== 'undefined' ? persistentLocalCache({ tabManager: persistentMultipleTabManager() }) : memoryLocalCache() })
  } catch { return getFirestore(app) } // already initialised (hot reload)
}
export const db = makeDb()
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function signInWithGoogle() {
  if (!auth) throw new Error('Firebase Authentication is unavailable. Check the Firebase project configuration.')
  await setPersistence(auth, browserLocalPersistence)
  return signInWithPopup(auth, googleProvider)
}
export async function signOut() { if (auth) await firebaseSignOut(auth) }
