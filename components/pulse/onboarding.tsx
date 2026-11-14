'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, MapPin, Sparkles } from 'lucide-react'
import { INTENT_LABEL, INTERESTS, PROMPTS, type Gender, type Intent, type PromptAnswer, type PublicProfile, type Seeking } from '@/lib/dating'
import { FEATURES, QUESTIONS, classify, scoreAnswers } from '@/lib/pulse-model'
import { Chips, Portrait, Segmented } from './ui'

export type Draft = Omit<PublicProfile, 'vector' | 'archetype' | 'archetypeCode'> & { vector?: number[] }

const YEARS = ['1st year', '2nd year', '3rd year', '4th year', '5th year', 'Masters', 'PhD']

/** Profile builder. `mode="edit"` skips the calibration and returns straight away. */
export function ProfileBuilder({ initial, mode, location, requestLocation, onDone, onCancel, saving }: {
  initial: Draft; mode: 'onboard' | 'edit'; location: string; requestLocation: () => void
  onDone: (d: Draft, answers?: number[]) => void; onCancel?: () => void; saving?: boolean
}) {
  const [d, setD] = useState<Draft>(initial)
  const [step, setStep] = useState(0)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }))
  const steps = mode === 'onboard' ? ['Basics', 'About you', 'Prompts', 'Personality'] : ['Basics', 'About you', 'Prompts']
  const valid = [
    d.name.trim().length > 0 && d.age >= 18 && d.age <= 40 && d.program.trim().length > 0,
    d.bio.trim().length >= 10 && d.interests.length >= 3,
    d.prompts.filter(p => p.a.trim()).length >= 2,
  ]
  const last = step === steps.length - 1
  const toggleInterest = (s: string) => set('interests', d.interests.includes(s) ? d.interests.filter(x => x !== s) : [...d.interests, s])
  const setPrompt = (i: number, patch: Partial<PromptAnswer>) => set('prompts', d.prompts.map((p, j) => j === i ? { ...p, ...patch } : p))

  if (step === 3) return <Calibration onBack={() => setStep(2)} onDone={answers => onDone(d, answers)} />

  return (
    <section className="builder">
      <div className="steps">{steps.map((s, i) => <span key={s} className={i <= step ? 'on' : ''}>{s}</span>)}</div>
      {step === 0 && <>
        <h2>Let&apos;s set up <em>your profile</em></h2>
        <p className="muted">This is what other VIT students see when your card shows up. You can change it any time.</p>
        <div className="field-row">
          <label className="field">First name<input value={d.name} maxLength={24} onChange={e => set('name', e.target.value)} /></label>
          <label className="field small">Age<input type="number" min={18} max={40} value={d.age || ''} onChange={e => set('age', Number(e.target.value))} /></label>
        </div>
        {d.age > 0 && d.age < 18 && <p className="error">VIT Pulse dating is 18+ only.</p>}
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
            <span className="muted">Uses your Google photo, or a colour portrait if you prefer to stay anonymous until you match.</span>
            <div className="hue-row">
              {initial.photoURL && <button type="button" className={`pill${d.photoURL ? ' on' : ''}`} onClick={() => set('photoURL', d.photoURL ? null : initial.photoURL)}>{d.photoURL ? 'Using Google photo' : 'Use Google photo'}</button>}
              {[340, 15, 45, 160, 210, 280].map(h => <button type="button" key={h} aria-label={`Colour ${h}`} className={`swatch${!d.photoURL && d.hue === h ? ' on' : ''}`} style={{ background: `hsl(${h} 70% 55%)` }} onClick={() => setD(x => ({ ...x, hue: h, photoURL: null }))} />)}
            </div>
          </div>
        </div>
        <label className="field">Bio<textarea value={d.bio} maxLength={240} rows={3} placeholder="A couple of lines about you…" onChange={e => set('bio', e.target.value)} /><small>{d.bio.length}/240</small></label>
        <div className="field">Interests <small>pick 3–6</small><Chips items={INTERESTS} active={d.interests} onToggle={toggleInterest} max={6} /></div>
        <div className="location-box">
          <div><MapPin size={18} /><div><b>Campus signal</b><span>Optional. Only a coarse “on campus” tag is shown — never your coordinates.</span></div></div>
          {location === 'NOT REQUESTED' ? <button type="button" className="secondary-button" onClick={requestLocation}>Allow location</button> : <span className="signal">{location}</span>}
        </div>
      </>}

      {step === 2 && <>
        <h2>Answer <em>two prompts</em></h2>
        <p className="muted">Prompts give matches something better to open with than “hi”.</p>
        {d.prompts.map((p, i) => (
          <div className="prompt-edit" key={i}>
            <select value={p.q} onChange={e => setPrompt(i, { q: e.target.value })}>{PROMPTS.map(q => <option key={q} disabled={q !== p.q && d.prompts.some(x => x.q === q)}>{q}</option>)}</select>
            <textarea value={p.a} rows={2} maxLength={140} placeholder="Your answer" onChange={e => setPrompt(i, { a: e.target.value })} />
          </div>
        ))}
      </>}

      <div className="builder-foot">
        {step > 0 ? <button type="button" className="ghost-button" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</button> : onCancel ? <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button> : <span />}
        <button type="button" className="primary-button" disabled={!valid[step] || saving} onClick={() => last ? onDone(d) : setStep(step + 1)}>
          {mode === 'edit' && last ? (saving ? 'Saving…' : 'Save profile') : step === 2 ? <>Personality quiz <Sparkles size={16} /></> : <>Continue <ArrowRight size={16} /></>}
        </button>
      </div>
    </section>
  )
}

export function Calibration({ onDone, onBack }: { onDone: (answers: number[]) => void; onBack?: () => void }) {
  const [answers, setAnswers] = useState<number[]>([])
  const q = answers.length
  const item = QUESTIONS[Math.min(q, QUESTIONS.length - 1)]
  const pick = (i: number) => { const next = [...answers, i]; if (next.length === QUESTIONS.length) onDone(next); else setAnswers(next) }
  return (
    <section className="calibration">
      <div className="machine-head">
        <div><span className="panel-kicker">PERSONALITY CALIBRATION <span>{item.domain}</span></span><h2>Question <em>{String(q + 1).padStart(2, '0')}</em></h2></div>
        <div className="counter">{q + 1} / {QUESTIONS.length}</div>
      </div>
      <div className="tape"><span style={{ width: `${((q + 1) / QUESTIONS.length) * 100}%` }} /></div>
      <h3>{item.text}</h3>
      <div className="choices">{item.options.map((c, i) => <button key={c} onClick={() => pick(i)}><span>{String.fromCharCode(65 + i)}</span>{c}</button>)}</div>
      <div className="machine-foot">
        <button type="button" className="ghost-button" onClick={() => q ? setAnswers(answers.slice(0, -1)) : onBack?.()}><ArrowLeft size={14} /> {q ? 'Previous' : 'Back to profile'}</button>
        <span>Answers stay private. Only your match % is shared.</span>
      </div>
    </section>
  )
}

export function Dossier({ vector, compact }: { vector: number[]; compact?: boolean }) {
  const c = classify(vector)
  return (
    <div className="dossier-v9">
      <div className="primary-result"><span>YOUR ARCHETYPE</span><strong>{c.primary.code} {c.primary.name}</strong></div>
      <div className="bars">{FEATURES.map((f, i) => <div className="bar-row" key={f}><label>{f}</label><div><i style={{ width: `${Math.round(vector[i] * 100)}%` }} /></div><span>{Math.round(vector[i] * 100)}</span></div>)}</div>
      {!compact && <p className="muted">An eleven-feature vector from your 36 answers. Discovery ranks people by how well your vectors fit together — similarity plus a little complementarity.</p>}
    </div>
  )
}

export { scoreAnswers }
