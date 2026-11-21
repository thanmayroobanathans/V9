'use client'

/**
 * Android app integration (Capacitor). Everything here is a no-op on the website.
 *
 * Google sign-in: Google blocks its login page inside app WebViews, so — like most apps — we open
 * a secure Chrome tab on our own site (`/auth.html`), sign in there, and Chrome hands the Google
 * credential back to the app through the `vitpulse://auth` link. The app then signs in to Firebase
 * with that credential. No extra Firebase/Android setup is needed.
 */
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { GoogleAuthProvider, setPersistence, browserLocalPersistence, signInWithCredential, type Auth } from 'firebase/auth'

export const SITE = 'https://thanmayroobanathans.github.io/V9'
export const isNative = () => typeof window !== 'undefined' && Capacitor.isNativePlatform()

let backHandler: (() => boolean) | null = null
/** The page registers what "back" means right now (close a page, leave a chat, …). */
export function setBackHandler(fn: (() => boolean) | null) { backHandler = fn }

export async function initNative() {
  if (!isNative()) return
  const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([import('@capacitor/app'), import('@capacitor/status-bar'), import('@capacitor/splash-screen')])
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  StatusBar.setBackgroundColor({ color: '#000000' }).catch(() => {})
  SplashScreen.hide().catch(() => {})
  App.addListener('backButton', () => { if (!backHandler?.()) App.minimizeApp() })
  document.documentElement.classList.add('native')
}

/** Small vibration for swipes, likes and matches. */
export async function haptic(kind: 'light' | 'medium' | 'success' = 'light') {
  try {
    if (isNative()) {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics')
      if (kind === 'success') await Haptics.notification({ type: NotificationType.Success })
      else await Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light })
    } else navigator.vibrate?.(kind === 'success' ? [12, 40, 18] : kind === 'medium' ? 18 : 8)
  } catch { /* no haptics available */ }
}

/** Google sign-in for the Android app via a Chrome tab. Resolves once Firebase is signed in. */
export async function nativeGoogleSignIn(auth: Auth) {
  const [{ App }, { Browser }] = await Promise.all([import('@capacitor/app'), import('@capacitor/browser')])
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')
  let handle: PluginListenerHandle | null = null
  const done = new Promise<{ idToken: string | null; accessToken: string | null }>((resolve, reject) => {
    App.addListener('appUrlOpen', ({ url }) => {
      if (!url.startsWith('vitpulse://auth')) return
      const q = new URL(url.replace('vitpulse://auth', 'https://x/auth')).searchParams
      if (q.get('state') !== state) return reject(Object.assign(new Error('Sign-in was interrupted — try again'), { code: 'auth/state' }))
      if (q.get('error')) return reject(Object.assign(new Error(q.get('error')!), { code: q.get('code') ?? 'auth/web' }))
      resolve({ idToken: q.get('id_token'), accessToken: q.get('access_token') })
    }).then(h => { handle = h })
  })
  await Browser.open({ url: `${SITE}/auth.html?state=${state}`, presentationStyle: 'popover', toolbarColor: '#000000' })
  try {
    const { idToken, accessToken } = await done
    Browser.close().catch(() => {})
    await setPersistence(auth, browserLocalPersistence)
    return await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, accessToken))
  } finally { (handle as PluginListenerHandle | null)?.remove() }
}
