'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { ArrowRight, Compass, LockKeyhole, LogOut, MapPin, MessageSquare, Pencil, RefreshCw, Settings, UserRound, Users } from 'lucide-react'
import { auth, firebaseConfigured, signInWithGoogle, signOut } from '@/lib/firebase'
import { classify, compatibility, scoreAnswers } from '@/lib/pulse-model'
import { saveProfile, saveResult } from '@/lib/firestore'
import {
  coarsen, createPlace, distanceLabel, loadPerson, loadPlaces, metres, openChat, savePerson, sendChatMessage, sendPlaceMessage,
  updateLocation, watchChats, watchMessages, watchPeople, type Chat, type Coarse, type Message, type Person, type Place,
} from '@/lib/social'
import { DEFAULT_ANCHOR, samplePeople, samplePlaces, sampleReply } from '@/lib/samples'
import { Calibration, Dossier, ProfileBuilder, type Draft } from '@/components/pulse/onboarding'
import { Explore, PersonSheet } from '@/components/pulse/explore'
import { Places, CHECKIN_M } from '@/components/pulse/places'
import { ChatList, ChatView, directStarters, otherOf } from '@/components/pulse/chat'
import { Avatar, Chips, Ring } from '@/components/pulse/ui'

type Tab = 'explore' | 'places' | 'chats' | 'profile' | 'settings'
type Stage = 'gate' | 'loading' | 'build' | 'app'
type Geo = 'off' | 'asking' | 'on' | 'denied'

const nav = [{ id: 'explore', label: 'Explore', icon: Compass }, { id: 'places', label: 'Places', icon: MapPin }, { id: 'chats', label: 'Chats', icon: MessageSquare }, { id: 'profile', label: 'Profile', icon: UserRound }, { id: 'settings', label: 'Settings', icon: Settings }] as const
const LOC_WRITE_MS = 2 * 60 * 1000

function useLocal<T>(key: string, init: T): [T, (v: T | ((x: T) => T)) => void] {
  const [v, setV] = useState<T>(init)
  useEffect(() => { try { const s = localStorage.getItem(key); setV(s ? JSON.parse(s) : init) } catch { /* ignore */ } }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((x: T | ((p: T) => T)) => setV(p => { const n = typeof x === 'function' ? (x as (p: T) => T)(p) : x; try { localStorage.setItem(key, JSON.stringify(n)) } catch { /* ignore */ } return n }), [key])
  return [v, set]
}

export default function Page() {
  const [user, setUser] = useState<User | null>(null)
  const [stage, setStage] = useState<Stage>('gate')
  const [tab, setTab] = useState<Tab>('explore')
  const [me, setMe] = useState<Person | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<'profile' | 'quiz' | null>(null)

  const uid = user?.uid ?? 'anon'
  const [wantLocation, setWantLocation] = useLocal(`pulse91.loc.${uid}`, false)
  const [geo, setGeo] = useState<Geo>('off')
  const [here, setHere] = useState<Coarse | null>(null)
  const lastWrite = useRef<{ at: number; key: string }>({ at: 0, key: '' })

  const [people, setPeople] = useState<Person[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [chats, setChats] = useState<Chat[]>([])
  const [sheet, setSheet] = useState<Person | null>(null)
  const [chatId, setChatId] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  const [useSamples, setUseSamples] = useLocal(`pulse91.samples.${uid}`, true)
  const [sampleChats, setSampleChats] = useLocal<Chat[]>(`pulse91.sampleChats.${uid}`, [])
  const [sampleMsgs, setSampleMsgs] = useLocal<Record<string, Message[]>>(`pulse91.sampleMsgs.${uid}`, {})
  const [sampleHere, setSampleHere] = useLocal<string | null>(`pulse91.sampleHere.${uid}`, null)

  // ---------- auth + profile bootstrap ----------
  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, async u => {
      setUser(u)
      if (!u) { setStage('gate'); setMe(null); return }
      setStage('loading')
      try { const p = await loadPerson(u.uid); if (p?.vector?.length && p.openTo) { setMe(p); setStage('app') } else setStage('build') }
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
      }
      setError(msg[code] ?? `Sign-in failed${code ? ` (${code})` : ''}`)
    }
  }

  // ---------- live location ----------
  useEffect(() => {
    if (!wantLocation || !user) { setGeo('off'); setHere(null); return }
    if (!navigator.geolocation) { setGeo('denied'); return }
    setGeo('asking')
    const id = navigator.geolocation.watchPosition(
      p => { setGeo('on'); setHere(coarsen(p.coords.latitude, p.coords.longitude)) },
      () => { setGeo('denied'); setHere(null) },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [wantLocation, user])

  // Publish the coarse location (and drop a check-in once you walk away from it).
  useEffect(() => {
    if (!me || stage !== 'app') return
    let placeId = me.placeId
    const pl = places.find(x => x.id === placeId)
    if (here && pl && metres(here, pl.loc) > CHECKIN_M * 2) placeId = null
    const key = `${here?.lat},${here?.lng},${placeId}`
    if (key === lastWrite.current.key && Date.now() - lastWrite.current.at < LOC_WRITE_MS) return
    if (!here && !me.loc && key === lastWrite.current.key) return
    lastWrite.current = { at: Date.now(), key }
    setMe(m => m ? { ...m, loc: here, placeId, locAt: Date.now() } : m)
    updateLocation(me.uid, here, placeId).catch(e => setError(`Location not shared — ${e.message}`))
  }, [here, me?.placeId, places, stage]) // eslint-disable-line react-hooks/exhaustive-deps

  function requestLocation() { setWantLocation(true) }

  // ---------- profile ----------
  const blankDraft = useMemo<Draft>(() => ({
    uid: user?.uid ?? '', name: user?.displayName?.split(' ')[0] ?? '', program: '', year: '2nd year', bio: '', status: '',
    interests: [], openTo: [], photoURL: user?.photoURL ?? null, hue: 210, loc: null, locAt: 0, placeId: null, visible: true,
  }), [user])

  async function persist(p: Person, answers?: number[]) {
    if (!user) return
    setSaving(true); setError('')
    try {
      await saveProfile(user.uid, { subjectName: p.name, email: user.email, locationSignal: p.loc ? 'SHARED (~110 m)' : 'OFF', locationConsent: !!p.loc })
      if (answers) {
        const c = classify(p.vector)
        await saveResult(user.uid, { subjectName: p.name, archetype: c.primary.name, archetypeCode: c.primary.code, matchScore: c.primary.score, personalityVector: p.vector, rankedArchetypes: c.ranked.slice(0, 8).map(r => ({ name: r.name, code: r.code, score: Math.round(r.score * 1000) / 10 })), locationSignal: p.loc ? 'SHARED' : 'OFF' })
      }
      await savePerson(p)
    } catch (e) { setError(`Saved on this device only — ${e instanceof Error ? e.message : 'Firestore write failed'}. Check firestore.rules are deployed.`) }
    finally { setSaving(false) }
  }
  async function finishBuild(d: Draft, answers?: number[]) {
    const vector = answers ? scoreAnswers(answers) : (me?.vector ?? d.vector ?? [])
    const c = classify(vector).primary
    const p: Person = { ...d, uid: user!.uid, vector, archetype: c.name, archetypeCode: c.code, loc: here, locAt: Date.now() }
    setMe(p); setEditing(null)
    if (stage === 'build') { setStage('app'); setTab('explore') }
    await persist(p, answers)
  }
  async function updateMe(patch: Partial<Person>) { if (!me) return; const p = { ...me, ...patch }; setMe(p); await persist(p) }

  // ---------- realtime data ----------
  const refreshPlaces = useCallback(() => { loadPlaces().then(setPlaces).catch(e => setError(`Places unavailable — ${e.message}`)) }, [])
  useEffect(() => {
    if (stage !== 'app' || !user) return
    refreshPlaces()
    const a = watchPeople(setPeople, e => setError(`Explore unavailable — ${e.message}`))
    const b = watchChats(user.uid, setChats, e => setError(`Chats unavailable — ${e.message}`))
    return () => { a(); b() }
  }, [stage, user, refreshPlaces])

  const anchor = here ?? DEFAULT_ANCHOR
  const sPeople = useMemo(() => useSamples ? samplePeople(anchor) : [], [useSamples, anchor.lat, anchor.lng]) // eslint-disable-line react-hooks/exhaustive-deps
  const sPlaces = useMemo(() => useSamples ? samplePlaces(anchor) : [], [useSamples, anchor.lat, anchor.lng]) // eslint-disable-line react-hooks/exhaustive-deps
  const realOthers = people.filter(p => p.uid !== me?.uid)
  const allPeople = useMemo(() => [...realOthers, ...sPeople], [realOthers, sPeople]) // eslint-disable-line react-hooks/exhaustive-deps
  const allPlaces = useMemo(() => [...places, ...sPlaces], [places, sPlaces])
  const byUid = useMemo(() => Object.fromEntries(allPeople.map(p => [p.uid, p])), [allPeople])
  const meView = me && useSamples && sampleHere ? { ...me, placeId: sampleHere } : me
  const allChats = useMemo(() => [...chats, ...(useSamples ? sampleChats.map(c => { const l = sampleMsgs[c.id] ?? []; const last = l[l.length - 1]; return { ...c, lastMessage: last?.text ?? '', lastAt: last?.at ?? c.lastAt } }) : [])], [chats, sampleChats, sampleMsgs, useSamples])

  const activeChat = allChats.find(c => c.id === chatId) ?? null
  const activeRoom = allPlaces.find(p => p.id === roomId) ?? null
  useEffect(() => {
    setMessages([])
    if (activeChat && !activeChat.sample) return watchMessages(['chats', activeChat.id], setMessages, e => setError(`Chat unavailable — ${e.message}`))
    if (activeRoom && !activeRoom.sample) return watchMessages(['places', activeRoom.id], setMessages, e => setError(`Room unavailable — ${e.message}`))
  }, [activeChat?.id, activeRoom?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- actions ----------
  async function startChat(p: Person) {
    if (!me) return
    setSheet(null)
    if (p.sample) {
      const id = `sample-chat-${p.uid}`
      setSampleChats(cs => cs.some(c => c.id === id) ? cs : [...cs, { id, sample: true, memberUids: [me.uid, p.uid], lastMessage: '', lastAt: Date.now(), members: { [me.uid]: { name: me.name, photoURL: me.photoURL, hue: me.hue }, [p.uid]: { name: p.name, photoURL: null, hue: p.hue } } }])
      setTab('chats'); setRoomId(null); setChatId(id); return
    }
    try { const id = await openChat(me, p); setTab('chats'); setRoomId(null); setChatId(id) }
    catch (e) { setError(`Could not open chat — ${e instanceof Error ? e.message : 'write failed'}`) }
  }
  function localSend(key: string, text: string, replyFrom?: { uid: string; name: string }) {
    if (!me) return
    const now = Date.now()
    setSampleMsgs(x => ({ ...x, [key]: [...(x[key] ?? []), { id: `${now}`, senderUid: me.uid, senderName: me.name, text, at: now }] }))
    if (replyFrom) setTimeout(() => setSampleMsgs(x => { const l = x[key] ?? []; const n = l.filter(m => m.senderUid === replyFrom.uid).length; return { ...x, [key]: [...l, { id: `${Date.now()}r`, senderUid: replyFrom.uid, senderName: replyFrom.name, text: sampleReply(n), at: Date.now() }] } }), 1400)
  }
  async function sendDirect(text: string) {
    if (!activeChat || !me) return
    if (activeChat.sample) { const o = otherOf(activeChat, me.uid); return localSend(activeChat.id, text, { uid: o, name: activeChat.members[o]?.name }) }
    try { await sendChatMessage(activeChat.id, me.uid, text) } catch (e) { setError(`Message not sent — ${e instanceof Error ? e.message : 'write failed'}`) }
  }
  async function sendRoom(text: string) {
    if (!activeRoom || !me) return
    if (activeRoom.sample) { const p = sPeople.find(x => x.placeId === activeRoom.id); return localSend(activeRoom.id, text, p ? { uid: p.uid, name: p.name } : undefined) }
    try { await sendPlaceMessage(activeRoom.id, me.uid, me.name, text) } catch (e) { setError(`Message not sent — ${e instanceof Error ? e.message : 'write failed'}`) }
  }
  async function checkIn(id: string | null) {
    if (!me) return
    if (id?.startsWith('sample-') || (id === null && sampleHere)) { setSampleHere(id); if (id) return }
    lastWrite.current.key = ''
    setMe(m => m ? { ...m, placeId: id } : m)
  }
  async function addPlace(name: string, emoji: string) {
    if (!me || !here) return
    try { const pl = await createPlace(me.uid, name, emoji, here); setPlaces(ps => [...ps, pl]); setSampleHere(null); checkIn(pl.id) }
    catch (e) { setError(`Could not add spot — ${e instanceof Error ? e.message : 'write failed'}`) }
  }

  // ---------- render ----------
  if (stage === 'gate') return (
    <main className="gate">
      <div className="gate-glow" />
      <div className="gate-inner">
        <div className="eyebrow"><span className="status-dot" /> VIT PULSE / V9</div>
        <h1>See who&apos;s around.<br /><em>Say hi.</em></h1>
        <p className="muted">Explore students and hangout spots near you on campus, and chat with anyone — matched by a 36-question vibe quiz.</p>
        <div className="gate-points"><span><MapPin size={14} /> Live radar of people nearby</span><span><Users size={14} /> Check in to spots, join their chat rooms</span><span><LockKeyhole size={14} /> Location rounded to ~100 m, never exact</span></div>
        <button className="primary-button wide" onClick={login}><LockKeyhole size={16} /> Continue with Google <ArrowRight size={16} /></button>
        {!firebaseConfigured && <p className="config-note">Firebase configuration required.</p>}
        {error && <p className="error">{error}</p>}
        <div className="gate-footer"><span>VIT students</span><span>V9.1</span></div>
      </div>
    </main>
  )
  if (stage === 'loading') return <main className="gate"><div className="gate-inner center"><RefreshCw className="spin" /><p className="muted">Loading your profile…</p></div></main>
  if (stage === 'build') return <main className="solo">{error && <p className="error banner" onClick={() => setError('')}>{error}</p>}<ProfileBuilder initial={blankDraft} mode="onboard" locationOn={geo === 'on' || geo === 'asking'} requestLocation={requestLocation} onDone={finishBuild} saving={saving} /></main>
  if (!me || !meView) return null

  const inChat = (tab === 'chats' && activeChat) || (tab === 'places' && activeRoom)
  const chatOther = activeChat ? byUid[otherOf(activeChat, me.uid)] : undefined
  const roomPeople = activeRoom ? allPeople.filter(p => p.placeId === activeRoom.id) : []
  const go = (t: Tab) => { setTab(t); setEditing(null); setChatId(null); setRoomId(null) }
  const sampleNote = realOthers.length === 0 && useSamples ? 'No other students are online yet — showing SAMPLE people and spots around you so you can try things out. They are fictional and stay on this device.' : undefined

  return (
    <div className={`app-shell${inChat ? ' in-chat' : ''}`}>
      <header className="topbar"><div className="brand">VIT PULSE <span>/ V9</span></div><div className="top-status"><span className={`status-dot${geo === 'on' ? '' : ' off'}`} /> {geo === 'on' ? 'LOCATION ON' : geo === 'asking' ? 'LOCATING…' : geo === 'denied' ? 'LOCATION BLOCKED' : 'LOCATION OFF'}<button onClick={() => go('profile')} aria-label="Your profile"><Avatar name={me.name} photoURL={me.photoURL} hue={me.hue} size={28} /></button></div></header>
      <div className="app-body">
        <aside className="sidebar">
          <div className="subject-chip"><Avatar name={me.name} photoURL={me.photoURL} hue={me.hue} size={36} /><div><b>{me.name}</b><small>{me.archetypeCode} {me.archetype}</small></div></div>
          <nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => go(id)}><Icon size={17} />{label}</button>)}</nav>
          <div className="sidebar-foot">{me.visible ? 'VISIBLE ON EXPLORE' : 'HIDDEN FROM EXPLORE'}<br />V9.1 · EXPLORE + CHAT</div>
        </aside>
        <main className="content">
          {error && <p className="error banner" onClick={() => setError('')} title="Dismiss">{error}</p>}
          {editing === 'profile' && <ProfileBuilder initial={me} mode="edit" locationOn={geo === 'on'} requestLocation={requestLocation} onDone={d => finishBuild(d)} onCancel={() => setEditing(null)} saving={saving} />}
          {editing === 'quiz' && <Calibration onBack={() => setEditing(null)} onDone={a => finishBuild(me, a)} />}

          {!editing && tab === 'explore' && <Explore me={meView} here={here} people={allPeople} places={allPlaces} onOpen={setSheet} note={sampleNote} />}

          {!editing && tab === 'places' && (activeRoom
            ? <ChatView meUid={me.uid} messages={activeRoom.sample ? sampleMsgs[activeRoom.id] ?? [] : messages} onSend={sendRoom} onBack={() => setRoomId(null)} showNames placeholder={`Message everyone at ${activeRoom.name}`}
                header={<><span className="room-emoji">{activeRoom.emoji}</span><div><b>{activeRoom.name}</b><small>{distanceLabel(here ? metres(here, activeRoom.loc) : null)} · {roomPeople.length} here now{activeRoom.sample ? ' · SAMPLE' : ''}</small></div></>}
                empty={<><span className="room-emoji big">{activeRoom.emoji}</span><b>{activeRoom.name} room</b><span className="muted">Anyone on Pulse can read and post here. Say what you&apos;re up to!</span></>}
                starters={['Anyone here right now?', 'Is it crowded at the moment?', 'Saving a seat — who wants to join?']} />
            : <Places me={meView} here={here} places={allPlaces} people={[...allPeople, meView]} onOpenRoom={id => { setChatId(null); setRoomId(id) }} onCheckIn={checkIn} onCreate={addPlace} />)}

          {!editing && tab === 'chats' && (activeChat
            ? <ChatView meUid={me.uid} messages={activeChat.sample ? sampleMsgs[activeChat.id] ?? [] : messages} onSend={sendDirect} onBack={() => setChatId(null)} placeholder={`Message ${activeChat.members[otherOf(activeChat, me.uid)]?.name ?? ''}`}
                header={(() => { const o = activeChat.members[otherOf(activeChat, me.uid)]; return <><Avatar name={o?.name} photoURL={o?.photoURL} hue={o?.hue ?? 0} size={38} /><button className="chat-title" onClick={() => chatOther && setSheet(chatOther)}><b>{o?.name}</b><small>{chatOther ? `${chatOther.program} · ${distanceLabel(here && chatOther.loc ? metres(here, chatOther.loc) : null)}` : 'Chat'}{activeChat.sample ? ' · SAMPLE' : ''}</small></button>{chatOther && <Ring value={compatibility(me.vector, chatOther.vector)} size={40} />}</> })()}
                empty={<><b>Start the conversation</b><span className="muted">Pulse picked these openers from what you have in common:</span></>}
                starters={directStarters(me, chatOther)} />
            : <ChatList me={me} chats={allChats} people={byUid} onOpen={id => { setRoomId(null); setChatId(id) }} />)}

          {!editing && tab === 'profile' && (
            <section className="profile-view">
              <div className="discover-head"><div><span className="panel-kicker">YOUR PROFILE</span><h2>How others <em>see you</em></h2></div><button className="secondary-button" onClick={() => setEditing('profile')}><Pencil size={14} /> Edit</button></div>
              <div className="sheet inline">
                <div className="sheet-head"><Avatar name={me.name} photoURL={me.photoURL} hue={me.hue} size={72} ring /><div><h3>{me.name}</h3><span>{me.program} · {me.year}</span><small className="where"><MapPin size={12} /> {me.loc ? 'Location shared (~100 m)' : 'Location hidden'}</small></div></div>
                {me.status && <div className="status-bubble">“{me.status}”</div>}
                {me.bio && <p>{me.bio}</p>}
                <h4>Open to</h4><Chips items={me.openTo} />
                <h4>Interests</h4><Chips items={me.interests} />
              </div>
              <h4>Vibe profile <button className="link-button" onClick={() => setEditing('quiz')}>Retake quiz</button></h4>
              <Dossier vector={me.vector} />
            </section>
          )}

          {!editing && tab === 'settings' && (
            <section className="panel">
              <span className="panel-kicker">SETTINGS</span><h2>Privacy &amp; <em>account</em></h2>
              <div className="setting"><div><b>Share my location</b><span>{geo === 'denied' ? 'Your browser blocked location. Allow it in the site settings, then turn this on again.' : 'Rounded to ~100 m and shown to others only as a rough distance. Updates while the app is open.'}</span></div><button className={`toggle${wantLocation ? ' on' : ''}`} onClick={() => { const v = !wantLocation; setWantLocation(v); if (!v) { setHere(null); updateLocation(me.uid, null, null).catch(() => {}); setMe({ ...me, loc: null, placeId: null }) } }} aria-pressed={wantLocation}><i /></button></div>
              <div className="setting"><div><b>Show me on Explore</b><span>Turn off to browse invisibly. Existing chats stay open.</span></div><button className={`toggle${me.visible ? ' on' : ''}`} onClick={() => updateMe({ visible: !me.visible })} aria-pressed={me.visible}><i /></button></div>
              <div className="setting"><div><b>Sample people &amp; spots</b><span>Fictional previews placed around you while campus is quiet. Never stored in Firestore.</span></div><button className={`toggle${useSamples ? ' on' : ''}`} onClick={() => setUseSamples(!useSamples)} aria-pressed={useSamples}><i /></button></div>
              <div className="setting"><div><b>Clear sample chats</b><span>Removes sample conversations and check-ins on this device.</span></div><button className="secondary-button" onClick={() => { setSampleChats([]); setSampleMsgs({}); setSampleHere(null) }}>Clear</button></div>
              <div className="setting"><div><b>Sign out</b><span>Your profile stays saved to your Google account.</span></div><button className="secondary-button" onClick={() => signOut()}><LogOut size={14} /> Sign out</button></div>
            </section>
          )}
        </main>
      </div>
      {sheet && <PersonSheet me={me} p={sheet} here={here} places={allPlaces} onClose={() => setSheet(null)} onChat={() => startChat(sheet)} />}
    </div>
  )
}

