import { compatibility, sharedTraits } from './pulse-model'
import { jungFit, jungFromVector, type Jung } from './jung'
import { adjustVector, areaAffinity, natureTags } from './nature'
import type { Person } from './social'

/**
 * Match score.
 *
 * The core is the ORIGINAL V7 compatibility algorithm (`compatibility` in pulse-model: a blend of
 * variance-weighted Euclidean similarity and cosine similarity over the 11 traits) — unchanged.
 * Its inputs now come from the Turing-machine Kalman filter over the 36 answers (trait-kalman.ts).
 *
 * What V9 adds on top is better input and context:
 *  1. Behaviour-adjusted vectors — each person's 11 traits are refined by lifestyle signals
 *     learned on-device from Kalman-smoothed location (see nature.ts), weighted by confidence.
 *  2. A bounded context adjustment (never more than ±12 points), from:
 *       lifestyle sync   similar daily rhythm (night owl / early bird) and exploring style
 *       area             usually around the same part of campus
 *       common ground    shared interests and activities
 *       intent           looking for the same kind of connection
 *       Jung fit         background personality-type fit
 *     Every signal is optional; missing data simply contributes nothing.
 *
 * People only ever see the final % and friendly reasons — none of the maths.
 */
export type Fit = { score: number; base: number; reasons: string[] }

export const jungOf = (p: Pick<Person, 'jung' | 'vector'>): Jung => p.jung ?? jungFromVector(p.vector)
const jaccard = (a: string[] = [], b: string[] = []) => {
  if (!a.length || !b.length) return 0
  const A = new Set(a), inter = b.filter(x => A.has(x)).length
  return inter / (A.size + b.length - inter)
}

export function fit(me: Person, other: Person): Fit {
  const va = adjustVector(me.vector, me.nature), vb = adjustVector(other.vector, other.nature)
  // Original algorithm on Kalman-estimated traits, then calibrated to a stable display scale
  // (typical pair ≈ 70 %, top 10 % ≈ 85 %+). Monotonic, so the ranking is untouched.
  const base = Math.max(30, Math.min(99, Math.round(70 + (compatibility(va, vb) - 76) * 1.5)))
  let adj = 0
  const reasons: string[] = []

  const shared = sharedTraits(va, vb)
  if (shared.length) reasons.push(`You're both ${shared.join(', ')}`)

  // 1. Lifestyle sync from location-derived nature.
  const a = me.nature, b = other.nature
  if (a && b) {
    const conf = Math.min(a.confidence, b.confidence)
    if (conf > 0) {
      const rhythm = 1 - (Math.abs(a.night - b.night) + Math.abs(a.early - b.early)) / 2
      const style = 1 - (Math.abs(a.variety - b.variety) + Math.abs(a.roam - b.roam) + Math.abs(a.routine - b.routine)) / 3
      adj += conf * ((rhythm - 0.6) * 10 + (style - 0.6) * 8)
      const ta = natureTags(a), tb = natureTags(b), both = ta.filter(x => tb.includes(x))
      if (both.length && conf > 0.2) reasons.push(`You're both ${both.map(x => x.toLowerCase()).join(' & ')}`)
      else if (rhythm > 0.85 && conf > 0.2) reasons.push('Similar daily rhythm')
    }
  }
  // 2. Same part of campus.
  const area = areaAffinity(me.area, other.area)
  if (area !== null) { adj += area * 4; if (area === 1) reasons.push('Usually around the same part of campus') }
  // 3. Common ground.
  const common = other.interests.filter(i => me.interests.includes(i))
  adj += jaccard(me.interests, other.interests) * 8 + jaccard(me.openTo, other.openTo) * 3 - 1.5
  if (common.length) reasons.push(`Into ${common.slice(0, 3).join(', ')}`)
  // 4. Intent.
  if (me.intent && other.intent) {
    if (me.intent === other.intent) { adj += 2.5; reasons.push('Looking for the same thing') }
    else if (me.intent !== 'open' && other.intent !== 'open') adj -= 3
  }
  // 5. Background Jung fit.
  adj += (jungFit(jungOf(me), jungOf(other)) - 0.65) * 10

  const score = Math.round(Math.max(30, Math.min(99, base + Math.max(-12, Math.min(12, adj)))))
  return { score, base, reasons }
}

export const fitLabel = (s: number) => s >= 85 ? 'Rare match' : s >= 76 ? 'Great match' : s >= 66 ? 'Good match' : s >= 56 ? 'Worth a chat' : 'Wildcard'
