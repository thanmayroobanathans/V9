import type { Smoothed } from './kalman'
import { kv } from './kv'

/**
 * Lifestyle signals ("nature") learned from movement.
 *
 * Kalman-smoothed positions are kept ONLY on this device (local storage, last 14 days). From them
 * we compute a handful of behaviour features. Only those features — plus a ~1.2 km area code
 * used for "usually around the same area" — are shared. No coordinates leave the phone.
 *
 *   roam     how far you range (radius of gyration, log-scaled: ~100 m → 0, ~3 km → 1)
 *   variety  how many distinct ~150 m spots you visit per day
 *   routine  share of time spent at your two most-visited spots
 *   active   share of time on the move
 *   night    share of activity between 10 pm and 4 am
 *   early    share of activity between 5 am and 8 am
 *   confidence 0..1 — grows with the number of samples and days observed
 */
export type Nature = { roam: number; variety: number; routine: number; active: number; night: number; early: number; confidence: number }
type Sample = { lat: number; lng: number; s: number; t: number }

const KEY = 'pulse.track.v1'
const MAX_AGE = 14 * 86_400_000
const MAX_SAMPLES = 4000
const MIN_GAP_MS = 60_000
const MIN_MOVE_M = 40
const CELL = 0.00135 // ≈150 m

const clamp = (x: number) => Math.max(0, Math.min(1, x))
const r2 = (x: number) => Math.round(x * 100) / 100
const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dy = (a.lat - b.lat) * 111_320, dx = (a.lng - b.lng) * 111_320 * Math.cos(a.lat * Math.PI / 180)
  return Math.hypot(dx, dy)
}

function load(): Sample[] { try { return JSON.parse(kv.get(KEY) || '[]') } catch { return [] } }
function save(s: Sample[]) { kv.set(KEY, JSON.stringify(s)) }
export function clearTrack() { kv.remove(KEY) }

/** Adds a smoothed fix to the on-device track (throttled). Returns true when a sample was stored. */
export function record(fix: Smoothed): boolean {
  if (!fix.accepted || fix.accuracy > 150) return false
  const track = load(), last = track[track.length - 1]
  if (last && fix.time - last.t < MIN_GAP_MS && dist(last, fix) < MIN_MOVE_M) return false
  const cutoff = Date.now() - MAX_AGE
  const next = [...track.filter(x => x.t >= cutoff), { lat: fix.lat, lng: fix.lng, s: r2(fix.speed), t: fix.time }].slice(-MAX_SAMPLES)
  save(next)
  return true
}

export function computeNature(track: Sample[] = load()): Nature | null {
  if (track.length < 5) return null
  const n = track.length
  const c = { lat: track.reduce((s, x) => s + x.lat, 0) / n, lng: track.reduce((s, x) => s + x.lng, 0) / n }
  const rg = Math.sqrt(track.reduce((s, x) => s + dist(x, c) ** 2, 0) / n)
  const cells = new Map<string, number>(), perDay = new Map<string, Set<string>>()
  let moving = 0, night = 0, early = 0
  for (const x of track) {
    const cell = `${Math.round(x.lat / CELL)}:${Math.round(x.lng / CELL)}`
    cells.set(cell, (cells.get(cell) ?? 0) + 1)
    const d = new Date(x.t), day = d.toDateString(), h = d.getHours()
    if (!perDay.has(day)) perDay.set(day, new Set())
    perDay.get(day)!.add(cell)
    if (x.s > 0.7) moving++
    if (h >= 22 || h < 4) night++
    if (h >= 5 && h < 8) early++
  }
  const top2 = [...cells.values()].sort((a, b) => b - a).slice(0, 2).reduce((s, x) => s + x, 0)
  const cellsPerDay = [...perDay.values()].reduce((s, x) => s + x.size, 0) / perDay.size
  return {
    roam: r2(clamp(Math.log10(Math.max(rg, 100) / 100) / Math.log10(30))),
    variety: r2(clamp((cellsPerDay - 1) / 9)),
    routine: r2(clamp(top2 / n)),
    active: r2(clamp(moving / n)),
    night: r2(clamp(night / n)),
    early: r2(clamp(early / n)),
    confidence: r2(clamp(n / 200) * clamp(perDay.size / 3)),
  }
}

/**
 * Behaviour-adjusted personality vector. Quiz answers are what people *say*; movement is what
 * they *do*. Each feature nudges related traits by at most ±0.12, scaled by confidence, so the
 * original quiz still dominates. Order matches FEATURES in pulse-model.
 */
export function adjustVector(v: number[], nature?: Nature | null) {
  if (!nature || nature.confidence <= 0) return v
  const k = 0.12 * nature.confidence, out = [...v]
  const nudge = (i: number, by: number) => { out[i] = Math.max(0.03, Math.min(0.97, out[i] + k * by)) }
  const c = (x: number) => (x - 0.5) * 2 // centre to −1..1
  nudge(0, c(nature.variety))                       // OPENNESS
  nudge(1, c(nature.routine))                       // CONSCIENTIOUSNESS
  nudge(2, c(nature.active))                        // EXTRAVERSION
  nudge(4, (c(nature.variety) + c(nature.roam)) / 2 - c(nature.routine) / 2) // NOVELTY
  nudge(5, c(nature.roam))                          // AUTONOMY
  nudge(8, -c(nature.active))                       // INTROVERSION
  return out
}

/** Friendly lifestyle words for the UI (no numbers). */
export function natureTags(n?: Nature | null): string[] {
  if (!n || n.confidence < 0.2) return []
  const t: string[] = []
  if (n.night > 0.18) t.push('Night owl'); else if (n.early > 0.15) t.push('Early bird')
  if (n.roam > 0.55 && n.variety > 0.45) t.push('Explorer'); else if (n.routine > 0.6 || n.roam < 0.2) t.push('Creature of habit')
  if (n.active > 0.45) t.push('Always on the move')
  return t
}

// ---------------------------------------------------------------------------
// Area code: geohash with 6 characters ≈ 1.2 km × 0.6 km. Used only to tell whether two people
// spend time in the same area — never displayed.
// ---------------------------------------------------------------------------
const B32 = '0123456789bcdefghjkmnpqrstuvwxyz'
export function areaCode(lat: number, lng: number, len = 6) {
  let latR = [-90, 90], lngR = [-180, 180], hash = '', bit = 0, ch = 0, even = true
  while (hash.length < len) {
    const r = even ? lngR : latR, v = even ? lng : lat, mid = (r[0] + r[1]) / 2
    if (v >= mid) { ch = (ch << 1) | 1; r[0] = mid } else { ch <<= 1; r[1] = mid }
    even = !even
    if (++bit === 5) { hash += B32[ch]; bit = 0; ch = 0 }
  }
  return hash
}
/** 1 = same ~1 km area, 0.5 = same ~5 km area, 0 otherwise. */
export const areaAffinity = (a?: string | null, b?: string | null) => !a || !b ? null : a === b ? 1 : a.slice(0, 5) === b.slice(0, 5) ? 0.5 : 0
