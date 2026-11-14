'use client'

import {
  addDoc, collection, deleteDoc, deleteField, doc, getCountFromServer, getDoc, getDocs, limit, limitToLast, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch, type Unsubscribe,
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
  /** Unique handle, lowercase letters, numbers, dot and underscore. */
  username: string
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
  /** How settled the trait estimate is (0…1). */
  certainty?: number
  jung: Jung
  /** Lifestyle features learned on-device from Kalman-smoothed location. Never coordinates. */
  nature: Nature | null
  /** ~1.2 km area code, used only inside the match score. Never displayed. */
  area: string | null
  activeAt: number
  visible: boolean
  sample?: boolean
}

export type Match = { id: string; via?: 'swipe' | 'follow'; memberUids: string[]; members: Record<string, { name: string; photoURL: string | null; hue: number }>; lastMessage: string; lastSender: string; lastAt: number; status: 'open' | 'closed'; sample?: boolean }
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
const toPerson = (id: string, v: Record<string, unknown>): Person => ({ ...(v as unknown as Person), uid: id, username: (v.username as string) ?? '', activeAt: ms(v.activeAt ?? v.locAt ?? 0), nature: (v.nature as Nature) ?? null, area: (v.area as string) ?? null })

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
      via: 'swipe', status: 'open', createdAt: serverTimestamp(), lastAt: serverTimestamp(), lastMessage: '', lastSender: '',
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
    cb(s.docs.map(x => { const v = x.data({ serverTimestamps: 'estimate' }); return { id: x.id, via: v.via ?? 'swipe', memberUids: v.memberUids, members: v.members, lastMessage: v.lastMessage ?? '', lastSender: v.lastSender ?? '', lastAt: ms(v.lastAt), status: v.status ?? 'open' } })), onError)
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

// ---- learned taste (private: users/{uid}/preferences/matcher) ----
export async function loadTaste(uid: string) {
  const s = await getDoc(doc(need(), 'users', uid, 'preferences', 'matcher'))
  return s.exists() ? s.data() : null
}
export async function saveTaste(uid: string, packed: object) {
  await setDoc(doc(need(), 'users', uid, 'preferences', 'matcher'), { ...packed, updatedAt: serverTimestamp() })
}

// ---------------------------------------------------------------------------
// Usernames — usernames/{handle} → { uid }, claimed in a transaction so they stay unique.
// ---------------------------------------------------------------------------
export const USERNAME_RE = /^[a-z0-9._]{3,20}$/
export const normaliseUsername = (s: string) => s.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9._]/g, '').slice(0, 20)
export async function usernameOwner(handle: string) {
  const s = await getDoc(doc(need(), 'usernames', handle))
  return s.exists() ? (s.data().uid as string) : null
}
export async function claimUsername(uid: string, handle: string, previous?: string | null) {
  if (!USERNAME_RE.test(handle)) throw new Error('3–20 characters: a–z, 0–9, . or _')
  const d = need()
  await runTransaction(d, async tx => {
    const ref = doc(d, 'usernames', handle), cur = await tx.get(ref)
    if (cur.exists() && cur.data().uid !== uid) throw new Error('Username taken')
    if (!cur.exists()) tx.set(ref, { uid, createdAt: serverTimestamp() })
    if (previous && previous !== handle) tx.delete(doc(d, 'usernames', previous))
  })
}
/** Prefix search over usernames (case-insensitive, handles are stored lowercase). */
export async function searchPeople(prefix: string) {
  const p = normaliseUsername(prefix)
  if (p.length < 2) return []
  const s = await getDocs(query(collection(need(), 'publicProfiles'), where('username', '>=', p), where('username', '<=', p + '\uf8ff'), limit(20)))
  return s.docs.map(d => toPerson(d.id, d.data()))
}

// ---------------------------------------------------------------------------
// Follow requests — follows/{from}_{to}: pending → accepted. Accepting opens a chat.
// Follower / following lists are readable only by the two people involved.
// ---------------------------------------------------------------------------
export type Follow = { id: string; fromUid: string; toUid: string; status: 'pending' | 'accepted'; fromName: string; fromUsername: string; fromPhoto: string | null; fromHue: number; toName: string; toUsername: string; toPhoto: string | null; toHue: number; at: number }
const toFollow = (id: string, v: Record<string, unknown>): Follow => ({ id, fromUid: v.fromUid as string, toUid: v.toUid as string, status: v.status as Follow['status'], fromName: (v.fromName as string) ?? '', fromUsername: (v.fromUsername as string) ?? '', fromPhoto: (v.fromPhoto as string) ?? null, fromHue: (v.fromHue as number) ?? 200, toName: (v.toName as string) ?? '', toUsername: (v.toUsername as string) ?? '', toPhoto: (v.toPhoto as string) ?? null, toHue: (v.toHue as number) ?? 200, at: ms(v.createdAt) })

export async function requestFollow(me: Person, to: Person) {
  await setDoc(doc(need(), 'follows', `${me.uid}_${to.uid}`), {
    fromUid: me.uid, toUid: to.uid, status: 'pending', createdAt: serverTimestamp(),
    fromName: me.name, fromUsername: me.username, fromPhoto: me.photoURL, fromHue: me.hue,
    toName: to.name, toUsername: to.username, toPhoto: to.photoURL, toHue: to.hue,
  })
}
export async function cancelFollow(meUid: string, to: string) { await deleteDoc(doc(need(), 'follows', `${meUid}_${to}`)) }
export async function removeFollower(meUid: string, from: string) { await deleteDoc(doc(need(), 'follows', `${from}_${meUid}`)) }
/** Accept a request; both people can then chat (a chat thread is opened for them). */
export async function acceptFollow(me: Person, f: Follow) {
  const d = need()
  await updateDoc(doc(d, 'follows', f.id), { status: 'accepted', acceptedAt: serverTimestamp() })
  const id = pairId(me.uid, f.fromUid), ref = doc(d, 'matches', id)
  const existing = await getDoc(ref).catch(() => null)
  if (!existing?.exists()) {
    await setDoc(ref, {
      via: 'follow', memberUids: [me.uid, f.fromUid].sort(),
      members: { [me.uid]: { name: me.name, photoURL: me.photoURL, hue: me.hue }, [f.fromUid]: { name: f.fromName, photoURL: f.fromPhoto, hue: f.fromHue } },
      status: 'open', createdAt: serverTimestamp(), lastAt: serverTimestamp(), lastMessage: '', lastSender: '',
    }).catch(async e => { if (!(await getDoc(ref)).exists()) throw e })
  }
  return id
}
export function watchFollows(uid: string, cb: (incoming: Follow[], outgoing: Follow[]) => void, onError: (e: Error) => void): Unsubscribe {
  let inc: Follow[] = [], out: Follow[] = []
  const a = onSnapshot(query(collection(need(), 'follows'), where('toUid', '==', uid)), s => { inc = s.docs.map(d => toFollow(d.id, d.data())); cb(inc, out) }, onError)
  const b = onSnapshot(query(collection(need(), 'follows'), where('fromUid', '==', uid)), s => { out = s.docs.map(d => toFollow(d.id, d.data())); cb(inc, out) }, onError)
  return () => { a(); b() }
}

// ---------------------------------------------------------------------------
// Posts — users/{uid}/posts/{postId}; visible to the owner and accepted followers only.
// Likes — users/{uid}/posts/{postId}/likes/{likerUid}.
// ---------------------------------------------------------------------------
export type Post = { id: string; uid: string; text: string; image: string | null; at: number }
export async function createPost(uid: string, text: string, image: string | null) {
  await addDoc(collection(need(), 'users', uid, 'posts'), { uid, text, image, createdAt: serverTimestamp() })
}
export async function deletePost(uid: string, id: string) { await deleteDoc(doc(need(), 'users', uid, 'posts', id)) }
export function watchPosts(owner: string, cb: (p: Post[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(need(), 'users', owner, 'posts'), orderBy('createdAt', 'desc'), limit(60)), s =>
    cb(s.docs.map(d => { const v = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, uid: owner, text: v.text ?? '', image: v.image ?? null, at: ms(v.createdAt) } })), onError)
}
export async function likeInfo(owner: string, postId: string, me: string) {
  const d = need(), col = collection(d, 'users', owner, 'posts', postId, 'likes')
  const [count, mine] = await Promise.all([getCountFromServer(col), getDoc(doc(col, me))])
  return { count: count.data().count, liked: mine.exists() }
}
export async function setLike(owner: string, postId: string, me: string, on: boolean) {
  const ref = doc(need(), 'users', owner, 'posts', postId, 'likes', me)
  if (on) await setDoc(ref, { uid: me, createdAt: serverTimestamp() }); else await deleteDoc(ref)
}

// ---------------------------------------------------------------------------
// Reports (grievance mechanism) and account deletion (right to erasure).
// ---------------------------------------------------------------------------
export async function report(fromUid: string, targetUid: string, reason: string, detail: string) {
  await addDoc(collection(need(), 'reports'), { fromUid, targetUid, reason, detail: detail.slice(0, 1000), createdAt: serverTimestamp() })
}
export async function deleteAccount(uid: string, username: string | null) {
  const d = need()
  const sub = async (path: string[]) => { const s = await getDocs(collection(d, path[0], ...path.slice(1))); return s.docs.map(x => x.ref) }
  const refs = [
    ...(await sub(['users', uid, 'posts'])), ...(await sub(['users', uid, 'results'])), ...(await sub(['users', uid, 'preferences'])),
    ...(await getDocs(query(collection(d, 'follows'), where('fromUid', '==', uid)))).docs.map(x => x.ref),
    ...(await getDocs(query(collection(d, 'follows'), where('toUid', '==', uid)))).docs.map(x => x.ref),
  ]
  for (let i = 0; i < refs.length; i += 400) { const b = writeBatch(d); refs.slice(i, i + 400).forEach(r => b.delete(r)); await b.commit() }
  const b = writeBatch(d)
  if (username) b.delete(doc(d, 'usernames', username))
  b.delete(doc(d, 'publicProfiles', uid)); b.delete(doc(d, 'users', uid))
  await b.commit()
}
