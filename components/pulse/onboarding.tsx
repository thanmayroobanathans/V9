'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, ChevronDown, MapPin, Sparkles } from 'lucide-react'
import { INTENT_LABEL, INTERESTS, OPEN_TO, PROMPTS, type Gender, type Intent, type Person, type PromptAnswer, type Seeking } from '@/lib/social'
import { FEATURES, QUESTIONS } from '@/lib/pulse-model'
import { AXES, typeInfo, type Jung } from '@/lib/jung'
import { Chips, Portrait, Segmented } from './ui'

export type Draft = Omit<Person, 'vector' | 'archetype' | 'archetypeCode' | 'jung'> & { vector?: number[]; jung?: Jung }

const YEARS = ['1st year', '2nd year', '3rd year', '4th year', '5th year', 'Masters', 'PhD']

/** Profile builder. `mode="edit"` skips the quiz. */
export function ProfileBuilder({ initial, mode, locationOn, requestLocation, onDone, onCancel, saving }: {
  initial: Draft; mode: 'onboard' | 'edit'; locationOn: boolean; requestLocation: () => void
  onDone: (d: Draft, answers?: number[]) => void; onCancel?: () => void; saving?: boolean
}) {
  const [d, setD] = useState<Draft>(initial)
  const [step, setStep] = useState(0)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }))
  const steps = mode === 'onboard' ? ['You', 'Card', 'Prompts', 'Location', 'Quiz'] : ['You', 'Card', 'Prompts', 'Location']
  const valid = [
    d.name.trim().length > 0 && d.age >= 18 && d.age <= 40 && d.program.trim().length > 0,
    d.interests.length >= 3 && d.openTo.length >= 1,
    d.prompts.filter(p => p.a.trim()).length >= 2,
    true,
  ]
  const last = step === steps.length - 1
  const toggle = (k: 'interests' | 'openTo', s: string) => set(k, d[k].includes(s) ? d[k].filter(x => x !== s) : [...d[k], s])
  const setPrompt = (i: number, patch: Partial<PromptAnswer>) => set('prompts', d.prompts.map((p, j) => j === i ? { ...p, ...patch } : p))

  if (step === 4) return <QuizIntro onBack={() => setStep(3)} onDone={answers => onDone(d, answers)} />

  return (
    <section className="builder">
      <div className="steps">{steps.map((s, i) => <span key={s} className={i <= step ? 'on' : ''}>{s}</span>)}</div>
      {step === 0 && <>
        <h2>About <em>you</em></h2>
        <div className="field-row">
          <label className="field">First name<input value={d.name} maxLength={24} onChange={e => set('name', e.target.value)} /></label>
          <label className="field small">Age<input type="number" inputMode="numeric" min={18} max={40} value={d.age || ''} onChange={e => set('age', Number(e.target.value))} /></label>
        </div>
        {d.age > 0 && d.age < 18 && <p className="error">18+ only.</p>}
        <div className="field-row">
          <label className="field">Program<input value={d.program} maxLength={32} placeholder="e.g. CSE, ECE, BBA" onChange={e => set('program', e.target.value)} /></label>
          <label className="field">Year<select value={d.year} onChange={e => set('year', e.target.value)}>{YEARS.map(y => <option key={y}>{y}</option>)}</select></label>
        </div>
        <div className="field">I am<Segmented<Gender> value={d.gender} onChange={v => set('gender', v)} options={[{ v: 'woman', label: 'Woman' }, { v: 'man', label: 'Man' }, { v: 'nonbinary', label: 'Non-binary' }]} /></div>
        <div className="field">Show me<Segmented<Seeking> value={d.seeking} onChange={v => set('seeking', v)} options={[{ v: 'women', label: 'Women' }, { v: 'men', label: 'Men' }, { v: 'everyone', label: 'Everyone' }]} /></div>
        <div className="field">Looking for<Segmented<Intent> value={d.intent} onChange={v => set('intent', v)} options={(Object.keys(INTENT_LABEL) as Intent[]).map(v => ({ v, label: INTENT_LABEL[v] }))} /></div>
      </>}

      {step === 1 && <>
        <h2>Your <em>card</em></h2>
        <div className="photo-row">
          <Portrait name={d.name} photoURL={d.photoURL} hue={d.hue} />
          <div>
            <b><Camera size={14} /> Photo</b>
            <div className="hue-row">
              {initial.photoURL && <button type="button" className={`pill${d.photoURL ? ' on' : ''}`} onClick={() => set('photoURL', d.photoURL ? null : initial.photoURL)}>{d.photoURL ? 'Using Google photo' : 'Use Google photo'}</button>}
              {[340, 15, 45, 160, 210, 280].map(h => <button type="button" key={h} aria-label={`Colour ${h}`} className={`swatch${!d.photoURL && d.hue === h ? ' on' : ''}`} style={{ background: `hsl(${h} 70% 55%)` }} onClick={() => setD(x => ({ ...x, hue: h, photoURL: null }))} />)}
            </div>
          </div>
        </div>
        <label className="field">Bio<textarea value={d.bio} maxLength={200} rows={2} placeholder="A line about you" onChange={e => set('bio', e.target.value)} /></label>
        <label className="field">Status<input value={d.status} maxLength={80} placeholder="e.g. Looking for a badminton partner" onChange={e => set('status', e.target.value)} /></label>
        <div className="field">Interests <small>3–6</small><Chips items={INTERESTS} active={d.interests} onToggle={s => toggle('interests', s)} max={6} /></div>
        <div className="field">Open to<Chips items={OPEN_TO} active={d.openTo} onToggle={s => toggle('openTo', s)} /></div>
      </>}

      {step === 2 && <>
        <h2>Two <em>prompts</em></h2>
        {d.prompts.map((p, i) => (
          <div className="prompt-edit" key={i}>
            <select value={p.q} onChange={e => setPrompt(i, { q: e.target.value })}>{PROMPTS.map(q => <option key={q} disabled={q !== p.q && d.prompts.some(x => x.q === q)}>{q}</option>)}</select>
            <textarea value={p.a} rows={2} maxLength={140} placeholder="Your answer" onChange={e => setPrompt(i, { a: e.target.value })} />
          </div>
        ))}
      </>}

      {step === 3 && <>
        <h2>Better <em>matches</em></h2>
        <p className="muted">Use location to learn your daily rhythm. Never shown to anyone.</p>
        <div className="location-box">
          <div><MapPin size={18} /><div><b>Location</b><span>{locationOn ? 'On' : 'Off'}</span></div></div>
          {locationOn ? <span className="signal">ON</span> : <button type="button" className="secondary-button" onClick={requestLocation}>Turn on</button>}
        </div>
      </>}

      <div className="builder-foot">
        {step > 0 ? <button type="button" className="ghost-button" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</button> : onCancel ? <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button> : <span />}
        <button type="button" className="primary-button" disabled={!valid[step] || saving} onClick={() => last ? onDone(d) : setStep(step + 1)}>
          {mode === 'edit' && last ? (saving ? 'Saving…' : 'Save profile') : step === 3 ? <>Next <ArrowRight size={16} /></> : <>Continue <ArrowRight size={16} /></>}
        </button>
      </div>
    </section>
  )
}

/** Short intro, then the 36-question personality quiz. */
export function QuizIntro({ onDone, onBack }: { onDone: (answers: number[]) => void; onBack?: () => void }) {
  const [started, setStarted] = useState(false)
  if (started) return <Calibration onBack={() => setStarted(false)} onDone={onDone} />
  return (
    <section className="builder quiz-intro">
      <span className="quiz-emoji">✨</span>
      <h2>Your <em>personality</em></h2>
      <p className="muted">36 quick questions. Pick what feels closest.</p>
      <button className="primary-button wide" onClick={() => setStarted(true)}>Start <ArrowRight size={16} /></button>
      {onBack && <button type="button" className="ghost-button wide" onClick={onBack}>Back</button>}
    </section>
  )
}

export function Calibration({ onDone, onBack }: { onDone: (answers: number[]) => void; onBack?: () => void }) {
  const [answers, setAnswers] = useState<number[]>([])
  const total = QUESTIONS.length, q = Math.min(answers.length, total - 1), item = QUESTIONS[q]
  const pick = (i: number) => {
    const next = [...answers, i]
    if (next.length === total) onDone(next); else setAnswers(next)
  }
  return (
    <section className="quiz">
      <div className="quiz-top">
        <button type="button" className="icon-button" aria-label="Back" onClick={() => answers.length ? setAnswers(answers.slice(0, -1)) : onBack?.()}><ArrowLeft size={18} /></button>
        <div className="quiz-progress"><i style={{ width: `${(answers.length / total) * 100}%` }} /></div>
        <span className="quiz-count">{answers.length + 1}/{total}</span>
      </div>
      <h3 key={q} className="q-text">{item.text}</h3>
      <div className="choices" key={`c${q}`}>{item.options.map((c, i) => <button key={c} onClick={e => { e.currentTarget.blur(); pick(i) }}>{c}</button>)}</div>
    </section>
  )
}

/** The simple, jargon-free result people see. */
export function TypeCard({ jung, compact }: { jung: Jung; compact?: boolean }) {
  const t = typeInfo(jung)
  return (
    <div className={`type-card${compact ? ' compact' : ''}`}>
      <div className="type-head"><span className="type-emoji">{t.emoji}</span><div><small>YOUR TYPE</small><b>{t.name}</b></div></div>
      {!compact && <p>{t.blurb}</p>}
      <div className="axes">
        {AXES.map(a => (
          <div className="axis" key={a.key}>
            <small>{a.label}</small>
            <div className="axis-bar"><i style={{ left: `${jung[a.key] * 100}%` }} /></div>
            <div className="axis-ends"><span className={jung[a.key] < 0.5 ? 'on' : ''}>{a.left}</span><span className={jung[a.key] >= 0.5 ? 'on' : ''}>{a.right}</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Advanced view: the 11 raw traits, collapsed by default. */
export function TraitDetails({ vector, code }: { vector: number[]; code: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="trait-details">
      <button className="ghost-button" onClick={() => setOpen(o => !o)}><ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : undefined }} /> {open ? 'Hide' : 'Show'} traits</button>
      {open && <>
        <div className="bars">{FEATURES.map((f, i) => <div className="bar-row" key={f}><label>{f}</label><div><i style={{ width: `${Math.round(vector[i] * 100)}%` }} /></div><span>{Math.round(vector[i] * 100)}</span></div>)}</div>
        <p className="muted small">Code {code}</p>
      </>}
    </div>
  )
}
