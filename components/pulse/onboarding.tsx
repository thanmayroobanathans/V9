'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, ChevronDown, MapPin, Sparkles, Zap } from 'lucide-react'
import { INTENT_LABEL, INTERESTS, OPEN_TO, PROMPTS, type Gender, type Intent, type Person, type PromptAnswer, type Seeking } from '@/lib/social'
import { FEATURES, QUESTIONS } from '@/lib/pulse-model'
import { AXES, typeInfo, type Jung } from '@/lib/jung'
import { Chips, Portrait, Segmented } from './ui'

export type Draft = Omit<Person, 'vector' | 'archetype' | 'archetypeCode' | 'jung'> & { vector?: number[]; jung?: Jung }

const YEARS = ['1st year', '2nd year', '3rd year', '4th year', '5th year', 'Masters', 'PhD']
export const QUICK = 12

/** Profile builder. `mode="edit"` skips the quiz. */
export function ProfileBuilder({ initial, mode, locationOn, requestLocation, onDone, onCancel, saving }: {
  initial: Draft; mode: 'onboard' | 'edit'; locationOn: boolean; requestLocation: () => void
  onDone: (d: Draft, answers?: number[]) => void; onCancel?: () => void; saving?: boolean
}) {
  const [d, setD] = useState<Draft>(initial)
  const [step, setStep] = useState(0)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }))
  const steps = mode === 'onboard' ? ['Basics', 'About', 'Prompts', 'Lifestyle', 'Quiz'] : ['Basics', 'About', 'Prompts', 'Lifestyle']
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
        <h2>Let&apos;s set up <em>your profile</em></h2>
        <p className="muted">This is what other VIT students see on your card. You can change it any time.</p>
        <div className="field-row">
          <label className="field">First name<input value={d.name} maxLength={24} onChange={e => set('name', e.target.value)} /></label>
          <label className="field small">Age<input type="number" inputMode="numeric" min={18} max={40} value={d.age || ''} onChange={e => set('age', Number(e.target.value))} /></label>
        </div>
        {d.age > 0 && d.age < 18 && <p className="error">VIT Pulse is for students aged 18 and over.</p>}
        <div className="field-row">
          <label className="field">Program<input value={d.program} maxLength={32} placeholder="e.g. CSE, ECE, BBA" onChange={e => set('program', e.target.value)} /></label>
          <label className="field">Year<select value={d.year} onChange={e => set('year', e.target.value)}>{YEARS.map(y => <option key={y}>{y}</option>)}</select></label>
        </div>
        <div className="field">I am<Segmented<Gender> value={d.gender} onChange={v => set('gender', v)} options={[{ v: 'woman', label: 'Woman' }, { v: 'man', label: 'Man' }, { v: 'nonbinary', label: 'Non-binary' }]} /></div>
        <div className="field">Show me<Segmented<Seeking> value={d.seeking} onChange={v => set('seeking', v)} options={[{ v: 'women', label: 'Women' }, { v: 'men', label: 'Men' }, { v: 'everyone', label: 'Everyone' }]} /></div>
        <div className="field">Looking for<Segmented<Intent> value={d.intent} onChange={v => set('intent', v)} options={(Object.keys(INTENT_LABEL) as Intent[]).map(v => ({ v, label: INTENT_LABEL[v] }))} /></div>
      </>}

      {step === 1 && <>
        <h2>Show a little <em>personality</em></h2>
        <div className="photo-row">
          <Portrait name={d.name} photoURL={d.photoURL} hue={d.hue} />
          <div>
            <b><Camera size={14} /> Card photo</b>
            <span className="muted">Use your Google photo, or a colour portrait if you&apos;d rather stay anonymous until you match.</span>
            <div className="hue-row">
              {initial.photoURL && <button type="button" className={`pill${d.photoURL ? ' on' : ''}`} onClick={() => set('photoURL', d.photoURL ? null : initial.photoURL)}>{d.photoURL ? 'Using Google photo' : 'Use Google photo'}</button>}
              {[340, 15, 45, 160, 210, 280].map(h => <button type="button" key={h} aria-label={`Colour ${h}`} className={`swatch${!d.photoURL && d.hue === h ? ' on' : ''}`} style={{ background: `hsl(${h} 70% 55%)` }} onClick={() => setD(x => ({ ...x, hue: h, photoURL: null }))} />)}
            </div>
          </div>
        </div>
        <label className="field">Bio <small>optional</small><textarea value={d.bio} maxLength={200} rows={2} placeholder="A line or two about you" onChange={e => set('bio', e.target.value)} /></label>
        <label className="field">What are you up to? <small>optional, shown on your card</small><input value={d.status} maxLength={80} placeholder="e.g. Looking for a badminton partner" onChange={e => set('status', e.target.value)} /></label>
        <div className="field">Interests <small>pick 3–6</small><Chips items={INTERESTS} active={d.interests} onToggle={s => toggle('interests', s)} max={6} /></div>
        <div className="field">Open to <small>pick at least one</small><Chips items={OPEN_TO} active={d.openTo} onToggle={s => toggle('openTo', s)} /></div>
      </>}

      {step === 2 && <>
        <h2>Answer <em>two prompts</em></h2>
        <p className="muted">Prompts give people something better to open with than “hi”.</p>
        {d.prompts.map((p, i) => (
          <div className="prompt-edit" key={i}>
            <select value={p.q} onChange={e => setPrompt(i, { q: e.target.value })}>{PROMPTS.map(q => <option key={q} disabled={q !== p.q && d.prompts.some(x => x.q === q)}>{q}</option>)}</select>
            <textarea value={p.a} rows={2} maxLength={140} placeholder="Your answer" onChange={e => setPrompt(i, { a: e.target.value })} />
          </div>
        ))}
      </>}

      {step === 3 && <>
        <h2>Smarter <em>matches</em></h2>
        <p className="muted">Optional. With location on, Pulse quietly learns your rhythm — night owl or early bird, explorer or creature of habit — and uses it to find people whose days fit yours. Your location is never shown to anyone and never leaves your phone; only those lifestyle hints are used.</p>
        <div className="location-box">
          <div><MapPin size={18} /><div><b>Lifestyle matching</b><span>{locationOn ? 'On — matches get better over the next few days.' : 'Off — matching still works from your quiz and interests.'}</span></div></div>
          {locationOn ? <span className="signal">ON</span> : <button type="button" className="secondary-button" onClick={requestLocation}>Turn on</button>}
        </div>
      </>}

      <div className="builder-foot">
        {step > 0 ? <button type="button" className="ghost-button" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</button> : onCancel ? <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button> : <span />}
        <button type="button" className="primary-button" disabled={!valid[step] || saving} onClick={() => last ? onDone(d) : setStep(step + 1)}>
          {mode === 'edit' && last ? (saving ? 'Saving…' : 'Save profile') : step === 3 ? <>Personality quiz <Sparkles size={16} /></> : <>Continue <ArrowRight size={16} /></>}
        </button>
      </div>
    </section>
  )
}

/** Lets people pick a quick or full quiz, then runs it. */
export function QuizIntro({ onDone, onBack }: { onDone: (answers: number[]) => void; onBack?: () => void }) {
  const [len, setLen] = useState<number | null>(null)
  if (len) return <Calibration total={len} onBack={() => setLen(null)} onDone={onDone} />
  return (
    <section className="builder">
      <span className="panel-kicker">PERSONALITY QUIZ</span>
      <h2>How do you <em>tick?</em></h2>
      <p className="muted">Quick everyday questions — no right answers. Pulse uses them to find people you&apos;ll naturally get along with, and shows you a simple personality type at the end.</p>
      <div className="quiz-options">
        <button onClick={() => setLen(QUICK)}><Zap size={20} /><b>Quick</b><span>{QUICK} questions · ~1 min</span></button>
        <button onClick={() => setLen(QUESTIONS.length)}><Sparkles size={20} /><b>Full</b><span>{QUESTIONS.length} questions · ~4 min · more accurate</span></button>
      </div>
      {onBack && <div className="builder-foot"><button type="button" className="ghost-button" onClick={onBack}><ArrowLeft size={16} /> Back</button><span /></div>}
    </section>
  )
}

export function Calibration({ total, onDone, onBack }: { total: number; onDone: (answers: number[]) => void; onBack?: () => void }) {
  const [answers, setAnswers] = useState<number[]>([])
  const q = answers.length
  const item = QUESTIONS[Math.min(q, total - 1)]
  const pick = (i: number) => { const next = [...answers, i]; if (next.length === total) onDone(next); else setAnswers(next) }
  return (
    <section className="calibration">
      <div className="machine-head">
        <div><span className="panel-kicker">PERSONALITY QUIZ <span>{item.domain}</span></span><h2>Question <em>{String(q + 1).padStart(2, '0')}</em></h2></div>
        <div className="counter">{q + 1} / {total}</div>
      </div>
      <div className="tape"><span style={{ width: `${((q + 1) / total) * 100}%` }} /></div>
      <h3>{item.text}</h3>
      <div className="choices">{item.options.map((c, i) => <button key={c} onClick={() => pick(i)}><span>{String.fromCharCode(65 + i)}</span>{c}</button>)}</div>
      <div className="machine-foot">
        <button type="button" className="ghost-button" onClick={() => q ? setAnswers(answers.slice(0, -1)) : onBack?.()}><ArrowLeft size={14} /> {q ? 'Previous' : 'Back'}</button>
        <span>Answers stay private.</span>
      </div>
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
      <button className="ghost-button" onClick={() => setOpen(o => !o)}><ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : undefined }} /> {open ? 'Hide' : 'Show'} detailed traits</button>
      {open && <>
        <div className="bars">{FEATURES.map((f, i) => <div className="bar-row" key={f}><label>{f}</label><div><i style={{ width: `${Math.round(vector[i] * 100)}%` }} /></div><span>{Math.round(vector[i] * 100)}</span></div>)}</div>
        <p className="muted small">Personality code {code}. These traits come from your answers (and, if location is on, your daily rhythm). It&apos;s a fun, lightweight model — not a clinical test.</p>
      </>}
    </div>
  )
}
