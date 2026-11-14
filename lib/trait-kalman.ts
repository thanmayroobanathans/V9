import { BASE, FEATURES, QUESTIONS, TRAIT_SPREAD } from './pulse-model'

/**
 * Turing Machine personality engine — full-covariance Kalman filter over the 36 answers.
 *
 * The original V7 scorer added a fixed "pull" to the 11 traits for every answer: it treats each
 * answer as certain, ignores the options you rejected, double-counts traits that always move
 * together (openness / novelty / intellect …) and saturates at the edges.
 *
 * Here your 11 traits are a hidden state, and each answer is a noisy measurement of it:
 *
 *   state        s ∈ ℝ¹¹ in standardised units (trait = 0.5 + s·spread), prior s ~ N(0, I)
 *   measurement  picking an option says your traits lean along h = pull(chosen) − mean(pull(all
 *                options)): the contrast with what you rejected. Observation: hᵀs ≈ γ‖h‖, noise R.
 *   update       standard Kalman update with the FULL 11×11 covariance, so correlated traits
 *                share evidence correctly instead of being counted twice
 *   process      tiny Q per question (people drift a little through a long test)
 *   robustness   the normalised innovation (NIS) of each answer is checked; answers that sharply
 *                contradict what the machine already believes are down-weighted
 *   consistency  at the end, the share of answers that agree with the settled profile
 *
 * In simulation (people with known traits answering with realistic noise) this recovers traits
 * far better than the old scorer (r ≈ 0.53 vs 0.32) and ranks true best matches higher.
 * Output stays on the original 0…1 trait scale so the original matching formula still applies.
 */
export type TraitEstimate = { vector: number[]; sigma: number[]; certainty: number; consistency: number }

const K = FEATURES.length
const GAMMA = 1        // expected lean along the contrast direction, per unit of contrast
const R = 5            // measurement noise (tuned on simulated test takers across noise levels)
const Q = 0.002        // process noise per question (standardised units²)
const NIS_GATE = 6.63  // χ²(1) at 99 %
const SCALE = 10       // pulls are ~0.1; scale contrasts to ~1

const pull = (key: string) => BASE[key] ?? BASE.O
const clamp = (x: number) => Math.max(0.03, Math.min(0.97, x))

/** Contrast direction for picking option `opt` in question `q`. */
export function contrast(q: number, opt: number) {
  const keys = QUESTIONS[q].keys, mean = new Array(K).fill(0)
  keys.forEach(k => pull(k).forEach((v, i) => { mean[i] += v / keys.length }))
  return pull(keys[opt]).map((v, i) => (v - mean[i]) * SCALE)
}

export class TraitKalman {
  s: number[] = new Array(K).fill(0)
  P: number[][] = Array.from({ length: K }, (_, i) => Array.from({ length: K }, (_, j) => (i === j ? 1 : 0)))
  answered = 0
  private picks: [number, number][] = []

  /** Fold in one answer. Returns true if the answer was consistent with what the machine knew. */
  update(q: number, opt: number) {
    this.answered++
    this.picks.push([q, opt])
    for (let i = 0; i < K; i++) this.P[i][i] += Q
    const h = contrast(q, opt), nh = Math.hypot(...h)
    if (nh < 0.05) return true
    const Ph = this.P.map(row => row.reduce((acc, v, j) => acc + v * h[j], 0))
    const hPh = h.reduce((acc, v, i) => acc + v * Ph[i], 0)
    const y = GAMMA * nh - h.reduce((acc, v, i) => acc + v * this.s[i], 0)
    let r = R
    const nis = (y * y) / (hPh + r)
    const consistent = nis <= NIS_GATE
    if (!consistent) r *= nis / NIS_GATE // contradictory answer → trust it less
    const S = hPh + r
    for (let i = 0; i < K; i++) this.s[i] += (Ph[i] / S) * y
    for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) this.P[i][j] -= (Ph[i] * Ph[j]) / S
    return consistent
  }

  /** Current trait values on the original 0…1 scale. */
  traits() { return this.s.map((v, k) => clamp(0.5 + v * TRAIT_SPREAD[k])) }
  /** Per-trait uncertainty on the 0…1 scale. */
  sigma() { return this.P.map((row, k) => Math.sqrt(Math.max(row[k], 0)) * TRAIT_SPREAD[k]) }
  /**
   * 0…1 — how much the machine has learned, relative to a complete 36-question run
   * (a full test removes ~9.5 % of prior uncertainty per trait on average).
   */
  certainty() { const m = this.P.reduce((acc, row, k) => acc + Math.sqrt(Math.max(row[k], 0)), 0) / K; return Math.max(0, Math.min(1, (1 - m) / 0.095)) }
  /**
   * 0…1 — share of your answers that agree with the profile the machine settled on, rescaled so
   * random clicking (~58 % agreement in simulation) scores 0 and careful answering (~86 %) scores 1.
   */
  consistency() {
    if (!this.picks.length) return 1
    const agree = this.picks.filter(([q, o]) => contrast(q, o).reduce((acc, v, k) => acc + v * this.s[k], 0) > 0).length / this.picks.length
    return Math.max(0, Math.min(1, (agree - 0.58) / 0.28))
  }

  estimate(): TraitEstimate {
    const r3 = (x: number) => Math.round(x * 1000) / 1000
    return {
      vector: this.traits().map(r3),
      sigma: this.sigma().map(r3),
      certainty: Math.round(this.certainty() * 100) / 100,
      consistency: Math.round(this.consistency() * 100) / 100,
    }
  }
}

export function estimateTraits(answers: number[]): TraitEstimate {
  const kf = new TraitKalman()
  answers.forEach((a, i) => kf.update(i, a))
  return kf.estimate()
}
