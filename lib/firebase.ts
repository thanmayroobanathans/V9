'use client'

import { initializeApp, getApps, getApp } from 'firebase/app'
import { browserLocalPersistence, browserPopupRedirectResolver, getAdditionalUserInfo, getAuth, GoogleAuthProvider, initializeAuth, type Auth, setPersistence, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth'
import { ALLOWED_DOMAIN, emailOf, isAllowedEmail } from './config'
import { getFirestore, initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager, persistentSingleTabManager, type Firestore } from 'firebase/firestore'
import { Capacitor } from '@capacitor/core'

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
// Keep the login in localStorage, not IndexedDB. In the Android app, opening Chrome for Google
// sign-in pauses the app and closes its IndexedDB ("Database is closing/hidden"); localStorage
// stays available, so the sign-in can be saved when the app comes back.
function makeAuth(): Auth | null {
  if (!app) return null
  if (typeof window === 'undefined') return getAuth(app)
  try { return initializeAuth(app, { persistence: browserLocalPersistence, popupRedirectResolver: browserPopupRedirectResolver }) }
  catch { return getAuth(app) } // already initialised (hot reload)
}
export const auth = makeAuth()
// Offline cache: messages and swipes made without signal are queued and synced on reconnect,
// and reopening the app shows chats instantly from the local cache.
function makeDb(): Firestore | null {
  if (!app) return null
  try {
    if (typeof window === 'undefined') return initializeFirestore(app, { localCache: memoryLocalCache() })
    // The Android app has a single "tab" that is paused in the background; the multi-tab manager's
    // visibility-based leases don't suit it.
    const tabManager = Capacitor.isNativePlatform() ? persistentSingleTabManager({ forceOwnership: true }) : persistentMultipleTabManager()
    return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager }) })
  } catch { return getFirestore(app) } // already initialised (hot reload)
}
export const db = makeDb()
export const googleProvider = new GoogleAuthProvider()
// `hd` asks Google to show only VIT student accounts; the email is checked again after sign-in
// and enforced server-side in firestore.rules.
googleProvider.setCustomParameters({ prompt: 'select_account', hd: ALLOWED_DOMAIN })

export async function signInWithGoogle() {
  if (!auth) throw new Error('Firebase Authentication is unavailable. Check the Firebase project configuration.')
  await setPersistence(auth, browserLocalPersistence)
  const cred = await signInWithPopup(auth, googleProvider)
  // Google's profile always carries the email, even when user.email is empty.
  const profileEmail = (getAdditionalUserInfo(cred)?.profile as { email?: string } | undefined)?.email ?? null
  const email = emailOf(cred.user) || profileEmail
  if (!isAllowedEmail(email)) {
    await firebaseSignOut(auth)
    throw Object.assign(new Error(`Use your @${ALLOWED_DOMAIN} account`), { code: 'auth/domain', email })
  }
  return cred
}
export async function signOut() { if (auth) await firebaseSignOut(auth) }
