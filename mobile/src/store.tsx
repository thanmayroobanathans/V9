/**
 * App state for the native app — the same logic as the website's app/page.tsx, using the shared
 * libraries in ../lib (matching engine, Kalman filters, Firebase data layer).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import * as Location from 'expo-location'
import * as Haptics from 'expo-haptics'
import { auth, signInWithGoogle, signOut } from '../../lib/firebase'
import { emailOf, isAllowedEmail, ALLOWED_DOMAIN } from '../../lib/config'
import { kv, hydrateKv } from '../../lib/kv'
import { classify } from '../../lib/pulse-model'
import { estimateTraits } from '../../lib/trait-kalman'
import { jungFromAnswers, typeInfo } from '../../lib/jung'
import { fit, jungOf } from '../../lib/match'
import { GeoKalman } from '../../lib/kalman'
import { areaCode, clearTrack, computeNature, record } from '../../lib/nature'
import { SIGNAL, features, newLearner, pack, unpack, update, type LearnerState } from '../../lib/learner'
import { saveProfile, saveResult } from '../../lib/firestore'
import {
  acceptFollow, cancelFollow, claimUsername, deleteAccount, loadMySwipes, loadPerson, loadTaste, normaliseUsername, removeFollower,
  requestFollow, savePerson, saveTaste, sendMessage, swipe as recordSwipe, unmatch, updateSignals, watchFollows, watchMatches, watchPeople,
  type Follow, type Match, type Person, type Swipe,
} from '../../lib/social'

export type Stage = 'loading' | 'gate' | 'build' | 'reveal' | 'app'
export type Draft = Omit<Person, 'vector' | 'archetype' | 'archetypeCode' | 'jung'> & { vector?: number[]; jung?: Person['jung'] }
export type FollowState = 'none' | 'requested' | 'following'

const SIGNAL_MS = 10 * 60 * 1000
const isReady = (p: Person | null): p is Person => !!p && !!p.username && !!p.vector?.length && p.age >= 18 && Array.isArray(p.openTo) && typeof p.certainty === 'number'
const getJSON = <T,>(k: string, d: T): T => { try { const s = kv.get(k); return s ? JSON.parse(s) : d } catch { return d } }
const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message) || fallback

type Ctx = ReturnType<typeof useAppState>
const AppCtx = createContext<Ctx | null>(null)
export const useApp = () => { const c = useContext(AppCtx); if (!c) throw new Error('useApp outside provider'); return c }
export function AppProvider({ children }: { children: React.ReactNode }) {
  const v = useAppState()
  return <AppCtx.Provider value={v}>{children}</AppCtx.Provider>
}

function useAppState() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [stage, setStage] = useState<Stage>('loading')
  const [me, setMe] = useState<Person | null>(null)
  const [partial, setPartial] = useState<Person | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [people, setPeople] = useState<Person[]>([])
  const [peopleLoaded, setPeopleLoaded] = useState(false)
  const [matches, setMatches] = useState<Match[]>([])
  const [incoming, setIncoming] = useState<Follow[]>([])
  const [outgoing, setOutgoing] = useState<Follow[]>([])
  const [swiped, setSwiped] = useState<Set<string>>(new Set())
  const [taste, setTaste] = useState<LearnerState | null>(null)
  const [celebrate, setCelebrate] = useState<{ other: Person; matchId: string } | null>(null)
  const [toast, setToast] = useState<{ text: string; matchId?: string } | null>(null)
  const [lastRead, setLastReadState] = useState<Record<string, number>>({})
  const [wantLocation, setWantLocationState] = useState(false)
  const [geo, setGeo] = useState<'off' | 'on' | 'denied'>('off')
  const [openChatId, setOpenChatId] = useState<string | null>(null)
  const meRef = useRef<Person | null>(null); meRef.current = me
  const seenAt = useRef<Record<string, number> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const uid = user?.uid ?? 'anon'

  // ---- startup: load local storage, then follow auth state ----
  useEffect(() => { hydrateKv().catch(() => {}).finally(() => setReady(true)) }, [])
  useEffect(() => {
    if (!ready || !auth) return
    return onAuthStateChanged(auth, async u => {
      setUser(u)
      if (!u) { setStage('gate'); setMe(null); return }
      if (!isAllowedEmail(emailOf(u))) { const em = emailOf(u); await signOut(); setError(em ? `${em} is not a @${ALLOWED_DOMAIN} email` : 'Google did not share your email — try again'); return }
      setLastReadState(getJSON(`read.${u.uid}`, {}))
      setWantLocationState(getJSON(`loc.${u.uid}`, false))
      setStage('loading')
      try { const p = await loadPerson(u.uid); if (isReady(p)) { setMe(p); setStage('app') } else { setPartial(p); setStage('build') } }
      catch (e) { setError(errText(e, 'Could not load your profile')); setStage('build') }
    })
  }, [ready])

  const login = useCallback(async () => {
    setError('')
    try { await signInWithGoogle() } catch (e) {
      const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : ''
      if (code === 'auth/popup-closed-by-user') return
      if (code === 'auth/domain') { const em = (e as { email?: string }).email; setError(em ? `${em} is not a @${ALLOWED_DOMAIN} email` : `Use your @${ALLOWED_DOMAIN} account`); return }
      setError(`Sign-in failed${code ? ` (${code})` : ''}: ${errText(e, 'try again')}`)
    }
  }, [])

  // ---- profile ----
  const blankDraft = useMemo<Draft>(() => ({
    uid: user?.uid ?? '', username: normaliseUsername((user?.email ?? '').split('@')[0]).replace(/^[._]+/, ''), name: user?.displayName?.split(' ')[0] ?? '',
    age: 0, intent: 'open', program: '', year: '2nd year', bio: '', status: '', interests: [], openTo: [], prompts: [],
    photoURL: user?.photoURL ?? null, hue: 210, nature: null, area: null, activeAt: 0, visible: true,
    ...(partial ? Object.fromEntries(Object.entries(partial).filter(([k, v]) => v !== undefined && v !== null && v !== '' && !['loc', 'locAt', 'placeId', 'gender', 'seeking'].includes(k))) : {}),
  } as Draft), [user, partial])

  async function persist(p: Person, answers?: number[]) {
    if (!user) return
    setSaving(true); setError('')
    try {
      await saveProfile(user.uid, { subjectName: p.name, email: user.email, locationSignal: wantLocation ? 'LIFESTYLE SIGNALS ONLY' : 'OFF', locationConsent: wantLocation })
      if (answers) {
        const c = classify(p.vector)
        await saveResult(user.uid, { subjectName: p.name, archetype: c.primary.name, archetypeCode: c.primary.code, matchScore: c.primary.score, personalityVector: p.vector, rankedArchetypes: c.ranked.slice(0, 8).map(r => ({ name: r.name, code: r.code, score: Math.round(r.score * 1000) / 10 })), locationSignal: typeInfo(p.jung).code })
      }
      await savePerson(p)
    } catch (e) { setError(`Not saved — ${errText(e, 'write failed')}`) }
    finally { setSaving(false) }
  }

  /** Save the profile builder (and optional quiz answers). Returns false if the username is taken. */
  async function finishBuild(d: Draft, answers?: number[]): Promise<boolean> {
    if (!user) return false
    if (d.username !== me?.username) {
      try { await claimUsername(user.uid, d.username, me?.username ?? partial?.username) }
      catch (e) { setError(errText(e, 'Username not available')); return false }
    }
    const est = answers ? estimateTraits(answers) : null
    const neutral = !est && !me?.vector?.length && !d.vector?.length
    const vector = est ? est.vector : neutral ? new Array(11).fill(0.5) : (me?.vector ?? d.vector!)
    const jung = answers ? jungFromAnswers(answers) : neutral ? { ei: 0.5, ns: 0.5, tf: 0.5, jp: 0.5 } : (me ? jungOf(me) : d.jung!)
    const c = classify(vector).primary
    const p: Person = {
      ...d, uid: user.uid, vector, jung, archetype: c.name, archetypeCode: c.code,
      certainty: est ? est.certainty : neutral ? 0 : (me?.certainty ?? d.certainty ?? 0),
      nature: me?.nature ?? d.nature ?? null, area: me?.area ?? d.area ?? null, activeAt: Date.now(),
    }
    setMe(p)
    if (stage === 'build') setStage('reveal')
    await persist(p, answers)
    return true
  }
  const updateMe = async (patch: Partial<Person>) => { if (!me) return; const p = { ...me, ...patch }; setMe(p); await persist(p) }

  // ---- live data ----
  useEffect(() => {
    if (stage !== 'app' || !user) return
    loadTaste(user.uid).then(x => setTaste(unpack(x) ?? newLearner())).catch(() => setTaste(newLearner()))
    loadMySwipes(user.uid).then(ids => setSwiped(new Set(ids))).catch(() => {})
    const subs = [
      watchPeople(p => { setPeople(p); setPeopleLoaded(true) }, e => { setPeopleLoaded(true); setError(`People unavailable — ${e.message}`) }),
      watchMatches(user.uid, setMatches, e => setError(`Chats unavailable — ${e.message}`)),
      watchFollows(user.uid, (i, o) => { setIncoming(i); setOutgoing(o) }, e => setError(`Follows unavailable — ${e.message}`)),
    ]
    return () => subs.forEach(u => u())
  }, [stage, user])

  const others = useMemo(() => people.filter(p => p.uid !== me?.uid), [people, me?.uid])
  const byUid = useMemo(() => Object.fromEntries(others.map(p => [p.uid, p])), [others])
  const candidates = useMemo(() => others.filter(p => !swiped.has(p.uid)), [others, swiped])

  // New-message notifications across all chats (if A and B both message you, you see both).
  useEffect(() => {
    if (!me) return
    const prev = seenAt.current, next: Record<string, number> = {}
    for (const m of matches) {
      next[m.id] = m.lastAt
      if (prev && m.lastSender && m.lastSender !== me.uid && m.lastAt > (prev[m.id] ?? 0) && m.id !== openChatId && m.lastMessage) {
        setToast({ text: `${m.members[m.lastSender]?.name ?? 'Someone'}: ${m.lastMessage}`, matchId: m.id })
        Haptics.selectionAsync().catch(() => {})
      }
    }
    seenAt.current = next
  }, [matches]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t) }, [toast])

  const markRead = (id: string, at: number) => setLastReadState(r => { const n = { ...r, [id]: Math.max(Date.now(), at) }; kv.set(`read.${uid}`, JSON.stringify(n)); return n })
  const isUnread = (m: Match) => !!m.lastMessage && m.lastSender !== me?.uid && m.lastAt > (lastRead[m.id] ?? 0)
  const pendingRequests = incoming.filter(f => f.status === 'pending').length
  const badge = matches.filter(m => m.status === 'open' && (isUnread(m) || !m.lastMessage)).length + pendingRequests

  // ---- taste learner ----
  function learn(other: Person | undefined, y: number) {
    if (!me || !other) return
    setTaste(t => {
      const next = update(t ?? newLearner(), features(me, other), y)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => { saveTaste(me.uid, pack(next)).catch(() => {}) }, 3000)
      return next
    })
  }

  // ---- actions ----
  async function swipe(p: Person, kind: Swipe) {
    if (!me) return
    learn(p, SIGNAL[kind])
    Haptics.impactAsync(kind === 'pass' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    setSwiped(s => new Set(s).add(p.uid))
    try {
      const id = await recordSwipe(me, p, kind)
      if (id) { setCelebrate({ other: p, matchId: id }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}) }
    } catch (e) { setError(`Not saved — ${errText(e, 'write failed')}`) }
  }
  const followState = (to: string): FollowState => { const f = outgoing.find(x => x.toUid === to); return !f ? 'none' : f.status === 'accepted' ? 'following' : 'requested' }
  const chatWith = (other: string) => matches.find(m => m.status === 'open' && m.memberUids.includes(other))?.id ?? null
  const follow = async (p: Person) => { if (me) await requestFollow(me, p).catch(e => setError(errText(e, 'Could not send request'))) }
  const unfollow = async (to: string) => { if (me) await cancelFollow(me.uid, to).catch(() => {}) }
  const accept = async (f: Follow) => { if (me) await acceptFollow(me, f).catch(e => setError(errText(e, 'Could not accept'))) }
  const decline = async (f: Follow) => { if (me) await removeFollower(me.uid, f.fromUid).catch(() => {}) }
  const [chatted, setChatted] = useState<string[]>([])
  async function send(matchId: string, text: string) {
    if (!me) return
    const m = matches.find(x => x.id === matchId)
    if (m && !chatted.includes(matchId)) { setChatted(c => [...c, matchId]); learn(byUid[m.memberUids.find(u => u !== me.uid) ?? ''], SIGNAL.chat) }
    await sendMessage(matchId, me.uid, text).catch(e => setError(`Message not sent — ${errText(e, 'write failed')}`))
  }
  const closeChat = async (matchId: string) => { await unmatch(matchId).catch(() => {}) }
  async function removeAccount() {
    if (!me) return
    try { await deleteAccount(me.uid, me.username); clearTrack(); await signOut() } catch (e) { setError(errText(e, 'Could not delete account')) }
  }

  // ---- location → Kalman filter → lifestyle signals (never coordinates) ----
  const setWantLocation = async (v: boolean) => {
    if (v) {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') { setGeo('denied'); return }
    }
    setWantLocationState(v); kv.set(`loc.${uid}`, JSON.stringify(v))
    if (!v && me) { clearTrack(); updateSignals(me.uid, null, null).catch(() => {}); setMe({ ...me, nature: null, area: null }) }
  }
  useEffect(() => {
    if (!wantLocation || !user) { setGeo('off'); return }
    const kalman = new GeoKalman(); let lastSignal = 0, sub: Location.LocationSubscription | null = null, dead = false
    ;(async () => {
      const perm = await Location.getForegroundPermissionsAsync()
      if (perm.status !== 'granted') { setGeo('denied'); return }
      setGeo('on')
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 25 }, pos => {
        const s = kalman.process({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? 50, time: pos.timestamp || Date.now() })
        record(s)
        const cur = meRef.current
        if (!cur || !s.accepted || Date.now() - lastSignal < SIGNAL_MS) return
        lastSignal = Date.now()
        const nature = computeNature(), area = areaCode(s.lat, s.lng)
        setMe(m => m ? { ...m, nature, area, activeAt: Date.now() } : m)
        updateSignals(cur.uid, area, nature).catch(() => {})
      })
      if (dead) sub.remove()
    })().catch(() => setGeo('denied'))
    return () => { dead = true; sub?.remove() }
  }, [wantLocation, user])

  return {
    ready, user, stage, setStage, me, error, setError, saving, login, signOut, blankDraft, finishBuild, updateMe,
    people: others, peopleLoaded, byUid, candidates, matches, incoming, outgoing, taste, celebrate, setCelebrate, toast, setToast,
    lastRead, markRead, isUnread, badge, pendingRequests, swipe, followState, chatWith, follow, unfollow, accept, decline, send, closeChat,
    removeAccount, wantLocation, setWantLocation, geo, setOpenChatId, fitWith: (p: Person) => (me ? fit(me, p, taste) : null),
  }
}
