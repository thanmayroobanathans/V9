'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Check, ChevronDown, MapPin } from 'lucide-react'
import { INTENT_LABEL, INTERESTS, USERNAME_RE, normaliseUsername, usernameOwner, type Gender, type Intent, type Person, type Seeking } from '@/lib/social'
import { FEATURES, QUESTIONS } from '@/lib/pulse-model'
import { AXES, typeInfo, type Jung } from '@/lib/jung'
import { Avatar, Chips, Segmented } from './ui'
import { compressImage } from '@/lib/image'

export type Draft = Omit<Person, 'vector' | 'archetype' | 'archetypeCode' | 'jung'> & { vector?: number[]; jung?: Jung }

const YEARS = ['1st year', '2nd year', '3rd year', '4th year', '5th year', 'Masters', 'PhD']

/** Profile builder (Instagram-style). `mode="edit"` skips the quiz. */
export function ProfileBuilder({ initial, mode, locationOn, requestLocation, onDone, onCancel, saving }: {
  initial: Draft; mode: 'onboard' | 'edit'; locationOn: boolean; requestLocation: () => void
  onDone: (d: Draft, answers?: number[]) => void; onCancel?: () => void; saving?: boolean
}) {
  const [d, setD] = useState<Draft>(initial)
  const [step, setStep] = useState(0)
  const [nameOk, setNameOk] = useState(!!initial.username && USERNAME_RE.test(initial.username))
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }))
  const steps = mode === 'onboard' ? 4 : 3
  const valid = [
    nameOk && d.name.trim().length > 0 && d.age >= 18 && d.age <= 40 && d.program.trim().length > 0,
    d.interests.length >= 3,
    true,
  ]
  const last = step === steps - 1
  const toggle = (s: string) => set('interests', d.interests.includes(s) ? d.interests.filter(x => x !== s) : [...d.interests, s])

  if (step === 3) return <QuizIntro onBack={() => setStep(2)} onDone={answers => onDone(d, answers)} />

  return (
    <section className="builder page-in" key={step}>
      <div className="builder-top">
        {step > 0 ? <button type="button" className="icon-button plain" aria-label="Back" onClick={() => setStep(step - 1)}><ArrowLeft size={22} /></button>
          : onCancel ? <button type="button" className="icon-button plain" aria-label="Cancel" onClick={onCancel}><ArrowLeft size={22} /></button> : <span className="icon-spacer" />}
        <div className="dots">{Array.from({ length: steps }, (_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
        <span className="icon-spacer" />
      </div>

      {step === 0 && <>
        <PhotoPicker name={d.name} photoURL={d.photoURL} hue={d.hue} onChange={url => set('photoURL', url)} />
        <UsernameField uid={d.uid} value={d.username} original={initial.username} onChange={(v, ok) => { set('username', v); setNameOk(ok) }} />
        <label className="field">Name<input value={d.name} maxLength={24} placeholder="First name" onChange={e => set('name', e.target.value)} /></label>
        <div className="field-row">
          <label className="field small">Age<input type="number" inputMode="numeric" min={18} max={40} value={d.age || ''} onChange={e => set('age', Number(e.target.value))} /></label>
          <label className="field">Program<input value={d.program} maxLength={32} placeholder="CSE, ECE, BBA…" onChange={e => set('program', e.target.value)} /></label>
        </div>
        {d.age > 0 && d.age < 18 && <p className="error">18+ only</p>}
        <div className="field">Year<Segmented<string> value={d.year} onChange={v => set('year', v)} options={YEARS.map(y => ({ v: y, label: y.replace(' year', '') }))} /></div>
      </>}

      {step === 1 && <>
        <h2 className="step-title">About you</h2>
        <div className="field">I am<Segmented<Gender> value={d.gender} onChange={v => set('gender', v)} options={[{ v: 'woman', label: 'Woman' }, { v: 'man', label: 'Man' }, { v: 'nonbinary', label: 'Non-binary' }]} /></div>
        <div className="field">Show me<Segmented<Seeking> value={d.seeking} onChange={v => set('seeking', v)} options={[{ v: 'women', label: 'Women' }, { v: 'men', label: 'Men' }, { v: 'everyone', label: 'Everyone' }]} /></div>
        <div className="field">Looking for<Segmented<Intent> value={d.intent} onChange={v => set('intent', v)} options={(Object.keys(INTENT_LABEL) as Intent[]).map(v => ({ v, label: INTENT_LABEL[v] }))} /></div>
        <label className="field">Bio<textarea value={d.bio} maxLength={150} rows={3} placeholder="Write something about yourself" onChange={e => set('bio', e.target.value)} /><small>{d.bio.length}/150</small></label>
        <div className="field">Interests <small>pick 3–6</small><Chips items={INTERESTS} active={d.interests} onToggle={toggle} max={6} /></div>
      </>}

      {step === 2 && <>
        <h2 className="step-title">Location</h2>
        <p className="muted">Helps us find people with a similar daily routine. Your location is never shown.</p>
        <button type="button" className={`toggle-row${locationOn ? ' on' : ''}`} onClick={() => !locationOn && requestLocation()}>
          <MapPin size={20} /><span>{locationOn ? 'Location on' : 'Turn on location'}</span><i className="switch" />
        </button>
      </>}

      {mode === 'onboard' && step === 2 ? <>
        <button type="button" className="primary-button wide" onClick={() => setStep(3)}>Take personality quiz</button>
        <button type="button" className="ghost-button wide" disabled={saving} onClick={() => onDone(d)}>Skip for now</button>
        <p className="muted small center">The quiz is optional and improves your matches. You can take it later from your profile.</p>
      </> : <button type="button" className="primary-button wide" disabled={!valid[step] || saving} onClick={() => last ? onDone(d) : setStep(step + 1)}>
        {mode === 'edit' && last ? (saving ? 'Saving…' : 'Done') : 'Next'}
      </button>}
    </section>
  )
}

/** Round avatar with a camera badge — tap to upload your own photo. */
export function PhotoPicker({ name, photoURL, hue, onChange, size = 112 }: { name: string; photoURL: string | null; hue: number; onChange: (url: string) => void; size?: number }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true); setErr('')
    try { onChange(await compressImage(f, 320, 0.85, true)) } catch (e) { setErr(e instanceof Error ? e.message : 'Could not use photo') }
    setBusy(false)
  }
  return (
    <div className="photo-picker">
      <input ref={ref} type="file" accept="image/*" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
      <button type="button" className={`pp-avatar${busy ? ' busy' : ''}`} onClick={() => ref.current?.click()} aria-label="Change profile photo" style={{ width: size, height: size }}>
        <Avatar name={name} photoURL={photoURL} hue={hue} size={size} />
        <span className="badge-cam"><Camera size={16} /></span>
      </button>
      <button type="button" className="link-button blue" onClick={() => ref.current?.click()}>{photoURL ? 'Change photo' : 'Add profile photo'}</button>
      {err && <p className="error">{err}</p>}
    </div>
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

/** Username input with live availability check. */
function UsernameField({ uid, value, original, onChange }: { uid: string; value: string; original: string; onChange: (v: string, ok: boolean) => void }) {
  const [state, setState] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>(value && USERNAME_RE.test(value) ? 'ok' : 'idle')
  useEffect(() => {
    if (!value) { setState('idle'); onChange(value, false); return }
    if (!USERNAME_RE.test(value)) { setState('invalid'); onChange(value, false); return }
    if (value === original) { setState('ok'); onChange(value, true); return }
    setState('checking'); onChange(value, false)
    const t = setTimeout(() => {
      usernameOwner(value).then(owner => { const ok = !owner || owner === uid; setState(ok ? 'ok' : 'taken'); onChange(value, ok) }).catch(() => { setState('ok'); onChange(value, true) })
    }, 350)
    return () => clearTimeout(t)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <label className="field">Username
      <div className={`username-input ${state}`}>
        <span>@</span>
        <input value={value} maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="yourname" onChange={e => onChange(normaliseUsername(e.target.value), false)} />
        {state === 'ok' && <Check size={16} />}
      </div>
      <small className={state === 'taken' || state === 'invalid' ? 'error' : ''}>{state === 'taken' ? 'Taken' : state === 'invalid' ? '3–20 characters: a–z, 0–9, . _' : state === 'checking' ? 'Checking…' : ''}</small>
    </label>
  )
}
