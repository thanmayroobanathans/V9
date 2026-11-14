import { compatibility, TRAIT_SPREAD } from './pulse-model'
import { jungFit } from './jung'
import { areaAffinity } from './nature'
import type { Person } from './social'

/**
 * Taste learner — a Kalman filter that learns what each person actually goes for.
 *
 * The personality score says who *should* click. Swipes say who people *do* like. This filter
 * keeps a weight vector w over a few match features plus the other person's 11 traits, and
 * updates it after every swipe (and when a match turns into a conversation):
 *
 *   predict   P ← P + Q          (small drift: tastes change, recent behaviour counts more)
 *   observe   y = +1 like, +1.3 super like, +1.5 started chatting, −1 pass
 *   update    standard Kalman update of w with feature vector f(me, them)
 *
 * Confidence grows as uncertainty (trace P) shrinks, so the learned part has almost no effect
 * for a new user and an increasing effect the more they use the app. The state is saved to the
 * user's private Firestore record so it follows them across devices.
 */
export type LearnerState = { w: number[]; P: number[][]; n: number }

const BASE_FEATURES = 7
const D = BASE_FEATURES + TRAIT_SPREAD.length
const P0 = 0.3
const R = 1
const Q = 0.0005
const MAX_POINTS = 35 // learned adjustment can reach ±35 points once confident

export const SIGNAL = { like: 1, super: 1.3, chat: 1.5, pass: -1 } as const

export function newLearner(): LearnerState {
  return { w: new Array(D).fill(0), P: Array.from({ length: D }, (_, i) => Array.from({ length: D }, (_, j) => (i === j ? P0 : 0))), n: 0 }
}

const jaccard = (a: string[] = [], b: string[] = []) => {
  if (!a.length || !b.length) return 0
  const A = new Set(a), inter = b.filter(x => A.has(x)).length
  return inter / (A.size + b.length - inter)
}

/** Features describing one candidate from my point of view (all roughly −1…1). */
export function features(me: Person, other: Person): number[] {
  const f = [
    1, // bias: how picky I am overall
    (compatibility(me.vector, other.vector) - 76) / 10,
    jaccard(me.interests, other.interests) * 2 - 0.3,
    jaccard(me.openTo, other.openTo) * 2 - 0.3,
    me.nature && other.nature ? 1 - (Math.abs(me.nature.night - other.nature.night) + Math.abs(me.nature.roam - other.nature.roam)) - 0.5 : 0,
    areaAffinity(me.area, other.area) ?? 0,
    me.jung && other.jung ? (jungFit(me.jung, other.jung) - 0.65) * 4 : 0,
  ]
  // The other person's traits: lets the filter learn "likes outgoing people", etc.
  other.vector.forEach((v, k) => f.push(Math.max(-2, Math.min(2, (v - 0.5) / (TRAIT_SPREAD[k] * 0.6)))))
  return f
}

export function update(s: LearnerState, f: number[], y: number): LearnerState {
  const P = s.P.map((row, i) => row.map((v, j) => v + (i === j ? Q : 0)))
  const Pf = P.map(row => row.reduce((acc, v, j) => acc + v * f[j], 0))
  const S = f.reduce((acc, v, i) => acc + v * Pf[i], 0) + R
  const err = y - f.reduce((acc, v, i) => acc + v * s.w[i], 0)
  const w = s.w.map((v, i) => v + (Pf[i] / S) * err)
  const P2 = P.map((row, i) => row.map((v, j) => v - (Pf[i] * Pf[j]) / S))
  return { w, P: P2, n: s.n + 1 }
}

/** 0…1 — how much the learner knows about this person's taste. */
export function confidence(s: LearnerState) {
  const tr = s.P.reduce((acc, row, i) => acc + row[i], 0)
  return Math.max(0, Math.min(1, 1 - tr / (P0 * D)))
}

/**
 * Learned adjustment in score points. Scaled by confidence, so it is ~0 for a new user and takes
 * over more of the ranking as their swipe history grows (tuned in simulation: ranking AUC
 * 0.55 → ~0.64 after 60 swipes).
 */
export function learnedPoints(s: LearnerState | null, f: number[]) {
  if (!s || !s.n) return 0
  const pred = f.reduce((acc, v, i) => acc + v * s.w[i], 0)
  return Math.max(-MAX_POINTS, Math.min(MAX_POINTS, pred * 30)) * Math.min(1, confidence(s) * 6)
}

// ---- compact serialisation (Firestore can't store nested arrays) ----
export const pack = (s: LearnerState) => ({ w: s.w.map(v => Math.round(v * 1e4) / 1e4), P: s.P.flat().map(v => Math.round(v * 1e5) / 1e5), n: s.n, d: D })
export function unpack(x: unknown): LearnerState | null {
  const o = x as { w?: number[]; P?: number[]; n?: number; d?: number } | null
  if (!o || o.d !== D || o.w?.length !== D || o.P?.length !== D * D) return null
  return { w: o.w, P: Array.from({ length: D }, (_, i) => o.P!.slice(i * D, (i + 1) * D)), n: o.n ?? 0 }
}
