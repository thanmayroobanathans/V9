'use client'

import {
  addDoc, collection, deleteField, doc, getDoc, getDocs, limit, limitToLast, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Jung } from './jung'
import type { Nature } from './nature'

export const MODEL_VERSION = 'V9.3'

export type Gender = 'woman' | 'man' | 'nonbinary'
export type Seeking = 'women' | 'men' | 'everyone'
export type Intent = 'long-term' | 'casual' | 'friends' | 'open'
export type PromptAnswer = { q: string; a: string }
export type Swipe = 'like' | 'super' | 'pass'

/** Everything another signed-in student may see. No email, no coordinates. */
export type Person = {
  uid: string
  name: string
  age: number
  gender: Gender
  seeking: Seeking
  intent: Intent
  program: string
  year: string
  bio: string
  status: string
  interests: string[]
  openTo: string[]
  prompts: PromptAnswer[]
  photoURL: string | null
  hue: number
  archetype: string
  archetypeCode: string
  /** 11 traits estimated by the Kalman filter over the 36 answers (0…1). */
  vector: number[]
  /** How settled the estimate is (0…1) and how self-consistent the answers were (0…1). */
  certainty?: number
  consistency?: number
  jung: Jung
  /** Lifestyle features learned on-device from Kalman-smoothed location. Never coordinates. */
  nature: Nature | null
  /** ~1.2 km area code, used only inside the match score. Never displayed. */
  area: string | null
  activeAt: number
  visible: boolean
  sample?: boolean
}

export type Match = { id: string; memberUids: string[]; members: Record<string, { name: string; photoURL: string | null; hue: number }>; lastMessage: string; lastSender: string; lastAt: number; status: 'open' | 'closed'; sample?: boolean }
export type Message = { id: string; senderUid: string; text: string; at: number; pending?: boolean }

export const INTERESTS = ['Coding', 'Hackathons', 'Music', 'Gym', 'Badminton', 'Cricket', 'Football', 'Photography', 'Anime', 'Movies', 'Gaming', 'Reading', 'Startups', 'Dance', 'Travel', 'Cooking', 'Chai', 'Coffee', 'Art', 'Poetry', 'Debate', 'Robotics', 'Fashion', 'Night walks', 'K-drama', 'Podcasts', 'Volunteering', 'Riviera']
export const OPEN_TO = ['Study buddy', 'Food runs', 'Sports', 'Project team', 'Exploring campus', 'Just chatting', 'Jam session', 'Gaming']
export const PROMPTS = ['A perfect Sunday on campus looks like…', 'My most irrational fear is…', 'The way to win me over is…', 'I geek out on…', 'Green flags I look for…', 'We will get along if…', 'My go-to Foodys order is…', 'Two truths and a lie…']
export const INTENT_LABEL: Record<Intent, string> = { 'long-term': 'Something long-term', casual: 'Something casual', friends: 'New friends', open: 'Open to see' }

export const ACTIVE_MS = 30 * 60 * 1000
export const isActive = (p: Pick<Person, 'activeAt'>) => !!p.activeAt && Date.now() - p.activeAt < ACTIVE_MS
export function genderMatches(me: Pick<Person, 'seeking' | 'gender'>, other: Pick<Person, 'seeking' | 'gender'>) {
  const wants = (s: Seeking, g: Gender) => s === 'everyone' || (s === 'women' && g === 'woman') || (s === 'men' && g === 'man')
  return wants(me.seeking, other.gender) && wants(other.seeking, me.gender)
}

// ---------------------------------------------------------------------------
// Firestore
// ---------------------------------------------------------------------------
export const pairId = (a: string, b: string) => [a, b].sort().join('_')
const need = () => { if (!db) throw new Error('Firestore is unavailable'); return db }
const ms = (t: unknown) => (t && typeof t === 'object' && 'toMillis' in t ? (t as { toMillis: () => number }).toMillis() : typeof t === 'number' ? t : Date.now())
const toPerson = (id: string, v: Record<string, unknown>): Person => ({ ...(v as unknown as Person), uid: id, activeAt: ms(v.activeAt ?? v.locAt ?? 0), nature: (v.nature as Nature) ?? null, area: (v.area as string) ?? null })

// ---- profiles ----
export async function loadPerson(uid: string) {
  const snap = await getDoc(doc(need(), 'publicProfiles', uid))
  return snap.exists() ? toPerson(uid, snap.data()) : null
}
export async function savePerson(p: Person) {
  const { sample: _s, ...data } = p
  // Older versions stored a coarse `loc`; remove it so no coordinates remain in public profiles.
  await setDoc(doc(need(), 'publicProfiles', p.uid), { ...data, loc: deleteField(), locAt: deleteField(), placeId: deleteField(), modelVersion: MODEL_VERSION, updatedAt: serverTimestamp() }, { merge: true })
}
/** Publishes the derived lifestyle signals (never coordinates). */
export async function updateSignals(uid: string, area: string | null, nature: Nature | null) {
  await updateDoc(doc(need(), 'publicProfiles', uid), { area, nature, activeAt: Date.now() })
}
export function watchPeople(cb: (p: Person[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(need(), 'publicProfiles'), where('visible', '==', true), limit(500)), s => cb(s.docs.map(d => toPerson(d.id, d.data()))), onError)
}

// ---- swipes & matches ----
export async function loadMySwipes(uid: string) {
  const s = await getDocs(query(collection(need(), 'connections'), where('fromUid', '==', uid)))
  return s.docs.map(d => d.data().toUid as string)
}
/** Records a swipe. Returns the match id if this completes a mutual like. */
export async function swipe(me: Person, them: Person, kind: Swipe): Promise<string | null> {
  const d = need()
  await setDoc(doc(d, 'connections', `${me.uid}_${them.uid}`), { fromUid: me.uid, toUid: them.uid, type: kind, createdAt: serverTimestamp() })
  if (kind === 'pass') return null
  const back = await getDoc(doc(d, 'connections', `${them.uid}_${me.uid}`))
  if (!back.exists() || back.data().type === 'pass') return null
  const id = pairId(me.uid, them.uid), ref = doc(d, 'matches', id)
  const existing = await getDoc(ref).catch(() => null)
  if (!existing?.exists()) {
    await setDoc(ref, {
      memberUids: [me.uid, them.uid].sort(),
      members: { [me.uid]: { name: me.name, photoURL: me.photoURL, hue: me.hue }, [them.uid]: { name: them.name, photoURL: them.photoURL, hue: them.hue } },
      status: 'open', createdAt: serverTimestamp(), lastAt: serverTimestamp(), lastMessage: '', lastSender: '',
    }).catch(async e => { if (!(await getDoc(ref)).exists()) throw e }) // the other person may have created it a moment earlier
  }
  return id
}
/**
 * Live list of every conversation I'm in. Each match document carries the latest message
 * preview and its sender, so one listener is enough to notice new messages in ALL threads at
 * once — if A and B both message C, C's listener fires for both.
 */
export function watchMatches(uid: string, cb: (m: Match[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(need(), 'matches'), where('memberUids', 'array-contains', uid)), s =>
    cb(s.docs.map(x => { const v = x.data({ serverTimestamps: 'estimate' }); return { id: x.id, memberUids: v.memberUids, members: v.members, lastMessage: v.lastMessage ?? '', lastSender: v.lastSender ?? '', lastAt: ms(v.lastAt), status: v.status ?? 'open' } })), onError)
}
export async function unmatch(matchId: string) {
  await updateDoc(doc(need(), 'matches', matchId), { status: 'closed', lastAt: serverTimestamp() })
}

// ---- messages ----
/**
 * Each message is its own document under matches/{pairId}/messages with an auto id, so any
 * number of people can message each other simultaneously without write contention: every
 * conversation is a separate document path. With 100 people online, each pair writes to its own
 * thread; the per-thread preview update is one small write per message.
 * Firestore's offline cache queues messages sent without signal and delivers them on reconnect.
 */
export async function sendMessage(matchId: string, uid: string, text: string) {
  const d = need()
  await addDoc(collection(d, 'matches', matchId, 'messages'), { senderUid: uid, text, createdAt: serverTimestamp() })
  await updateDoc(doc(d, 'matches', matchId), { lastMessage: text.slice(0, 120), lastSender: uid, lastAt: serverTimestamp() })
}
/** Live tail of a thread. Raise `count` to page further back. */
export function watchMessages(matchId: string, count: number, cb: (m: Message[], hasMore: boolean) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(need(), 'matches', matchId, 'messages'), orderBy('createdAt', 'asc'), limitToLast(count)), { includeMetadataChanges: true }, s =>
    cb(s.docs.map(d => { const v = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, senderUid: v.senderUid, text: v.text, at: ms(v.createdAt), pending: d.metadata.hasPendingWrites } }), s.size >= count), onError)
}
