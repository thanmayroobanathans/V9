'use client'

import {
  addDoc, arrayRemove, arrayUnion, collection, doc, limit, limitToLast, onSnapshot, orderBy, query, runTransaction,
  serverTimestamp, updateDoc, where, type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Message, Person } from './social'
import { fit } from './match'
import type { LearnerState } from './learner'

/**
 * Plans — short-lived things to do together nearby ("Badminton at 7, need 2 more").
 * Swipe right to join; everyone who joins shares a group chat. Plans expire a couple of hours
 * after their start time, so the deck always shows what's happening now.
 */
export type Category = 'study' | 'food' | 'sports' | 'gym' | 'games' | 'music' | 'hangout' | 'travel' | 'project' | 'other'
export const CATEGORIES: { id: Category; label: string; emoji: string; interests: string[] }[] = [
  { id: 'study', label: 'Study', emoji: '📚', interests: ['Coding', 'Reading', 'Debate'] },
  { id: 'food', label: 'Food', emoji: '🍜', interests: ['Cooking', 'Chai', 'Coffee'] },
  { id: 'sports', label: 'Sports', emoji: '🏸', interests: ['Badminton', 'Cricket', 'Football'] },
  { id: 'gym', label: 'Gym', emoji: '💪', interests: ['Gym'] },
  { id: 'games', label: 'Games', emoji: '🎮', interests: ['Gaming', 'Anime'] },
  { id: 'music', label: 'Music', emoji: '🎸', interests: ['Music', 'Dance', 'Poetry'] },
  { id: 'hangout', label: 'Hang out', emoji: '☕', interests: ['Night walks', 'Movies', 'K-drama', 'Podcasts'] },
  { id: 'travel', label: 'Travel', emoji: '🚌', interests: ['Travel', 'Photography'] },
  { id: 'project', label: 'Project', emoji: '💻', interests: ['Hackathons', 'Startups', 'Robotics', 'Coding'] },
  { id: 'other', label: 'Other', emoji: '✨', interests: [] },
]
export const catOf = (c: Category) => CATEGORIES.find(x => x.id === c) ?? CATEGORIES[CATEGORIES.length - 1]

export type Plan = {
  id: string; hostUid: string; hostName: string; hostUsername: string; hostPhoto: string | null; hostHue: number
  category: Category; title: string; place: string; startAt: number; expiresAt: number; spots: number
  memberUids: string[]; members: Record<string, { name: string; photoURL: string | null; hue: number }>
  status: 'open' | 'cancelled'; lastMessage: string; lastSender: string; lastSenderName: string; lastAt: number
}

const need = () => { if (!db) throw new Error('Firestore is unavailable'); return db }
const ms = (t: unknown) => (t && typeof t === 'object' && 'toMillis' in t ? (t as { toMillis: () => number }).toMillis() : typeof t === 'number' ? t : Date.now())
const toPlan = (id: string, v: Record<string, unknown>): Plan => ({
  id, hostUid: v.hostUid as string, hostName: (v.hostName as string) ?? '', hostUsername: (v.hostUsername as string) ?? '', hostPhoto: (v.hostPhoto as string) ?? null, hostHue: (v.hostHue as number) ?? 200,
  category: (v.category as Category) ?? 'other', title: (v.title as string) ?? '', place: (v.place as string) ?? '', startAt: ms(v.startAt), expiresAt: ms(v.expiresAt), spots: (v.spots as number) ?? 4,
  memberUids: (v.memberUids as string[]) ?? [], members: (v.members as Plan['members']) ?? {}, status: (v.status as Plan['status']) ?? 'open',
  lastMessage: (v.lastMessage as string) ?? '', lastSender: (v.lastSender as string) ?? '', lastSenderName: (v.lastSenderName as string) ?? '', lastAt: ms(v.lastAt ?? v.createdAt),
})

export const EXPIRE_AFTER_MS = 2 * 60 * 60 * 1000

export async function createPlan(me: Person, p: { category: Category; title: string; place: string; startAt: number; spots: number }) {
  const ref = await addDoc(collection(need(), 'plans'), {
    hostUid: me.uid, hostName: me.name, hostUsername: me.username, hostPhoto: me.photoURL, hostHue: me.hue,
    category: p.category, title: p.title, place: p.place, startAt: p.startAt, expiresAt: p.startAt + EXPIRE_AFTER_MS, spots: p.spots,
    memberUids: [me.uid], members: { [me.uid]: { name: me.name, photoURL: me.photoURL, hue: me.hue } },
    status: 'open', lastMessage: '', lastSender: '', lastSenderName: '', lastAt: Date.now(), createdAt: serverTimestamp(),
  })
  return ref.id
}

/** Join with a transaction so the spot limit holds even when several people swipe at once. */
export async function joinPlan(me: Person, planId: string) {
  const d = need(), ref = doc(d, 'plans', planId)
  await runTransaction(d, async tx => {
    const s = await tx.get(ref)
    if (!s.exists()) throw new Error('This plan was removed')
    const v = s.data(), members = (v.memberUids as string[]) ?? []
    if (members.includes(me.uid)) return
    if (v.status !== 'open' || ms(v.expiresAt) < Date.now()) throw new Error('This plan has ended')
    if (members.length >= (v.spots as number) + 1) throw new Error('This plan is full')
    tx.update(ref, { memberUids: arrayUnion(me.uid), [`members.${me.uid}`]: { name: me.name, photoURL: me.photoURL, hue: me.hue } })
  })
}
export async function leavePlan(meUid: string, planId: string) {
  await updateDoc(doc(need(), 'plans', planId), { memberUids: arrayRemove(meUid) })
}
export async function cancelPlan(planId: string) {
  await updateDoc(doc(need(), 'plans', planId), { status: 'cancelled' })
}

/** Plans that haven't expired yet (the swipe deck). */
export function watchOpenPlans(cb: (p: Plan[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(need(), 'plans'), where('expiresAt', '>', Date.now()), orderBy('expiresAt'), limit(200)), s => cb(s.docs.map(d => toPlan(d.id, d.data())).filter(p => p.status === 'open')), onError)
}
/** Plans I'm part of (their group chats). */
export function watchMyPlans(uid: string, cb: (p: Plan[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(need(), 'plans'), where('memberUids', 'array-contains', uid)), s => cb(s.docs.map(d => toPlan(d.id, d.data({ serverTimestamps: 'estimate' })))), onError)
}

export async function sendPlanMessage(planId: string, me: Person, text: string) {
  const d = need()
  await addDoc(collection(d, 'plans', planId, 'messages'), { senderUid: me.uid, senderName: me.name, text, createdAt: serverTimestamp() })
  await updateDoc(doc(d, 'plans', planId), { lastMessage: text.slice(0, 120), lastSender: me.uid, lastSenderName: me.name, lastAt: serverTimestamp() }).catch(() => {})
}
export function watchPlanMessages(planId: string, count: number, cb: (m: Message[], hasMore: boolean) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(need(), 'plans', planId, 'messages'), orderBy('createdAt', 'asc'), limitToLast(count)), { includeMetadataChanges: true }, s =>
    cb(s.docs.map(d => { const v = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, senderUid: v.senderUid, senderName: v.senderName, text: v.text, at: ms(v.createdAt), pending: d.metadata.hasPendingWrites } }), s.size >= count), onError)
}

/**
 * Deck order: what's starting soon and fits you.
 *   soon      plans starting within the next ~3 hours rank highest; already-started ones a bit lower
 *   interest  the plan's category matches your interests, or categories you've joined before
 *   host fit  personality/taste fit with the host (same engine as the People deck)
 *   momentum  a few people already going makes a plan more attractive; full plans are hidden
 */
export function rankPlans(me: Person, plans: Plan[], hosts: Record<string, Person>, joinedCats: Record<string, number>, taste: LearnerState | null) {
  const now = Date.now()
  return plans
    .filter(p => p.memberUids.length < p.spots + 1 && p.expiresAt > now)
    .map(p => {
      const mins = (p.startAt - now) / 60000
      const soon = mins < 0 ? 0.6 : Math.exp(-mins / 180)
      const cat = catOf(p.category)
      const interest = Math.min(1, cat.interests.filter(i => me.interests.includes(i)).length * 0.5 + (joinedCats[p.category] ?? 0) * 0.25)
      const host = hosts[p.hostUid]
      const hostFit = host ? (fit(me, host, taste).score - 50) / 50 : 0.3
      const momentum = Math.min(1, (p.memberUids.length - 1) / 3)
      return { p, score: 0.4 * soon + 0.3 * interest + 0.2 * hostFit + 0.1 * momentum }
    })
    .sort((a, b) => b.score - a.score)
    .map(x => x.p)
}

export function whenLabel(t: number) {
  const now = new Date(), d = new Date(t), mins = Math.round((t - now.getTime()) / 60000)
  if (mins < -5) return 'Happening now'
  if (mins < 1) return 'Starting now'
  if (mins < 60) return `In ${mins} min`
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  if (d.toDateString() === now.toDateString()) return `Today ${time}`
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + time
}
