'use client'

import {
  addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'

export const MODEL_VERSION = 'V9.1'

export type Coarse = { lat: number; lng: number }

/** Everything another signed-in student may see. Never contains email or precise coordinates. */
export type Person = {
  uid: string
  name: string
  program: string
  year: string
  bio: string
  status: string
  interests: string[]
  openTo: string[]
  photoURL: string | null
  hue: number
  archetype: string
  archetypeCode: string
  vector: number[]
  /** Rounded to 3 decimals (~110 m). Null when the person hides their location. */
  loc: Coarse | null
  locAt: number
  placeId: string | null
  visible: boolean
  sample?: boolean
}

export type Place = { id: string; name: string; emoji: string; loc: Coarse; createdBy: string; sample?: boolean }
export type Chat = { id: string; memberUids: string[]; members: Record<string, { name: string; photoURL: string | null; hue: number }>; lastMessage: string; lastAt: number; sample?: boolean }
export type Message = { id: string; senderUid: string; senderName?: string; text: string; at: number }

export const INTERESTS = ['Coding', 'Hackathons', 'Music', 'Gym', 'Badminton', 'Cricket', 'Football', 'Photography', 'Anime', 'Movies', 'Gaming', 'Reading', 'Startups', 'Dance', 'Travel', 'Cooking', 'Chai', 'Coffee', 'Art', 'Poetry', 'Debate', 'Robotics', 'Fashion', 'Night walks', 'K-drama', 'Podcasts', 'Volunteering', 'Riviera']
export const OPEN_TO = ['Study buddy', 'Food runs', 'Sports', 'Project team', 'Exploring campus', 'Just chatting', 'Jam session', 'Gaming']
export const PLACE_EMOJI = ['📚', '☕', '🍜', '🏸', '⚽', '🎸', '🌳', '💻', '🎨', '🧪', '🏛️', '🌅']

// ---------------------------------------------------------------------------
// Location helpers
// ---------------------------------------------------------------------------
export const coarsen = (lat: number, lng: number): Coarse => ({ lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000 })
export function metres(a: Coarse, b: Coarse) {
  const R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
/** Bearing in degrees, 0 = north. */
export function bearing(a: Coarse, b: Coarse) {
  const r = Math.PI / 180, y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r)
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r)
  return (Math.atan2(y, x) / r + 360) % 360
}
/** Deliberately fuzzy: locations are only ~110 m accurate, so never claim more. */
export function distanceLabel(m: number | null) {
  if (m === null) return 'Location hidden'
  if (m < 150) return 'Right here'
  if (m < 400) return '~5 min walk'
  if (m < 1000) return `~${Math.round(m / 100) * 100} m away`
  if (m < 10000) return `~${(m / 1000).toFixed(1)} km away`
  return 'Far away'
}
export const ACTIVE_MS = 30 * 60 * 1000
export const isActive = (p: Person) => !!p.locAt && Date.now() - p.locAt < ACTIVE_MS
export function lastSeen(p: Person) {
  if (!p.locAt) return ''
  const m = Math.round((Date.now() - p.locAt) / 60000)
  return m < 2 ? 'active now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`
}

// ---------------------------------------------------------------------------
// Firestore
// ---------------------------------------------------------------------------
export const pairId = (a: string, b: string) => [a, b].sort().join('_')
const need = () => { if (!db) throw new Error('Firestore is unavailable'); return db }
const ms = (t: unknown) => (t && typeof t === 'object' && 'toMillis' in t ? (t as { toMillis: () => number }).toMillis() : typeof t === 'number' ? t : Date.now())
const toPerson = (id: string, v: Record<string, unknown>) => ({ ...(v as unknown as Person), uid: id, locAt: ms(v.locAt), placeId: (v.placeId as string) ?? null, loc: (v.loc as Coarse) ?? null })

export async function loadPerson(uid: string) {
  const snap = await getDoc(doc(need(), 'publicProfiles', uid))
  return snap.exists() ? toPerson(uid, snap.data()) : null
}

export async function savePerson(p: Person) {
  const { sample: _s, ...data } = p
  await setDoc(doc(need(), 'publicProfiles', p.uid), { ...data, modelVersion: MODEL_VERSION, updatedAt: serverTimestamp() }, { merge: true })
}

export async function updateLocation(uid: string, loc: Coarse | null, placeId: string | null) {
  await updateDoc(doc(need(), 'publicProfiles', uid), { loc, placeId, locAt: Date.now() })
}

export function watchPeople(cb: (p: Person[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(need(), 'publicProfiles'), where('visible', '==', true), limit(300)), s => cb(s.docs.map(d => toPerson(d.id, d.data()))), onError)
}

// ---- direct chats ----
export async function openChat(me: Person, them: Pick<Person, 'uid' | 'name' | 'photoURL' | 'hue'>) {
  const id = pairId(me.uid, them.uid), ref = doc(need(), 'chats', id)
  const snap = await getDoc(ref).catch(() => null)
  if (!snap?.exists()) {
    await setDoc(ref, {
      memberUids: [me.uid, them.uid].sort(),
      members: { [me.uid]: { name: me.name, photoURL: me.photoURL, hue: me.hue }, [them.uid]: { name: them.name, photoURL: them.photoURL, hue: them.hue } },
      lastMessage: '', lastAt: serverTimestamp(), createdAt: serverTimestamp(),
    }).catch(async e => { if (!(await getDoc(ref)).exists()) throw e })
  }
  return id
}
export function watchChats(uid: string, cb: (c: Chat[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(need(), 'chats'), where('memberUids', 'array-contains', uid)), s =>
    cb(s.docs.map(d => { const v = d.data(); return { id: d.id, memberUids: v.memberUids, members: v.members, lastMessage: v.lastMessage ?? '', lastAt: ms(v.lastAt) } })), onError)
}
export async function sendChatMessage(chatId: string, uid: string, text: string) {
  const d = need()
  await addDoc(collection(d, 'chats', chatId, 'messages'), { senderUid: uid, text, createdAt: serverTimestamp() })
  await updateDoc(doc(d, 'chats', chatId), { lastMessage: text.slice(0, 120), lastAt: serverTimestamp() })
}

// ---- places (hangout spots) ----
export async function loadPlaces() {
  const s = await getDocs(query(collection(need(), 'places'), limit(300)))
  return s.docs.map(d => ({ ...(d.data() as Place), id: d.id }))
}
export async function createPlace(uid: string, name: string, emoji: string, loc: Coarse) {
  const ref = await addDoc(collection(need(), 'places'), { name, emoji, loc, createdBy: uid, createdAt: serverTimestamp() })
  return { id: ref.id, name, emoji, loc, createdBy: uid } as Place
}
export async function sendPlaceMessage(placeId: string, uid: string, senderName: string, text: string) {
  await addDoc(collection(need(), 'places', placeId, 'messages'), { senderUid: uid, senderName, text, createdAt: serverTimestamp() })
}

/** Shared by direct chats and place rooms. */
export function watchMessages(path: ['chats' | 'places', string], cb: (m: Message[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(need(), path[0], path[1], 'messages'), orderBy('createdAt', 'asc'), limit(300)), s =>
    cb(s.docs.map(d => { const v = d.data(); return { id: d.id, senderUid: v.senderUid, senderName: v.senderName, text: v.text, at: ms(v.createdAt) } })), onError)
}
