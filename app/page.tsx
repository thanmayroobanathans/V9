'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { Flame, MessageCircle, Search as SearchIcon, UserRound } from 'lucide-react'
import { auth, firebaseConfigured, signInWithGoogle, signOut } from '@/lib/firebase'
import { classify } from '@/lib/pulse-model'
import { estimateTraits } from '@/lib/trait-kalman'
import { jungFromAnswers, typeInfo } from '@/lib/jung'
import { fit, jungOf, quizTaken } from '@/lib/match'
import { GeoKalman } from '@/lib/kalman'
import { areaCode, clearTrack, computeNature, natureTags, record } from '@/lib/nature'
import { saveProfile, saveResult } from '@/lib/firestore'
import { SIGNAL, features, newLearner, pack, unpack, update, type LearnerState } from '@/lib/learner'
import {
  loadMySwipes, loadPerson, loadTaste, saveTaste, acceptFollow, cancelFollow, claimUsername, deleteAccount, normaliseUsername, removeFollower, requestFollow, watchFollows, type Follow, pairId, savePerson, sendMessage, swipe, unmatch, updateSignals,
  watchMatches, watchMessages, watchPeople, type Match, type Message, type Person, type Swipe,
} from '@/lib/social'
import { samplePeople, sampleReply } from '@/lib/samples'
import { ProfileBuilder, QuizIntro, TraitDetails, TypeCard, type Draft } from '@/components/pulse/onboarding'
import { Discover, ProfileDetail } from '@/components/pulse/discover'
import { ChatView, Inbox, MatchModal, isUnread, matchStarters, otherOf } from '@/components/pulse/chat'
import { Avatar, Chips, Ring } from '@/components/pulse/ui'
import { FollowLists, Page as FullPage, ProfileScreen, ReportPage, Requests, Search, type FollowState } from '@/components/pulse/people'
import { Legal } from '@/components/pulse/legal'
import { emailOf, isAllowedEmail, ALLOWED_DOMAIN } from '@/lib/config'

type Tab = 'swipe' | 'search' | 'matches' | 'profile'
type Stage = 'gate' | 'loading' | 'build' | 'reveal' | 'app'
type Geo = 'off' | 'asking' | 'on' | 'denied'

const nav = [{ id: 'swipe', icon: Flame }, { id: 'search', icon: SearchIcon }, { id: 'matches', icon: MessageCircle }, { id: 'profile', icon: UserRound }] as const
const SIGNAL_MS = 10 * 60 * 1000 // publish lifestyle signals at most every 10 minutes
const PAGE = 100

function useLocal<T>(key: string, init: T): [T, (v: T | ((x: T) => T)) => void] {
  const [v, setV] = useState<T>(init)
  useEffect(() => { try { const s = localStorage.getItem(key); setV(s ? JSON.parse(s) : init) } catch { /* ignore */ } }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((x: T | ((p: T) => T)) => setV(p => { const n = typeof x === 'function' ? (x as (p: T) => T)(p) : x; try { localStorage.setItem(key, JSON.stringify(n)) } catch { /* ignore */ } return n }), [key])
  return [v, set]
}
// Profiles calibrated before the Kalman engine (no `certainty`) recalibrate once so everyone is scored the same way.
const isReady = (p: Person | null): p is Person => !!p && !!p.username && !!p.vector?.length && p.age >= 18 && !!p.gender && Array.isArray(p.openTo) && typeof p.certainty === 'number'

export default function Page() {
  const [user, setUser] = useState<User | null>(null)
  const [stage, setStage] = useState<Stage>('gate')
  const [tab, setTab] = useState<Tab>('swipe')
  const [me, setMe] = useState<Person | null>(null)
  const [partial, setPartial] = useState<Person | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{ text: string; matchId?: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<'profile' | 'quiz' | null>(null)
  const [agreed, setAgreed] = useState(false)
  const uid = user?.uid ?? 'anon'

  // ---------- background location → lifestyle signals ----------
  const [wantLocation, setWantLocation] = useLocal(`pulse93.loc.${uid}`, false)
  const [geo, setGeo] = useState<Geo>('off')
  const kalman = useRef(new GeoKalman())
  const lastSignal = useRef(0)
  const meRef = useRef<Person | null>(null)
  useEffect(() => { meRef.current = me }, [me])

  // ---------- data ----------
  const [people, setPeople] = useState<Person[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [swiped, setSwiped] = useState<Set<string>>(new Set())
  const [peopleLoaded, setPeopleLoaded] = useState(false)
  const [incoming, setIncoming] = useState<Follow[]>([])
  const [outgoing, setOutgoing] = useState<Follow[]>([])
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null)
  type Screen = { kind: 'person'; p: Person } | { kind: 'lists'; tab: 'followers' | 'following' } | { kind: 'report'; target?: Person } | { kind: 'settings' } | { kind: 'swipeinfo'; p: Person }
  const [stack, setStack] = useState<Screen[]>([])
  const push = (x: Screen) => setStack(st => [...st, x])
  const pop = () => setStack(st => st.slice(0, -1))
  const [sampleFollows, setSampleFollows] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState('')
  const [celebrate, setCelebrate] = useState<{ other: Person; matchId: string } | null>(null)
  const [chatId, setChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgCount, setMsgCount] = useState(PAGE)
  const [hasMore, setHasMore] = useState(false)
  const [lastRead, setLastRead] = useLocal<Record<string, number>>(`pulse93.read.${uid}`, {})
  // Taste learner (Kalman filter over this person's swipes and chats).
  const [taste, setTaste] = useState<LearnerState | null>(null)
  const [chatted, setChatted] = useLocal<string[]>(`pulse95.chatted.${uid}`, [])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seenAt = useRef<Record<string, number> | null>(null)

  // ---------- sample preview (local only) ----------
  const [useSamples, setUseSamples] = useLocal(`pulse93.samples.${uid}`, true)
  const [sampleSwiped, setSampleSwiped] = useLocal<string[]>(`pulse93.sSwiped.${uid}`, [])
  const [sampleMatches, setSampleMatches] = useLocal<Match[]>(`pulse93.sMatches.${uid}`, [])
  const [sampleMsgs, setSampleMsgs] = useLocal<Record<string, Message[]>>(`pulse93.sMsgs.${uid}`, {})

  // ---------- auth + profile bootstrap ----------
  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, async u => {
      setUser(u)
      if (!u) { setStage('gate'); setMe(null); return }
      if (!isAllowedEmail(emailOf(u))) { const em = emailOf(u); await signOut(); setError(em ? `${em} is not a @${ALLOWED_DOMAIN} email` : 'Google did not share your email — try again'); return }
      setStage('loading')
      try { const p = await loadPerson(u.uid); if (isReady(p)) { setMe(p); setStage('app') } else { setPartial(p); setStage('build') } }
      catch (e) { setError(e instanceof Error ? e.message : 'Could not load your profile'); setStage('build') }
    })
  }, [])

  async function login() {
    setError('')
    try { await signInWithGoogle() } catch (e: unknown) {
      if (auth?.currentUser) return
      const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : ''
      const msg: Record<string, string> = {
        'auth/popup-blocked': 'Popup blocked — allow popups to continue.',
        'auth/popup-closed-by-user': 'Sign-in cancelled.', 'auth/cancelled-popup-request': 'Sign-in cancelled.',
        'auth/unauthorized-domain': `This domain isn't authorised — add ${window.location.hostname} in Firebase → Authentication → Settings.`,
        'auth/network-request-failed': 'Network error — check your connection and retry.',
        'auth/domain': (e as { email?: string | null }).email ? `${(e as { email?: string | null }).email} is not a @${ALLOWED_DOMAIN} email` : 'Google did not share your email — try again',
      }
      setError(msg[code] ?? `Sign-in failed${code ? ` (${code})` : ''}`)
    }
  }

  // GPS → Kalman filter → on-device track → lifestyle features (no coordinates leave the phone).
  useEffect(() => {
    if (!wantLocation || !user) { setGeo('off'); kalman.current.reset(); return }
    if (!navigator.geolocation) { setGeo('denied'); return }
    setGeo('asking')
    const id = navigator.geolocation.watchPosition(
      p => {
        setGeo('on')
        const s = kalman.current.process({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, time: p.timestamp || Date.now() })
        record(s)
        const cur = meRef.current
        if (!cur || !s.accepted || Date.now() - lastSignal.current < SIGNAL_MS) return
        lastSignal.current = Date.now()
        const nature = computeNature(), area = areaCode(s.lat, s.lng)
        setMe(m => m ? { ...m, nature, area, activeAt: Date.now() } : m)
        updateSignals(cur.uid, area, nature).catch(() => { /* retried next interval */ })
      },
      () => setGeo('denied'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [wantLocation, user])

  // ---------- profile ----------
  const blankDraft = useMemo<Draft>(() => ({
    uid: user?.uid ?? '', username: normaliseUsername((user?.email ?? '').split('@')[0]).replace(/^[._]+/, ''), name: user?.displayName?.split(' ')[0] ?? '', age: 0, gender: 'woman', seeking: 'men', intent: 'open', program: '', year: '2nd year', bio: '', status: '',
    interests: [], openTo: [], prompts: [], photoURL: user?.photoURL ?? null, hue: 210, nature: null, area: null, activeAt: 0, visible: true,
    ...(partial ? Object.fromEntries(Object.entries(partial).filter(([k, v]) => v !== undefined && v !== null && v !== '' && !['loc', 'locAt', 'placeId'].includes(k))) : {}),
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
    } catch (e) { setError(`Saved on this device only — ${e instanceof Error ? e.message : 'Firestore write failed'}. Check firestore.rules are deployed.`) }
    finally { setSaving(false) }
  }
  async function finishBuild(d: Draft, answers?: number[]) {
    if (d.username !== me?.username) {
      try { await claimUsername(user!.uid, d.username, me?.username ?? partial?.username) }
      catch (e) { setError(e instanceof Error ? e.message : 'Username not available'); return }
    }
    // A full-covariance Kalman filter reads the 36 answers into 11 traits.
    const est = answers ? estimateTraits(answers) : null
    // Skipping the quiz starts everyone from a neutral profile (certainty 0); matching then relies on
    // interests, intent, location and the taste learner until the quiz is taken.
    const neutral = !est && !me?.vector?.length && !d.vector?.length
    const vector = est ? est.vector : neutral ? new Array(11).fill(0.5) : (me?.vector ?? d.vector!)
    const jung = answers ? jungFromAnswers(answers) : neutral ? { ei: 0.5, ns: 0.5, tf: 0.5, jp: 0.5 } : (me ? jungOf(me) : d.jung!)
    const c = classify(vector).primary
    const p: Person = { ...d, uid: user!.uid, vector, jung, archetype: c.name, archetypeCode: c.code,
      certainty: est ? est.certainty : neutral ? 0 : (me?.certainty ?? d.certainty ?? 0), nature: me?.nature ?? d.nature ?? null, area: me?.area ?? d.area ?? null, activeAt: Date.now() }
    setMe(p); setEditing(null)
    if (stage === 'build') setStage('reveal')
    else if (answers) setTab('profile')
    await persist(p, answers)
  }
  async function updateMe(patch: Partial<Person>) { if (!me) return; const p = { ...me, ...patch }; setMe(p); await persist(p) }

  // ---------- realtime subscriptions ----------
  useEffect(() => {
    if (stage !== 'app' || !user) return
    loadTaste(user.uid).then(x => setTaste(unpack(x) ?? newLearner())).catch(() => setTaste(newLearner()))
    loadMySwipes(user.uid).then(ids => setSwiped(new Set(ids))).catch(() => {})
    const subs = [
      watchPeople(p => { setPeople(p); setPeopleLoaded(true) }, e => { setPeopleLoaded(true); setError(`People unavailable — ${e.message}`) }),
      watchMatches(user.uid, setMatches, e => setError(`Matches unavailable — ${e.message}`)),
      watchFollows(user.uid, (i, o) => { setIncoming(i); setOutgoing(o) }, e => setError(`Follows unavailable — ${e.message}`)),
    ]
    return () => subs.forEach(u => u())
  }, [stage, user])

  // ---------- merged real + sample views ----------
  const sPeople = useMemo(() => useSamples ? samplePeople(me?.area ?? null) : [], [useSamples, me?.area])
  const realOthers = useMemo(() => people.filter(p => p.uid !== me?.uid), [people, me?.uid])
  const allPeople = useMemo(() => [...realOthers, ...sPeople], [realOthers, sPeople])
  const byUid = useMemo(() => Object.fromEntries(allPeople.map(p => [p.uid, p])), [allPeople])
  const allSwiped = useMemo(() => new Set([...swiped, ...sampleSwiped]), [swiped, sampleSwiped])
  const candidates = useMemo(() => allPeople.filter(p => !allSwiped.has(p.uid)), [allPeople, allSwiped])
  const allMatches = useMemo(() => [...matches, ...(useSamples ? sampleMatches.map(m => { const l = sampleMsgs[m.id] ?? [], last = l[l.length - 1]; return { ...m, lastMessage: last?.text ?? '', lastSender: last?.senderUid ?? '', lastAt: last?.at ?? m.lastAt } }) : [])], [matches, sampleMatches, sampleMsgs, useSamples])
  const active = allMatches.find(m => m.id === chatId) ?? null

  // Incoming-message notifications across ALL threads (e.g. A and B both message C).
  useEffect(() => {
    if (!me) return
    const prev = seenAt.current
    const next: Record<string, number> = {}
    for (const m of allMatches) {
      next[m.id] = m.lastAt
      if (prev && m.lastSender && m.lastSender !== me.uid && m.lastAt > (prev[m.id] ?? 0) && m.id !== chatId && m.lastMessage) {
        setToast({ text: `${m.members[m.lastSender]?.name ?? 'Someone'}: ${m.lastMessage}`, matchId: m.id })
      }
    }
    seenAt.current = next
  }, [allMatches]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t) }, [toast])
  // Mark the open thread as read whenever it changes.
  useEffect(() => { if (active) setLastRead(r => ({ ...r, [active.id]: Math.max(Date.now(), active.lastAt) })) }, [active?.id, active?.lastAt]) // eslint-disable-line react-hooks/exhaustive-deps
  const unreadCount = me ? allMatches.filter(m => m.status === 'open' && (isUnread(m, me.uid, lastRead) || !m.lastMessage)).length : 0
  useEffect(() => { document.title = unreadCount ? `(${unreadCount}) VIT Pulse` : 'VIT Pulse' }, [unreadCount])

  useEffect(() => { setMsgCount(PAGE) }, [chatId])
  useEffect(() => {
    setMessages([]); setHasMore(false)
    if (!chatId || !active || active.sample) return
    return watchMessages(chatId, msgCount, (m, more) => { setMessages(m); setHasMore(more) }, e => setError(`Chat unavailable — ${e.message}`))
  }, [chatId, msgCount, !!active, active?.sample]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- actions ----------
  function learn(other: Person | undefined, y: number) {
    if (!me || !other) return
    setTaste(t => {
      const next = update(t ?? newLearner(), features(me, other), y)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => { saveTaste(me.uid, pack(next)).catch(() => {}) }, 3000)
      return next
    })
  }
  async function handleSwipe(p: Person, kind: Swipe) {
    if (!me) return
    learn(p, SIGNAL[kind])
    if (p.sample) {
      setSampleSwiped(s => [...s, p.uid])
      if (kind !== 'pass' && (kind === 'super' || fit(me, p).score >= 66)) {
        const id = pairId(me.uid, p.uid)
        setSampleMatches(ms => ms.some(x => x.id === id) ? ms : [...ms, { id, sample: true, status: 'open', memberUids: [me.uid, p.uid], lastAt: Date.now(), lastMessage: '', lastSender: '', members: { [me.uid]: { name: me.name, photoURL: me.photoURL, hue: me.hue }, [p.uid]: { name: p.name, photoURL: null, hue: p.hue } } }])
        setCelebrate({ other: p, matchId: id })
      }
      return
    }
    setSwiped(s => new Set(s).add(p.uid))
    try { const id = await swipe(me, p, kind); if (id) setCelebrate({ other: p, matchId: id }) }
    catch (e) { setError(`Not saved — ${e instanceof Error ? e.message : 'write failed'}`) }
  }
  const followStateOf = (uid: string): FollowState => { const f = outgoing.find(x => x.toUid === uid); return !f ? 'none' : f.status === 'accepted' ? 'following' : 'requested' }
  const chatWith = (uid: string) => allMatches.find(m => m.status === 'open' && m.memberUids.includes(uid))?.id ?? null
  async function follow(p: Person) { if (!me) return; try { await requestFollow(me, p) } catch (e) { setError(e instanceof Error ? e.message : 'Could not send request') } }
  async function unfollow(uid: string) { if (!me) return; await cancelFollow(me.uid, uid).catch(() => {}) }
  async function accept(f: Follow) { if (!me) return; try { await acceptFollow(me, f) } catch (e) { setError(e instanceof Error ? e.message : 'Could not accept') } }
  async function removeAccount() {
    if (!me) return
    try { await deleteAccount(me.uid, me.username); clearTrack(); await signOut() } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete account') }
  }
  function openChat(id: string) { setTab('matches'); setEditing(null); setChatId(id); setToast(null) }
  async function handleSend(text: string) {
    if (!active || !me) return
    if (!chatted.includes(active.id)) { setChatted(c => [...c, active.id]); learn(byUid[otherOf(active, me.uid)], SIGNAL.chat) }
    if (active.sample) {
      const id = active.id, them = otherOf(active, me.uid), now = Date.now()
      setSampleMsgs(x => ({ ...x, [id]: [...(x[id] ?? []), { id: `${now}`, senderUid: me.uid, text, at: now }] }))
      setTimeout(() => setSampleMsgs(x => { const l = x[id] ?? []; const n = l.filter(m => m.senderUid === them).length; return { ...x, [id]: [...l, { id: `${Date.now()}r`, senderUid: them, text: sampleReply(n), at: Date.now() }] } }), 1400)
      return
    }
    try { await sendMessage(active.id, me.uid, text) } catch (e) { setError(`Message not sent — ${e instanceof Error ? e.message : 'write failed'}`) }
  }

  // ---------- render ----------
  if (stage === 'gate') return (
    <main className="gate">
      <div className="gate-inner page-in">
        <div className="logo big">VIT Pulse</div>
        <p className="muted center">Meet VIT students who fit you.</p>
        <button className="primary-button wide" disabled={!agreed} onClick={login}>Continue with Google</button>
        <label className="agree"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} /><span>I&apos;m 18+, a VIT student, and agree to the <button type="button" className="link-button inline" onClick={() => setLegal('terms')}>Terms</button> and <button type="button" className="link-button inline" onClick={() => setLegal('privacy')}>Privacy Policy</button>.</span></label>
        {!firebaseConfigured && <p className="config-note">Firebase configuration required.</p>}
        {error && <p className="error center">{error}</p>}
        <p className="gate-foot">Use your @{ALLOWED_DOMAIN} account</p>
      </div>
      {legal && <Legal initial={legal} onClose={() => setLegal(null)} />}
    </main>
  )
  if (stage === 'loading') return <main className="gate"><div className="logo big pulse">VIT Pulse</div></main>
  if (stage === 'build') return <main className="solo">{error && <p className="error banner" onClick={() => setError('')}>{error}</p>}<ProfileBuilder initial={blankDraft} mode="onboard" locationOn={geo === 'on' || geo === 'asking'} requestLocation={() => setWantLocation(true)} onDone={finishBuild} saving={saving} /></main>
  if (stage === 'reveal' && me) return (
    <main className="solo"><section className="builder page-in reveal">
      <Avatar name={me.name} photoURL={me.photoURL} hue={me.hue} size={96} ring />
      <h2 className="step-title">You&apos;re all set, {me.name}</h2>
      {quizTaken(me) ? <TypeCard jung={me.jung} /> : <p className="muted center">You can take the personality quiz anytime from your profile.</p>}
      <button className="primary-button wide" onClick={() => { setStage('app'); setTab('swipe') }}>Start</button>
    </section></main>
  )
  if (!me) return null

  const go = (t: Tab) => { setTab(t); setEditing(null); setChatId(null); setStack([]) }
  const other = active ? byUid[otherOf(active, me.uid)] : undefined
  const top = stack[stack.length - 1]
  const followers = incoming.filter(f => f.status === 'accepted').length, followingN = outgoing.filter(f => f.status === 'accepted').length
  const pendingN = incoming.filter(f => f.status === 'pending').length
  const fsOf = (p: Person): FollowState => p.sample ? (sampleFollows.includes(p.uid) ? 'following' : 'none') : followStateOf(p.uid)
  const openPerson = (p: Person) => push({ kind: 'person', p })

  const screen = (() => {
    if (editing === 'profile') return <ProfileBuilder initial={me} mode="edit" locationOn={geo === 'on'} requestLocation={() => setWantLocation(true)} onDone={d => finishBuild(d)} onCancel={() => setEditing(null)} saving={saving} />
    if (editing === 'quiz') return <QuizIntro onBack={() => setEditing(null)} onDone={a => finishBuild(me, a)} />
    if (top?.kind === 'person') {
      const p = top.p
      return <FullPage title={p.username || p.name} onBack={pop}>
        <ProfileScreen me={me} person={p} followState={fsOf(p)} followsMe={incoming.some(f => f.fromUid === p.uid && f.status === 'accepted')} chatId={chatWith(p.uid)}
          onFollow={() => p.sample ? setSampleFollows(x => [...x, p.uid]) : follow(p)} onUnfollow={() => p.sample ? setSampleFollows(x => x.filter(u => u !== p.uid)) : unfollow(p.uid)}
          onMessage={id => { setStack([]); openChat(id) }} onReport={() => push({ kind: 'report', target: p })} />
      </FullPage>
    }
    if (top?.kind === 'lists') return <FollowLists initial={top.tab} username={me.username} incoming={incoming} outgoing={outgoing} onBack={pop} onRemoveFollower={f => removeFollower(me.uid, f.fromUid).catch(() => {})} onUnfollow={f => unfollow(f.toUid)} />
    if (top?.kind === 'report') return <ReportPage me={me.uid} target={top.target} onBack={pop} />
    if (top?.kind === 'swipeinfo') return <FullPage title={top.p.name} onBack={pop}><div className="sheet inline"><ProfileDetail me={me} p={top.p} f={fit(me, top.p, taste)} /></div></FullPage>
    if (top?.kind === 'settings') return (
      <FullPage title="Settings" onBack={pop}>
        <div className="settings">
          <button className="set-row" onClick={() => { const v = !wantLocation; setWantLocation(v); if (!v) { clearTrack(); updateSignals(me.uid, null, null).catch(() => {}); setMe({ ...me, nature: null, area: null }) } }}><span>Location<small>{geo === 'denied' ? 'Blocked in browser' : 'Improves matches · never shown'}</small></span><i className={`switch${wantLocation ? ' on' : ''}`} /></button>
          <button className="set-row" onClick={() => updateMe({ visible: !me.visible })}><span>Show my profile<small>Off pauses swiping</small></span><i className={`switch${me.visible ? ' on' : ''}`} /></button>
          <button className="set-row" onClick={() => setUseSamples(!useSamples)}><span>Demo profiles</span><i className={`switch${useSamples ? ' on' : ''}`} /></button>
          <button className="set-row" onClick={() => setEditing('quiz')}><span>{quizTaken(me) ? 'Retake personality quiz' : 'Take personality quiz'}</span></button>
          <button className="set-row" onClick={() => push({ kind: 'report' })}><span>Report a problem</span></button>
          <button className="set-row" onClick={() => setLegal('terms')}><span>Terms of Use</span></button>
          <button className="set-row" onClick={() => setLegal('privacy')}><span>Privacy Policy</span></button>
          <button className="set-row" onClick={() => signOut()}><span className="blue">Log out</span></button>
          <div className="set-row col">
            <span className="danger">Delete account</span>
            <small className="muted">Type <b>{me.username}</b> to permanently delete your profile, posts and data.</small>
            <input value={confirmDelete} autoCapitalize="none" placeholder={me.username} onChange={e => setConfirmDelete(e.target.value.trim().toLowerCase())} />
            <button className="danger-button" disabled={confirmDelete !== me.username} onClick={removeAccount}>Delete account</button>
          </div>
        </div>
      </FullPage>
    )
    if (tab === 'swipe') return <Discover me={me} candidates={candidates} taste={taste} onSwipe={handleSwipe} loading={!peopleLoaded} />
    if (tab === 'search') return <Search meUid={me.uid} onOpen={openPerson} />
    if (tab === 'matches') return active
      ? <ChatView meUid={me.uid} messages={active.sample ? sampleMsgs[active.id] ?? [] : messages} hasMore={!active.sample && hasMore} onLoadMore={() => setMsgCount(c => c + PAGE)} onSend={handleSend} onBack={() => setChatId(null)}
          placeholder="Message…"
          header={(() => { const o = active.members[otherOf(active, me.uid)]; return <button className="chat-title" onClick={() => other && openPerson(other)}><Avatar name={o?.name} photoURL={o?.photoURL} hue={o?.hue ?? 0} size={34} /><span><b>{o?.name}</b><small>{other?.username ?? ''}</small></span></button> })()}
          banner={<div className="chat-strip"><button className="link-button muted-link" onClick={async () => { if (active.sample) setSampleMatches(ms => ms.filter(m => m.id !== active.id)); else await unmatch(active.id).catch(() => {}); setChatId(null) }}>Unmatch</button></div>}
          footer={active.status === 'closed' ? <div className="composer closed">Chat closed</div> : undefined}
          empty={<><Avatar name={active.members[otherOf(active, me.uid)]?.name} photoURL={active.members[otherOf(active, me.uid)]?.photoURL} hue={active.members[otherOf(active, me.uid)]?.hue ?? 0} size={88} /><b>{active.members[otherOf(active, me.uid)]?.name}</b><span className="muted">Say hi 👋</span></>}
          starters={matchStarters(me, other)} />
      : <><Requests incoming={incoming} onAccept={accept} onDecline={f => removeFollower(me.uid, f.fromUid).catch(() => {})} /><Inbox me={me} matches={allMatches} people={byUid} lastRead={lastRead} onOpen={openChat} /></>
    return <ProfileScreen me={me} person={me} counts={{ followers, following: followingN }} onEdit={() => setEditing('profile')} onQuiz={() => setEditing('quiz')} onSettings={() => push({ kind: 'settings' })} onLists={t => push({ kind: 'lists', tab: t })} />
  })()

  const fullscreen = !!editing || !!top || (tab === 'matches' && !!active)
  return (
    <div className={`app-shell ig${chatId ? ' in-chat' : ''}`}>
      {!fullscreen && <header className="ig-bar">{tab === 'profile' ? <b className="ig-user">{me.username}</b> : <span className="logo">VIT Pulse</span>}{tab === 'swipe' && <span className="muted small">{candidates.length ? '' : ''}</span>}</header>}
      <main className="ig-main">
        {error && <p className="error banner" onClick={() => setError('')} title="Dismiss">{error}</p>}
        {screen}
      </main>
      {!fullscreen && (
        <nav className="ig-nav">
          {nav.map(({ id, icon: Icon }) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => go(id as Tab)} aria-label={id}>
            {id === 'profile' ? <span className={`nav-avatar${tab === id ? ' on' : ''}`}><Avatar name={me.name} photoURL={me.photoURL} hue={me.hue} size={26} /></span> : <Icon size={26} strokeWidth={tab === id ? 2.4 : 1.8} />}
            {id === 'matches' && unreadCount + pendingN > 0 && <i className="nav-dot" />}
          </button>)}
        </nav>
      )}
      {celebrate && <MatchModal me={me} other={celebrate.other} onClose={() => setCelebrate(null)} onChat={() => { openChat(celebrate.matchId); setCelebrate(null) }} />}
      {legal && <Legal initial={legal} onClose={() => setLegal(null)} />}
      {toast && <button className="toast" onClick={() => toast.matchId && openChat(toast.matchId)}><b>{toast.text.split(':')[0]}</b>{toast.text.slice(toast.text.indexOf(':') + 1)}</button>}
    </div>
  )
}
