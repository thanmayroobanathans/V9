'use client'

/**
 * Android app integration (Capacitor). Everything here is a no-op on the website.
 *
 * Google sign-in: Google blocks its login page inside app WebViews, so — like most apps — we open
 * a secure Chrome tab on our own site (`/auth.html`), sign in there, and Chrome hands the Google
 * credential back to the app through the `vitpulse://auth` link. The app then signs in to Firebase
 * with that credential. No extra Firebase/Android setup is needed.
 *
 * Plugins are imported statically (not lazily) so they are always part of the bundle.
 */
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { GoogleAuthProvider, setPersistence, browserLocalPersistence, signInWithCredential, type Auth } from 'firebase/auth'

export const SITE = 'https://thanmayroobanathans.github.io/V9'
export const isNative = () => typeof window !== 'undefined' && Capacitor.isNativePlatform()

let backHandler: (() => boolean) | null = null
/** The page registers what "back" means right now (close a page, leave a chat, …). */
export function setBackHandler(fn: (() => boolean) | null) { backHandler = fn }

let started = false
export async function initNative() {
  if (!isNative() || started) return
  started = true
  document.documentElement.classList.add('native')
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  StatusBar.setBackgroundColor({ color: '#000000' }).catch(() => {})
  SplashScreen.hide().catch(() => {})
  App.addListener('backButton', () => { if (!backHandler?.()) App.minimizeApp() }).catch(() => {})
}

/** Small vibration for swipes, likes and matches. */
export async function haptic(kind: 'light' | 'medium' | 'success' = 'light') {
  try {
    if (isNative()) {
      if (kind === 'success') await Haptics.notification({ type: NotificationType.Success })
      else await Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light })
    } else navigator.vibrate?.(kind === 'success' ? [12, 40, 18] : kind === 'medium' ? 18 : 8)
  } catch { /* no haptics available */ }
}

const fail = (code: string, message: string) => Object.assign(new Error(message), { code })

/** Google sign-in for the Android app via a Chrome tab. Resolves once Firebase is signed in. */
export async function nativeGoogleSignIn(auth: Auth) {
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')
  let handle: PluginListenerHandle | null = null
  const done = new Promise<{ idToken: string | null; accessToken: string | null }>((resolve, reject) => {
    App.addListener('appUrlOpen', ({ url }) => {
      if (!url.startsWith('vitpulse://auth')) return
      const q = new URL(url.replace('vitpulse://auth', 'https://x/auth')).searchParams
      if (q.get('state') !== state) return reject(fail('app/state', 'Sign-in was interrupted. Please try again.'))
      if (q.get('error')) return reject(fail(q.get('code') ?? 'app/web', q.get('error')!))
      resolve({ idToken: q.get('id_token') || null, accessToken: q.get('access_token') || null })
    }).then(h => { handle = h }, e => reject(fail('app/listener', `Could not listen for sign-in: ${e?.message ?? e}`)))
  })
  try {
    await Browser.open({ url: `${SITE}/auth.html?state=${state}`, toolbarColor: '#000000' })
  } catch (e) {
    throw fail('app/browser', `Could not open the sign-in page: ${(e as Error)?.message ?? e}`)
  }
  try {
    const { idToken, accessToken } = await done
    Browser.close().catch(() => {})
    if (!idToken && !accessToken) throw fail('app/token', 'Google did not return a sign-in token')
    await setPersistence(auth, browserLocalPersistence)
    return await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, accessToken))
  } finally { (handle as PluginListenerHandle | null)?.remove() }
}
