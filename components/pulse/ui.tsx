'use client'

import type { ReactNode } from 'react'

export function Avatar({ name, photoURL, hue, size = 44, ring }: { name: string; photoURL?: string | null; hue: number; size?: number; ring?: boolean }) {
  const inner = ring ? size - 8 : size
  const style = { width: inner, height: inner, fontSize: inner * 0.42, background: `linear-gradient(135deg,hsl(${hue} 55% 55%),hsl(${(hue + 40) % 360} 50% 38%))` }
  const face = <span className="avatar-v9" style={style}>{photoURL ? <img src={photoURL} alt="" referrerPolicy="no-referrer" /> : (name || '?')[0].toUpperCase()}</span>
  return ring ? <span className="ring-wrap" style={{ width: size, height: size }}><span className="ring-gap">{face}</span></span> : face
}

/** Full-bleed card art: photo if present, else a generated gradient portrait. */
export function Portrait({ name, photoURL, hue, children }: { name: string; photoURL?: string | null; hue: number; children?: ReactNode }) {
  return (
    <div className="portrait" style={{ background: `radial-gradient(120% 90% at 30% 20%,hsl(${hue} 75% 64%),hsl(${(hue + 50) % 360} 60% 30%) 60%,#0b0c0b)` }}>
      {photoURL ? <img src={photoURL} alt={name} referrerPolicy="no-referrer" draggable={false} /> : <span className="portrait-initial">{(name || '?')[0].toUpperCase()}</span>}
      {children}
    </div>
  )
}

export function Ring({ value, size = 54 }: { value: number; size?: number }) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r
  return (
    <span className="ring-score" style={{ width: size, height: size }}>
      <svg width={size} height={size}><circle cx={size / 2} cy={size / 2} r={r} className="track" /><circle cx={size / 2} cy={size / 2} r={r} className="fill" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} /></svg>
      <b>{value}<small>%</small></b>
    </span>
  )
}

export function Chips({ items, active, onToggle, max }: { items: string[]; active?: string[]; onToggle?: (s: string) => void; max?: number }) {
  return (
    <div className="chips">
      {items.map(s => {
        const on = active?.includes(s)
        const disabled = !on && max !== undefined && (active?.length ?? 0) >= max
        return onToggle
          ? <button type="button" key={s} className={`chip${on ? ' on' : ''}`} disabled={disabled} onClick={() => onToggle(s)}>{s}</button>
          : <span key={s} className={`chip${active?.includes(s) ? ' on' : ''}`}>{s}</span>
      })}
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return <div className="segmented">{options.map(o => <button type="button" key={o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>{o.label}</button>)}</div>
}
