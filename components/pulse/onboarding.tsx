'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, MapPin, Sparkles } from 'lucide-react'
import { INTERESTS, OPEN_TO, type Person } from '@/lib/social'
import { FEATURES, QUESTIONS, classify } from '@/lib/pulse-model'
import { Chips, Portrait } from './ui'

export type Draft = Omit<Person, 'vector' | 'archetype' | 'archetypeCode'> & { vector?: number[] }

const YEARS = ['1st year', '2nd year', '3rd year', '4th year', '5th year', 'Masters', 'PhD']

/** Profile builder. `mode="edit"` skips the vibe quiz. */
export function ProfileBuilder({ initial, mode, locationOn, requestLocation, onDone, onCancel, saving }: {
  initial: Draft; mode: 'onboard' | 'edit'; locationOn: boolean; requestLocation: () => void
  onDone: (d: Draft, answers?: number[]) => void; onCancel?: () => void; saving?: boolean
}) {
  const [d, setD] = useState<Draft>(initial)
  const [step, setStep] = useState(0)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }))
  const steps = mode === 'onboard' ? ['You', 'Interests', 'Location', 'Vibe quiz'] : ['You', 'Interests', 'Location']
  const valid = [d.name.trim().length > 0 && d.program.trim().length > 0, d.interests.length >= 3 && d.openTo.length >= 1, true]
  const last = step === steps.length - 1
  const toggle = (k: 'interests' | 'openTo', s: string) => set(k, d[k].includes(s) ? d[k].filter(x => x !== s) : [...d[k], s])

  if (step === 3) return <Calibration onBack={() => setStep(2)} onDone={answers => onDone(d, answers)} />

  return (
    <section className="builder">
      <div className="steps">{steps.map((s, i) => <span key={s} className={i <= step ? 'on' : ''}>{s}</span>)}</div>
      {step === 0 && <>
        <h2>Set up <em>your profile</em></h2>
        <p className="muted">This is what other VIT students see when they explore people around campus.</p>
        <div className="field-row">
          <label className="field">First name<input value={d.name} maxLength={24} onChange={e => set('name', e.target.value)} /></label>
          <label className="field">Program<input value={d.program} maxLength={32} placeholder="e.g. CSE, ECE, BBA" onChange={e => set('program', e.target.value)} /></label>
        </div>
        <label className="field">Year<select value={d.year} onChange={e => set('year', e.target.value)}>{YEARS.map(y => <option key={y}>{y}</option>)}</select></label>
        <div className="photo-row">
          <Portrait name={d.name} photoURL={d.photoURL} hue={d.hue} />
          <div>
            <b><Camera size={14} /> Photo</b>
            <span className="muted">Use your Google photo, or a colour avatar.</span>
            <div className="hue-row">
              {initial.photoURL && <button type="button" className={`pill${d.photoURL ? ' on' : ''}`} onClick={() => set('photoURL', d.photoURL ? null : initial.photoURL)}>{d.photoURL ? 'Using Google photo' : 'Use Google photo'}</button>}
              {[340, 15, 45, 160, 210, 280].map(h => <button type="button" key={h} aria-label={`Colour ${h}`} className={`swatch${!d.photoURL && d.hue === h ? ' on' : ''}`} style={{ background: `hsl(${h} 70% 55%)` }} onClick={() => setD(x => ({ ...x, hue: h, photoURL: null }))} />)}
            </div>
          </div>
        </div>
        <label className="field">Bio <small>optional</small><textarea value={d.bio} maxLength={200} rows={2} placeholder="A line or two about you" onChange={e => set('bio', e.target.value)} /></label>
        <label className="field">What are you up to? <small>shown on your card</small><input value={d.status} maxLength={80} placeholder="e.g. Looking for a badminton partner" onChange={e => set('status', e.target.value)} /></label>
      </>}

      {step === 1 && <>
        <h2>What are you <em>into?</em></h2>
        <div className="field">Interests <small>pick 3–6</small><Chips items={INTERESTS} active={d.interests} onToggle={s => toggle('interests', s)} max={6} /></div>
        <div className="field">Open to <small>pick at least one</small><Chips items={OPEN_TO} active={d.openTo} onToggle={s => toggle('openTo', s)} /></div>
      </>}

      {step === 2 && <>
        <h2>Explore <em>around you</em></h2>
        <p className="muted">Pulse uses your location to show people and hangout spots nearby. It is rounded to about 100 m before it is saved, and others only ever see a rough distance like “~5 min walk”.</p>
        <div className="location-box">
          <div><MapPin size={18} /><div><b>Location</b><span>{locationOn ? 'On — you will appear on the radar.' : 'Off — you can still browse and chat, but distances stay hidden.'}</span></div></div>
          {locationOn ? <span className="signal">ON</span> : <button type="button" className="secondary-button" onClick={requestLocation}>Turn on</button>}
        </div>
      </>}

      <div className="builder-foot">
        {step > 0 ? <button type="button" className="ghost-button" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</button> : onCancel ? <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button> : <span />}
        <button type="button" className="primary-button" disabled={!valid[step] || saving} onClick={() => last ? onDone(d) : setStep(step + 1)}>
          {mode === 'edit' && last ? (saving ? 'Saving…' : 'Save profile') : step === 2 ? <>Vibe quiz <Sparkles size={16} /></> : <>Continue <ArrowRight size={16} /></>}
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
        <div><span className="panel-kicker">VIBE QUIZ <span>{item.domain}</span></span><h2>Question <em>{String(q + 1).padStart(2, '0')}</em></h2></div>
        <div className="counter">{q + 1} / {QUESTIONS.length}</div>
      </div>
      <div className="tape"><span style={{ width: `${((q + 1) / QUESTIONS.length) * 100}%` }} /></div>
      <h3>{item.text}</h3>
      <div className="choices">{item.options.map((c, i) => <button key={c} onClick={() => pick(i)}><span>{String.fromCharCode(65 + i)}</span>{c}</button>)}</div>
      <div className="machine-foot">
        <button type="button" className="ghost-button" onClick={() => q ? setAnswers(answers.slice(0, -1)) : onBack?.()}><ArrowLeft size={14} /> {q ? 'Previous' : 'Back'}</button>
        <span>Answers stay private. Only your vibe % is shown.</span>
      </div>
    </section>
  )
}

export function Dossier({ vector }: { vector: number[] }) {
  const c = classify(vector)
  return (
    <div className="dossier-v9">
      <div className="primary-result"><span>YOUR ARCHETYPE</span><strong>{c.primary.code} {c.primary.name}</strong></div>
      <div className="bars">{FEATURES.map((f, i) => <div className="bar-row" key={f}><label>{f}</label><div><i style={{ width: `${Math.round(vector[i] * 100)}%` }} /></div><span>{Math.round(vector[i] * 100)}</span></div>)}</div>
      <p className="muted">Eleven traits from your 36 answers. Explore uses them to show a vibe % — how naturally you would probably get along with someone.</p>
    </div>
  )
}
