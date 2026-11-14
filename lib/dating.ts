'use client'

import {
  addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'

export const MODEL_VERSION = 'V9.0'

export type Gender = 'woman' | 'man' | 'nonbinary'
export type Seeking = 'women' | 'men' | 'everyone'
export type Intent = 'relationship' | 'dating' | 'friends' | 'figuring-out'
export type PromptAnswer = { q: string; a: string }

/** Everything another signed-in student may see. Never contains email or coordinates. */
export type PublicProfile = {
  uid: string
  name: string
  age: number
  gender: Gender
  seeking: Seeking
  intent: Intent
  year: string
  program: string
  bio: string
  interests: string[]
  prompts: PromptAnswer[]
  photoURL: string | null
  hue: number
  archetype: string
  archetypeCode: string
  vector: number[]
  campusSignal: string
  discoverable: boolean
  sample?: boolean
}

export type Swipe = 'like' | 'super' | 'pass'
export type Match = { id: string; memberUids: string[]; members: Record<string, { name: string; photoURL: string | null; hue: number }>; lastMessage?: string; lastAt?: number; status: 'open' | 'closed'; sample?: boolean }
export type Message = { id: string; senderUid: string; text: string; at: number }

export const PROMPTS = [
  'A perfect Sunday on campus looks like…',
  'My most irrational fear is…',
  'The way to win me over is…',
  'I geek out on…',
  'Green flags I look for…',
  'We will get along if…',
  'My go-to Foodys order is…',
  'Two truths and a lie…',
]
export const INTERESTS = ['Coding', 'Hackathons', 'Music', 'Gym', 'Badminton', 'Cricket', 'Football', 'Photography', 'Anime', 'Movies', 'Gaming', 'Reading', 'Startups', 'Dance', 'Travel', 'Cooking', 'Chai', 'Coffee', 'Art', 'Poetry', 'Debate', 'Robotics', 'Fashion', 'Night walks', 'K-drama', 'Podcasts', 'Volunteering', 'Riviera']
export const INTENT_LABEL: Record<Intent, string> = { relationship: 'Long-term', dating: 'Dating', friends: 'New friends', 'figuring-out': 'Figuring it out' }

export const pairId = (a: string, b: string) => [a, b].sort().join('_')
const need = () => { if (!db) throw new Error('Firestore is unavailable'); return db }
const ms = (t: unknown) => (t && typeof t === 'object' && 'toMillis' in t ? (t as { toMillis: () => number }).toMillis() : Date.now())

export function genderMatches(me: PublicProfile, other: PublicProfile) {
  const wants = (s: Seeking, g: Gender) => s === 'everyone' || (s === 'women' && g === 'woman') || (s === 'men' && g === 'man')
  // Non-binary people are shown to "everyone" seekers; they see whoever they ask for.
  return wants(me.seeking, other.gender) && wants(other.seeking, me.gender)
}

export async function loadMyProfile(uid: string) {
  const snap = await getDoc(doc(need(), 'publicProfiles', uid))
  return snap.exists() ? ({ ...(snap.data() as PublicProfile), uid }) : null
}

export async function savePublicProfile(p: PublicProfile) {
  const { sample: _s, ...data } = p
  await setDoc(doc(need(), 'publicProfiles', p.uid), { ...data, modelVersion: MODEL_VERSION, updatedAt: serverTimestamp() }, { merge: true })
}

/** Candidate pool: discoverable profiles minus me and anyone I have already swiped on. */
export async function loadCandidates(me: PublicProfile) {
  const d = need()
  const [pool, mine] = await Promise.all([
    getDocs(query(collection(d, 'publicProfiles'), where('discoverable', '==', true), limit(200))),
    getDocs(query(collection(d, 'connections'), where('fromUid', '==', me.uid))),
  ])
  const seen = new Set(mine.docs.map(x => x.data().toUid as string))
  return pool.docs.map(x => ({ ...(x.data() as PublicProfile), uid: x.id })).filter(p => p.uid !== me.uid && !seen.has(p.uid))
}

/**
 * Record a swipe. Returns the match id if this completes a mutual like.
 * The reciprocal check reads connections/{them}_{me}; rules allow the target to read it.
 */
export async function swipe(me: PublicProfile, them: PublicProfile, kind: Swipe): Promise<string | null> {
  const d = need()
  await setDoc(doc(d, 'connections', `${me.uid}_${them.uid}`), { fromUid: me.uid, toUid: them.uid, type: kind, createdAt: serverTimestamp() })
  if (kind === 'pass') return null
  const back = await getDoc(doc(d, 'connections', `${them.uid}_${me.uid}`))
  if (!back.exists() || back.data().type === 'pass') return null
  const id = pairId(me.uid, them.uid)
  const ref = doc(d, 'matches', id)
  const existing = await getDoc(ref).catch(() => null)
  if (!existing?.exists()) {
    // If the other person created it a moment earlier this write is rejected; that is still a match.
    await setDoc(ref, {
      memberUids: [me.uid, them.uid].sort(),
      members: {
        [me.uid]: { name: me.name, photoURL: me.photoURL, hue: me.hue },
        [them.uid]: { name: them.name, photoURL: them.photoURL, hue: them.hue },
      },
      status: 'open', createdAt: serverTimestamp(), lastAt: serverTimestamp(), lastMessage: '',
    }).catch(async e => { if (!(await getDoc(ref)).exists()) throw e })
  }
  return id
}

export function watchMatches(uid: string, cb: (m: Match[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(need(), 'matches'), where('memberUids', 'array-contains', uid)), s => {
    cb(s.docs.map(x => { const v = x.data(); return { id: x.id, memberUids: v.memberUids, members: v.members, lastMessage: v.lastMessage, lastAt: ms(v.lastAt), status: v.status ?? 'open' } }))
  }, onError)
}

export function watchMessages(matchId: string, cb: (m: Message[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(need(), 'matches', matchId, 'messages'), orderBy('createdAt', 'asc'), limit(300)), s => {
    cb(s.docs.map(x => { const v = x.data(); return { id: x.id, senderUid: v.senderUid, text: v.text, at: ms(v.createdAt) } }))
  }, onError)
}

export async function sendMessage(matchId: string, uid: string, text: string) {
  const d = need()
  await addDoc(collection(d, 'matches', matchId, 'messages'), { senderUid: uid, text, createdAt: serverTimestamp() })
  await updateDoc(doc(d, 'matches', matchId), { lastMessage: text.slice(0, 120), lastAt: serverTimestamp() })
}

export async function unmatch(matchId: string) {
  await updateDoc(doc(need(), 'matches', matchId), { status: 'closed', lastAt: serverTimestamp() })
}
