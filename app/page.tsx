'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { ArrowRight, Compass, Heart, LockKeyhole, LogOut, MessageSquare, Pencil, RefreshCw, Settings, Sparkles, UserRound } from 'lucide-react'
import { auth, firebaseConfigured, signInWithGoogle, signOut } from '@/lib/firebase'
import { classify, scoreAnswers } from '@/lib/pulse-model'
import { saveLocationCoordinate, saveProfile, saveResult, type PrivateLocation } from '@/lib/firestore'
import {
  INTENT_LABEL, PROMPTS, loadCandidates, loadMyProfile, pairId, savePublicProfile, sendMessage, swipe, unmatch,
  watchMatches, watchMessages, type Match, type Message, type PublicProfile, type Swipe,
} from '@/lib/dating'
import { SAMPLE_PROFILES, sampleLikesBack, sampleReply } from '@/lib/samples'
import { Calibration, Dossier, ProfileBuilder, type Draft } from '@/components/pulse/onboarding'
import { Discover } from '@/components/pulse/discover'
import { Chat, MatchList, MatchModal, otherOf } from '@/components/pulse/matches'
import { Avatar, Chips, Portrait } from '@/components/pulse/ui'
import { compatibility } from '@/lib/pulse-model'

type Tab = 'discover' | 'matches' | 'profile' | 'settings'
type Stage = 'gate' | 'loading' | 'build' | 'app'

const CAMPUSES = [{ lat: 12.9692, lng: 79.1559 }, { lat: 12.8406, lng: 80.1534 }, { lat: 16.4963, lng: 80.4994 }, { lat: 23.0773, lng: 76.8513 }]
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => { const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)) }
const nav = [{ id: 'discover', label: 'Discover', icon: Compass }, { id: 'matches', label: 'Matches', icon: MessageSquare }, { id: 'profile', label: 'Profile', icon: UserRound }, { id: 'settings', label: 'Settings', icon: Settings }] as const

function useLocal<T>(key: string, init: T): [T, (v: T | ((x: T) => T)) => void] {
  const [v, setV] = useState<T>(init)
  useEffect(() => { try { const s = localStorage.getItem(key); setV(s ? JSON.parse(s) : init) } catch { /* ignore */ } }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((x: T | ((p: T) => T)) => setV(p => { const n = typeof x === 'function' ? (x as (p: T) => T)(p) : x; try { localStorage.setItem(key, JSON.stringify(n)) } catch { /* ignore */ } return n }), [key])
  return [v, set]
}

export default function Page() {
  const [user, setUser] = useState<User | null>(null)
  const [stage, setStage] = useState<Stage>('gate')
  const [tab, setTab] = useState<Tab>('discover')
  const [me, setMe] = useState<PublicProfile | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<'profile' | 'quiz' | null>(null)
  const [location, setLocation] = useState('NOT REQUESTED')
  const [coords, setCoords] = useState<PrivateLocation | null>(null)

  const [candidates, setCandidates] = useState<PublicProfile[]>([])
  const [loadingDeck, setLoadingDeck] = useState(false)
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({})
  const [realMatches, setRealMatches] = useState<Match[]>([])
  const [chatId, setChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [celebrate, setCelebrate] = useState<{ other: PublicProfile; matchId: string } | null>(null)

  const uid = user?.uid ?? 'anon'
  const [useSamples, setUseSamples] = useLocal(`pulse9.samples.${uid}`, true)
  const [sampleSwiped, setSampleSwiped] = useLocal<string[]>(`pulse9.sampleSwiped.${uid}`, [])
  const [sampleMatches, setSampleMatches] = useLocal<Match[]>(`pulse9.sampleMatches.${uid}`, [])
  const [sampleMsgs, setSampleMsgs] = useLocal<Record<string, Message[]>>(`pulse9.sampleMsgs.${uid}`, {})

  // ---------- auth + profile bootstrap ----------
  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, async u => {
      setUser(u)
      if (!u) { setStage('gate'); setMe(null); return }
      setStage('loading')
      try { const p = await loadMyProfile(u.uid); if (p?.vector?.length) { setMe(p); setStage('app') } else setStage('build') }
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
        'auth/operation-not-allowed': 'Google sign-in is disabled in Firebase.',
        'auth/network-request-failed': 'Network error — check your connection and retry.',
      }
      setError(msg[code] ?? `Sign-in failed${code ? ` (${code})` : ''}`)
    }
  }

  function requestLocation() {
    if (!navigator.geolocation) return setLocation('UNAVAILABLE')
    navigator.geolocation.getCurrentPosition(p => {
      setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, timestamp: p.timestamp })
      const near = Math.min(...CAMPUSES.map(c => km(c, { lat: p.coords.latitude, lng: p.coords.longitude })))
      setLocation(near < 2 ? 'ON CAMPUS' : near < 25 ? 'NEAR CAMPUS' : 'OFF CAMPUS')
    }, () => setLocation('DECLINED'), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 })
  }

  const blankDraft = useMemo<Draft>(() => ({
    uid: user?.uid ?? '', name: user?.displayName?.split(' ')[0] ?? '', age: 0, gender: 'woman', seeking: 'men', intent: 'dating', year: '2nd year', program: '',
    bio: '', interests: [], prompts: [{ q: PROMPTS[0], a: '' }, { q: PROMPTS[2], a: '' }], photoURL: user?.photoURL ?? null, hue: 340, campusSignal: location, discoverable: true,
  }), [user, location])

  async function persist(p: PublicProfile, answers?: number[]) {
    if (!user) return
    setSaving(true); setError('')
    try {
      await saveProfile(user.uid, { subjectName: p.name, email: user.email, locationSignal: p.campusSignal, locationConsent: coords !== null })
      if (coords) await saveLocationCoordinate(user.uid, coords)
      if (answers) {
        const c = classify(p.vector)
        await saveResult(user.uid, { subjectName: p.name, archetype: c.primary.name, archetypeCode: c.primary.code, matchScore: c.primary.score, personalityVector: p.vector, rankedArchetypes: c.ranked.slice(0, 8).map(r => ({ name: r.name, code: r.code, score: Math.round(r.score * 1000) / 10 })), locationSignal: p.campusSignal })
      }
      await savePublicProfile(p)
    } catch (e) { setError(`Saved on this device only — ${e instanceof Error ? e.message : 'Firestore write failed'}. Check firestore.rules are deployed.`) }
    finally { setSaving(false) }
  }

  async function finishBuild(d: Draft, answers?: number[]) {
    const vector = answers ? scoreAnswers(answers) : (me?.vector ?? d.vector ?? [])
    const c = classify(vector).primary
    const p: PublicProfile = { ...d, uid: user!.uid, vector, archetype: c.name, archetypeCode: c.code, campusSignal: location !== 'NOT REQUESTED' ? location : (me?.campusSignal ?? 'UNKNOWN') }
    setMe(p); setEditing(null)
    if (stage === 'build') { setStage('app'); setTab('profile') }
    await persist(p, answers)
  }

  // ---------- discovery ----------
  const refreshDeck = useCallback(async () => {
    if (!me) return
    setLoadingDeck(true)
    try { const list = await loadCandidates(me); setCandidates(list); setProfiles(x => ({ ...x, ...Object.fromEntries(list.map(p => [p.uid, p])) })) }
    catch (e) { setCandidates([]); setError(`Discovery unavailable — ${e instanceof Error ? e.message : 'query failed'}`) }
    finally { setLoadingDeck(false) }
  }, [me?.uid]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (stage === 'app' && me) refreshDeck() }, [stage, me?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  const samplePool = useMemo(() => useSamples ? SAMPLE_PROFILES.filter(p => !sampleSwiped.includes(p.uid)) : [], [useSamples, sampleSwiped])
  const deck = useMemo(() => [...candidates, ...samplePool], [candidates, samplePool])
  const allProfiles = useMemo(() => ({ ...Object.fromEntries(SAMPLE_PROFILES.map(p => [p.uid, p])), ...profiles }), [profiles])

  async function handleSwipe(p: PublicProfile, kind: Swipe) {
    if (!me) return
    if (p.sample) {
      setSampleSwiped(s => [...s, p.uid])
      if (kind !== 'pass' && sampleLikesBack(compatibility(me.vector, p.vector), kind)) {
        const id = pairId(me.uid, p.uid)
        const m: Match = { id, sample: true, status: 'open', memberUids: [me.uid, p.uid], lastAt: Date.now(), lastMessage: '', members: { [me.uid]: { name: me.name, photoURL: me.photoURL, hue: me.hue }, [p.uid]: { name: p.name, photoURL: null, hue: p.hue } } }
        setSampleMatches(ms => ms.some(x => x.id === id) ? ms : [...ms, m])
        setCelebrate({ other: p, matchId: id })
      }
      return
    }
    setCandidates(c => c.filter(x => x.uid !== p.uid))
    try { const id = await swipe(me, p, kind); if (id) setCelebrate({ other: p, matchId: id }) }
    catch (e) { setError(`Swipe not saved — ${e instanceof Error ? e.message : 'write failed'}`) }
  }

  // ---------- matches + chat ----------
  useEffect(() => {
    if (stage !== 'app' || !user) return
    return watchMatches(user.uid, setRealMatches, e => setError(`Matches unavailable — ${e.message}`))
  }, [stage, user])
  useEffect(() => { // fetch profiles for matched people so we can show compatibility + icebreakers
    if (!me) return
    realMatches.map(m => otherOf(m, me.uid)).filter(id => id && !profiles[id]).forEach(id => loadMyProfile(id).then(p => p && setProfiles(x => ({ ...x, [id]: p }))).catch(() => {}))
  }, [realMatches, me]) // eslint-disable-line react-hooks/exhaustive-deps

  const matches = useMemo(() => {
    const sm = sampleMatches.map(m => { const list = sampleMsgs[m.id] ?? []; const last = list[list.length - 1]; return { ...m, lastMessage: last?.text ?? '', lastAt: last?.at ?? m.lastAt } })
    return [...realMatches, ...(useSamples ? sm : [])]
  }, [realMatches, sampleMatches, sampleMsgs, useSamples])
  const activeChat = matches.find(m => m.id === chatId) ?? null

  useEffect(() => {
    if (!activeChat || activeChat.sample) return
    setMessages([])
    return watchMessages(activeChat.id, setMessages, e => setError(`Chat unavailable — ${e.message}`))
  }, [activeChat?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend(text: string) {
    if (!activeChat || !me) return
    if (activeChat.sample) {
      const id = activeChat.id, now = Date.now()
      setSampleMsgs(x => ({ ...x, [id]: [...(x[id] ?? []), { id: `${now}`, senderUid: me.uid, text, at: now }] }))
      const theirs = otherOf(activeChat, me.uid)
      setTimeout(() => setSampleMsgs(x => { const list = x[id] ?? []; const n = list.filter(m => m.senderUid === theirs).length; return { ...x, [id]: [...list, { id: `${Date.now()}r`, senderUid: theirs, text: sampleReply(n), at: Date.now() }] } }), 1400)
      return
    }
    try { await sendMessage(activeChat.id, me.uid, text) } catch (e) { setError(`Message not sent — ${e instanceof Error ? e.message : 'write failed'}`) }
  }
  async function handleUnmatch() {
    if (!activeChat) return
    if (activeChat.sample) { setSampleMatches(ms => ms.filter(m => m.id !== activeChat.id)); setChatId(null); return }
    try { await unmatch(activeChat.id); setChatId(null) } catch (e) { setError(e instanceof Error ? e.message : 'Unmatch failed') }
  }

  async function updateMe(patch: Partial<PublicProfile>) { if (!me) return; const p = { ...me, ...patch }; setMe(p); await persist(p) }

  // ---------- render ----------
  if (stage === 'gate') return (
    <main className="gate">
      <div className="gate-glow" />
      <div className="gate-inner">
        <div className="eyebrow"><span className="status-dot" /> VIT PULSE / V9</div>
        <h1>Meet people<br /><em>on your wavelength.</em></h1>
        <p className="muted">Dating and friendships for VIT students, matched by a 36-question personality model — not just photos.</p>
        <div className="gate-points"><span><Sparkles size={14} /> Personality-matched picks</span><span><Heart size={14} /> Chat only after a mutual like</span><span><LockKeyhole size={14} /> Location never shared precisely</span></div>
        <button className="primary-button wide" onClick={login}><LockKeyhole size={16} /> Continue with Google <ArrowRight size={16} /></button>
        {!firebaseConfigured && <p className="config-note">Firebase configuration required.</p>}
        {error && <p className="error">{error}</p>}
        <div className="gate-footer"><span>18+ · VIT students</span><span>MODEL V9.0</span></div>
      </div>
    </main>
  )
  if (stage === 'loading') return <main className="gate"><div className="gate-inner center"><RefreshCw className="spin" /><p className="muted">Loading your profile…</p></div></main>
  if (stage === 'build') return <main className="solo">{error && <p className="error banner" onClick={() => setError('')}>{error}</p>}<ProfileBuilder initial={blankDraft} mode="onboard" location={location} requestLocation={requestLocation} onDone={finishBuild} saving={saving} /></main>
  if (!me) return null

  const newCount = matches.filter(m => m.status === 'open' && !m.lastMessage).length
  const inChat = tab === 'matches' && activeChat
  return (
    <div className={`app-shell${inChat ? ' in-chat' : ''}`}>
      <header className="topbar"><div className="brand">VIT PULSE <span>/ V9</span></div><div className="top-status"><span className="status-dot" /> {me.campusSignal === 'ON CAMPUS' ? 'ON CAMPUS' : 'ONLINE'}<button onClick={() => setTab('profile')} aria-label="Your profile"><Avatar name={me.name} photoURL={me.photoURL} hue={me.hue} size={28} /></button></div></header>
      <div className="app-body">
        <aside className="sidebar">
          <div className="subject-chip"><Avatar name={me.name} photoURL={me.photoURL} hue={me.hue} size={36} /><div><b>{me.name}</b><small>{me.archetypeCode} {me.archetype}</small></div></div>
          <nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => { setTab(id); setEditing(null); if (id !== 'matches') setChatId(null) }}><Icon size={17} />{label}{id === 'matches' && newCount > 0 && <i className="badge">{newCount}</i>}</button>)}</nav>
          <div className="sidebar-foot">{me.discoverable ? 'VISIBLE IN DISCOVERY' : 'HIDDEN FROM DISCOVERY'}<br />MODEL / V9.0</div>
        </aside>
        <main className="content">
          {error && <p className="error banner" onClick={() => setError('')} title="Dismiss">{error}</p>}
          {editing === 'profile' && <ProfileBuilder initial={me} mode="edit" location={location} requestLocation={requestLocation} onDone={d => finishBuild(d)} onCancel={() => setEditing(null)} saving={saving} />}
          {editing === 'quiz' && <Calibration onBack={() => setEditing(null)} onDone={a => finishBuild(me, a)} />}
          {!editing && tab === 'discover' && <Discover me={me} candidates={deck} onSwipe={handleSwipe} loading={loadingDeck} onRefresh={refreshDeck}
            note={candidates.length === 0 && useSamples && samplePool.length ? 'No other students have joined yet — showing SAMPLE profiles so you can try the flow. They are fictional and stay on this device.' : undefined} />}
          {!editing && tab === 'matches' && (activeChat
            ? <Chat me={me} match={activeChat} other={allProfiles[otherOf(activeChat, me.uid)]} messages={activeChat.sample ? sampleMsgs[activeChat.id] ?? [] : messages} onSend={handleSend} onBack={() => setChatId(null)} onUnmatch={handleUnmatch} />
            : <MatchList me={me} matches={matches} profiles={allProfiles} onOpen={setChatId} />)}
          {!editing && tab === 'profile' && <ProfileView me={me} onEdit={() => setEditing('profile')} onRetake={() => setEditing('quiz')} />}
          {!editing && tab === 'settings' && <SettingsPanel me={me} location={location} requestLocation={requestLocation} useSamples={useSamples} setUseSamples={setUseSamples}
            onToggleVisible={() => updateMe({ discoverable: !me.discoverable })} onHideLocation={() => { setLocation('HIDDEN'); updateMe({ campusSignal: 'HIDDEN' }) }}
            onResetSamples={() => { setSampleSwiped([]); setSampleMatches([]); setSampleMsgs({}) }} />}
        </main>
      </div>
      {celebrate && <MatchModal me={me} other={celebrate.other} onClose={() => setCelebrate(null)} onChat={() => { setTab('matches'); setChatId(celebrate.matchId); setCelebrate(null) }} />}
    </div>
  )
}

function ProfileView({ me, onEdit, onRetake }: { me: PublicProfile; onEdit: () => void; onRetake: () => void }) {
  return (
    <section className="profile-view">
      <div className="discover-head"><div><span className="panel-kicker">YOUR PROFILE</span><h2>How others <em>see you</em></h2></div><button className="secondary-button" onClick={onEdit}><Pencil size={14} /> Edit</button></div>
      <div className="preview-card">
        <Portrait name={me.name} photoURL={me.photoURL} hue={me.hue}><div className="card-overlay"><div className="card-title"><div><h3>{me.name}, {me.age}</h3><span>{me.program} · {me.year}</span></div></div></div></Portrait>
        <div className="preview-body">
          <span className="tag">{INTENT_LABEL[me.intent]}</span>
          <p>{me.bio}</p>
          {me.prompts.map(p => <div className="prompt-card" key={p.q}><small>{p.q}</small><b>{p.a}</b></div>)}
          <Chips items={me.interests} />
        </div>
      </div>
      <h4>Personality dossier <button className="link-button" onClick={onRetake}>Retake quiz</button></h4>
      <Dossier vector={me.vector} />
    </section>
  )
}

function SettingsPanel({ me, location, requestLocation, useSamples, setUseSamples, onToggleVisible, onHideLocation, onResetSamples }: {
  me: PublicProfile; location: string; requestLocation: () => void; useSamples: boolean; setUseSamples: (v: boolean) => void
  onToggleVisible: () => void; onHideLocation: () => void; onResetSamples: () => void
}) {
  return (
    <section className="panel">
      <span className="panel-kicker">SETTINGS</span><h2>Privacy &amp; <em>account</em></h2>
      <div className="setting"><div><b>Show me in Discover</b><span>Turn off to pause. Existing matches and chats stay open.</span></div><button className={`toggle${me.discoverable ? ' on' : ''}`} onClick={onToggleVisible} aria-pressed={me.discoverable}><i /></button></div>
      <div className="setting"><div><b>Campus signal</b><span>Currently: {me.campusSignal}. Only on/near/off campus is shown — precise coordinates stay in your private record.</span></div>{me.campusSignal === 'HIDDEN' || location === 'NOT REQUESTED' ? <button className="secondary-button" onClick={requestLocation}>Update</button> : <button className="secondary-button" onClick={onHideLocation}>Hide</button>}</div>
      <div className="setting"><div><b>Preview with sample profiles</b><span>Fictional profiles for trying the app before your friends join. Never stored in Firestore.</span></div><button className={`toggle${useSamples ? ' on' : ''}`} onClick={() => setUseSamples(!useSamples)} aria-pressed={useSamples}><i /></button></div>
      <div className="setting"><div><b>Reset sample deck</b><span>Clears sample swipes, matches and chats on this device.</span></div><button className="secondary-button" onClick={onResetSamples}>Reset</button></div>
      <div className="setting"><div><b>Sign out</b><span>Your profile stays saved to your Google account.</span></div><button className="secondary-button" onClick={() => signOut()}><LogOut size={14} /> Sign out</button></div>
    </section>
  )
}
