import { QUESTIONS } from './pulse-model'

/**
 * Jung-inspired personality layer.
 *
 * Carl Jung described personality along attitude (extraversion / introversion) and functions
 * (sensing / intuition, thinking / feeling); later work added a judging / perceiving axis.
 * The 36 quiz answers are already tagged with trait keys, so the four axes are derived here
 * quietly in the background. People only see a friendly type name and four plain-language
 * sliders — no jargon. Each axis is 0..1, where 1 is the first pole (E, N, T, J).
 *
 * This is a lightweight, original interpretation for matching — not a clinical instrument
 * and not affiliated with any commercial type indicator.
 */
export type Jung = { ei: number; ns: number; tf: number; jp: number }
export type JungAxis = keyof Jung

// How each answer key nudges the four axes.
const PULL: Record<string, Partial<Jung>> = {
  E: { ei: 1 },
  I: { ei: -1 },
  N: { ns: 1, jp: -0.35 },
  O: { ns: 0.6, jp: -0.6 },
  C: { jp: 1, ns: -0.5 },
  T: { tf: 1 },
  F: { tf: -1 },
}

const AX: JungAxis[] = ['ei', 'ns', 'tf', 'jp']
/**
 * Per-question baseline: the average pull of its four options. Subtracting it centres each
 * axis, so a question whose options lean one way does not bias everyone toward that pole.
 */
const BASELINE: Jung[] = QUESTIONS.map(q => {
  const b: Jung = { ei: 0, ns: 0, tf: 0, jp: 0 }
  q.keys.forEach(k => { const pull = PULL[k] ?? {}; AX.forEach(ax => { b[ax] += (pull[ax] ?? 0) / q.keys.length }) })
  return b
})

export function jungFromAnswers(answers: number[]): Jung {
  const sum: Jung = { ei: 0, ns: 0, tf: 0, jp: 0 }
  const hits: Jung = { ei: 0, ns: 0, tf: 0, jp: 0 }
  answers.forEach((a, i) => {
    const key = QUESTIONS[i]?.keys[a]
    if (!key) return
    const pull = PULL[key] ?? {}
    AX.forEach(ax => {
      const v = (pull[ax] ?? 0) - BASELINE[i][ax]
      sum[ax] += v; hits[ax] += Math.abs(v)
    })
  })
  const out = {} as Jung
  for (const ax of Object.keys(sum) as JungAxis[]) {
    // Shrink toward the middle when there is little evidence, so short quizzes stay modest.
    const v = 1.6 * sum[ax] / (hits[ax] + 2)
    out[ax] = Math.round((0.5 + 0.5 * Math.max(-1, Math.min(1, v))) * 100) / 100
  }
  return out
}

/** Fallback for profiles saved before the Jung layer existed: estimate from the 11-trait vector. */
export function jungFromVector(v: number[]): Jung {
  const c = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 100) / 100
  return { ei: c(0.5 + (v[2] - v[8]) / 2), ns: c((v[10] + v[0]) / 2), tf: c(0.5 + (v[9] - v[3]) / 2), jp: c(0.5 + (v[1] - v[4]) / 2) }
}

export const typeCode = (j: Jung) => `${j.ei >= 0.5 ? 'E' : 'I'}${j.ns >= 0.5 ? 'N' : 'S'}${j.tf >= 0.5 ? 'T' : 'F'}${j.jp >= 0.5 ? 'J' : 'P'}`

const TYPES: Record<string, { name: string; blurb: string; emoji: string }> = {
  ENFP: { name: 'The Spark', emoji: '✨', blurb: 'Curious, warm and full of ideas — you light up a room and love new people.' },
  ENFJ: { name: 'The Host', emoji: '🤝', blurb: 'You bring people together and make everyone feel included.' },
  ENTP: { name: 'The Inventor', emoji: '💡', blurb: 'Quick, playful and always poking at how things could work better.' },
  ENTJ: { name: 'The Captain', emoji: '🧭', blurb: 'Decisive and driven — you turn plans into results.' },
  ESFP: { name: 'The Performer', emoji: '🎉', blurb: 'Fun, present and spontaneous — life is better with you around.' },
  ESFJ: { name: 'The Connector', emoji: '🫶', blurb: 'Thoughtful and dependable; you remember everyone’s birthday.' },
  ESTP: { name: 'The Daredevil', emoji: '⚡', blurb: 'Action first, details later — you love a challenge.' },
  ESTJ: { name: 'The Organiser', emoji: '📋', blurb: 'Practical and reliable; you make things actually happen.' },
  INFP: { name: 'The Dreamer', emoji: '🌙', blurb: 'Deep, imaginative and true to your values.' },
  INFJ: { name: 'The Sage', emoji: '🔮', blurb: 'Quietly insightful — you see what people really mean.' },
  INTP: { name: 'The Tinkerer', emoji: '🧩', blurb: 'You love ideas for their own sake and question everything.' },
  INTJ: { name: 'The Strategist', emoji: '♟️', blurb: 'Independent and long-sighted; you always have a plan.' },
  ISFP: { name: 'The Artist', emoji: '🎨', blurb: 'Gentle, creative and tuned in to the moment.' },
  ISFJ: { name: 'The Guardian', emoji: '🛡️', blurb: 'Loyal and caring; you quietly look after people.' },
  ISTP: { name: 'The Fixer', emoji: '🔧', blurb: 'Calm, hands-on and great in a crisis.' },
  ISTJ: { name: 'The Anchor', emoji: '⚓', blurb: 'Steady, honest and someone people can count on.' },
}
export const typeInfo = (j: Jung) => ({ code: typeCode(j), ...TYPES[typeCode(j)] })

/** Plain-language sliders shown to people instead of jargon. */
export const AXES: { key: JungAxis; left: string; right: string; label: string }[] = [
  { key: 'ei', label: 'Energy', left: 'Recharge alone', right: 'Recharge with people' },
  { key: 'ns', label: 'Focus', left: 'Practical & present', right: 'Ideas & possibilities' },
  { key: 'tf', label: 'Decisions', left: 'Go with the heart', right: 'Go with logic' },
  { key: 'jp', label: 'Lifestyle', left: 'Go with the flow', right: 'Plan ahead' },
]

/**
 * How well two people's Jung profiles fit (0..1).
 * - Focus (N/S) similarity matters most: people who process the world the same way talk easily.
 * - Lifestyle (J/P) similarity helps day-to-day plans.
 * - Energy (E/I) and Decisions (T/F) reward mild complementarity — a little difference balances,
 *   a lot of difference strains.
 */
export function jungFit(a: Jung, b: Jung) {
  const sim = (x: number, y: number) => 1 - Math.abs(x - y)
  const comp = (x: number, y: number) => { const d = Math.abs(x - y); return 1 - Math.abs(d - 0.3) / 0.7 }
  return 0.38 * sim(a.ns, b.ns) + 0.22 * sim(a.jp, b.jp) + 0.2 * comp(a.ei, b.ei) + 0.2 * comp(a.tf, b.tf)
}
