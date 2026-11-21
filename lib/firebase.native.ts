/**
 * Firebase for the native (React Native) app. Same project and exports as lib/firebase.ts, so all
 * shared code (lib/social.ts, lib/plans.ts, …) works unchanged.
 *
 * Google sign-in: Google blocks sign-in inside embedded web views, so we open a Chrome tab on
 * our site's /auth.html bridge, which hands the Google credential back via vitpulse://auth.
 */
import { initializeApp, getApps, getApp } from 'firebase/app'
// @ts-expect-error — getReactNativePersistence is exported from the React Native build of firebase/auth
import { getReactNativePersistence } from 'firebase/auth'
import { GoogleAuthProvider, getAuth, initializeAuth, signInWithCredential, signOut as firebaseSignOut, type Auth } from 'firebase/auth'
import { initializeFirestore, getFirestore, memoryLocalCache, type Firestore } from 'firebase/firestore'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as WebBrowser from 'expo-web-browser'
import * as Crypto from 'expo-crypto'
import { emailOf, isAllowedEmail, ALLOWED_DOMAIN } from './config'

const firebaseConfig = {
  apiKey: 'AIzaSyDQQMTFQ8W0mj0jGdvdeVxIB8kgc419OaU',
  authDomain: 'vit-pulse.firebaseapp.com',
  projectId: 'vit-pulse',
  storageBucket: 'vit-pulse.firebasestorage.app',
  messagingSenderId: '208680450066',
  appId: '1:208680450066:web:06fcae6d6431a799af40cb',
  measurementId: 'G-32DR3BLRTE',
}
export const SITE = 'https://thanmayroobanathans.github.io/V9'

export const firebaseConfigured = true
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

function makeAuth(): Auth {
  try { return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) }) }
  catch { return getAuth(app) }
}
export const auth: Auth | null = makeAuth()

function makeDb(): Firestore {
  // Long polling is the reliable transport for Firestore on React Native.
  try { return initializeFirestore(app, { localCache: memoryLocalCache(), experimentalForceLongPolling: true }) }
  catch { return getFirestore(app) }
}
export const db: Firestore | null = makeDb()
export const googleProvider = new GoogleAuthProvider()

const fail = (code: string, message: string) => Object.assign(new Error(message), { code })

export async function signInWithGoogle() {
  if (!auth) throw new Error('Firebase Authentication is unavailable')
  const state = Crypto.randomUUID().replace(/-/g, '')
  const res = await WebBrowser.openAuthSessionAsync(`${SITE}/auth.html?state=${state}`, 'vitpulse://auth', { toolbarColor: '#000000', showTitle: false })
  if (res.type !== 'success') throw fail('auth/popup-closed-by-user', 'Sign-in cancelled')
  const q = new URL(res.url.replace('vitpulse://auth', 'https://x/auth')).searchParams
  if (q.get('state') !== state) throw fail('app/state', 'Sign-in was interrupted. Please try again.')
  if (q.get('error')) throw fail(q.get('code') ?? 'app/web', q.get('error')!)
  const idToken = q.get('id_token') || null, accessToken = q.get('access_token') || null
  if (!idToken && !accessToken) throw fail('app/token', 'Google did not return a sign-in token')
  const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, accessToken))
  if (!isAllowedEmail(emailOf(cred.user))) {
    await firebaseSignOut(auth)
    throw Object.assign(new Error(`Use your @${ALLOWED_DOMAIN} account`), { code: 'auth/domain', email: emailOf(cred.user) })
  }
  return cred
}
export async function signOut() { if (auth) await firebaseSignOut(auth) }
