'use client'

/**
 * Sign-in bridge for the Android app. The app opens this page in a Chrome tab (Google doesn't
 * allow sign-in inside app WebViews). After Google sign-in, the credential is handed back to the
 * app through the vitpulse://auth link, together with the `state` the app generated.
 */
import { useEffect, useState } from 'react'
import { GoogleAuthProvider } from 'firebase/auth'
import { auth, signInWithGoogle, signOut } from '@/lib/firebase'

export default function AuthBridge() {
  const [state, setState] = useState('')
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setState(new URLSearchParams(location.search).get('state') ?? '') }, [])

  const back = (params: Record<string, string>) => {
    const url = `vitpulse://auth?${new URLSearchParams({ state, ...params })}`
    setLink(url)
    window.location.href = url
  }
  async function go() {
    setBusy(true); setError('')
    try {
      const cred = await signInWithGoogle()
      const c = GoogleAuthProvider.credentialFromResult(cred)
      if (!c?.idToken && !c?.accessToken) throw new Error('Google did not return a sign-in token')
      back({ id_token: c.idToken ?? '', access_token: c.accessToken ?? '' })
      if (auth) signOut().catch(() => {}) // the app keeps its own session; nothing stays signed in here
    } catch (e) {
      const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : ''
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') { setBusy(false); return }
      const msg = e instanceof Error ? e.message : 'Sign-in failed'
      setError(msg)
      if (code === 'auth/domain') back({ error: msg, code })
    }
    setBusy(false)
  }

  return (
    <main className="gate">
      <div className="gate-inner page-in">
        <div className="logo big">VIT Pulse</div>
        {link
          ? <><p className="muted center">Signed in. Returning to the app…</p><a className="primary-button wide" href={link}>Open VIT Pulse</a></>
          : <><p className="muted center">Sign in to continue in the app.</p>
            <button className="primary-button wide" disabled={busy || !state} onClick={go}>{busy ? 'Signing in…' : 'Continue with Google'}</button></>}
        {!state && <p className="error center">Open this page from the VIT Pulse app.</p>}
        {error && <p className="error center">{error}</p>}
      </div>
    </main>
  )
}
