'use client'

import { useMemo, useState } from 'react'
import { MapPin, MessageCircle, Radar, List, X } from 'lucide-react'
import { OPEN_TO, bearing, distanceLabel, isActive, lastSeen, metres, type Coarse, type Person, type Place } from '@/lib/social'
import { compatibility, compatibilityLabel, sharedTraits } from '@/lib/pulse-model'
import { Avatar, Chips, Ring } from './ui'

export type Located = { p: Person; m: number | null; vibe: number }
const RANGES = [500, 1000, 3000]

export function Explore({ me, here, people, places, onOpen, note }: {
  me: Person; here: Coarse | null; people: Person[]; places: Place[]; onOpen: (p: Person) => void; note?: string
}) {
  const [view, setView] = useState<'radar' | 'list'>('radar')
  const [range, setRange] = useState(1000)
  const [want, setWant] = useState<string | null>(null)
  const [activeOnly, setActiveOnly] = useState(false)
  const list: Located[] = useMemo(() => people
    .filter(p => p.uid !== me.uid && (!want || p.openTo?.includes(want)) && (!activeOnly || isActive(p)))
    .map(p => ({ p, m: here && p.loc ? metres(here, p.loc) : null, vibe: compatibility(me.vector, p.vector) }))
    .sort((a, b) => (a.m ?? 1e9) - (b.m ?? 1e9) || b.vibe - a.vibe), [people, me, here, want, activeOnly])
  const nearCount = list.filter(x => x.m !== null && x.m < range).length

  return (
    <section className="explore">
      <div className="discover-head">
        <div><span className="panel-kicker">EXPLORE</span><h2>Who&apos;s <em>around</em></h2></div>
        <div className="view-toggle">
          <button className={view === 'radar' ? 'on' : ''} onClick={() => setView('radar')} aria-label="Radar view"><Radar size={17} /></button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label="List view"><List size={17} /></button>
        </div>
      </div>
      {note && <p className="sample-note">{note}</p>}
      <div className="filter-row">
        <button className={`chip${activeOnly ? ' on' : ''}`} onClick={() => setActiveOnly(a => !a)}>● Active now</button>
        {OPEN_TO.map(o => <button key={o} className={`chip${want === o ? ' on' : ''}`} onClick={() => setWant(w => w === o ? null : o)}>{o}</button>)}
      </div>

      {view === 'radar' && (here
        ? <RadarView here={here} me={me} list={list} places={places} range={range} onOpen={onOpen} />
        : <div className="empty-state"><MapPin size={22} /><b>Location is off</b><span>Turn on location in Settings to see who is nearby on the radar. The list view still works.</span></div>)}
      {view === 'radar' && here && (
        <div className="range-row">
          <span>{nearCount} {nearCount === 1 ? 'person' : 'people'} within {range >= 1000 ? `${range / 1000} km` : `${range} m`}</span>
          <div className="segmented small">{RANGES.map(r => <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r >= 1000 ? `${r / 1000} km` : `${r} m`}</button>)}</div>
        </div>
      )}

      {(view === 'list' || here) && (
        <div className="people-list">
          {!list.length && <div className="empty-state"><b>No one here yet</b><span>Try removing a filter, or invite friends to join Pulse.</span></div>}
          {list.slice(0, view === 'radar' ? 6 : 200).map(({ p, m, vibe }) => <PersonRow key={p.uid} p={p} m={m} vibe={vibe} places={places} onOpen={() => onOpen(p)} />)}
          {view === 'radar' && list.length > 6 && <button className="ghost-button" onClick={() => setView('list')}>See all {list.length} people</button>}
        </div>
      )}
    </section>
  )
}

function RadarView({ here, me, list, places, range, onOpen }: { here: Coarse; me: Person; list: Located[]; places: Place[]; range: number; onOpen: (p: Person) => void }) {
  const pos = (to: Coarse) => {
    const d = Math.min(metres(here, to) / range, 1.04), b = bearing(here, to) * Math.PI / 180
    return { left: `${50 + Math.sin(b) * d * 46}%`, top: `${50 - Math.cos(b) * d * 46}%`, out: d > 1 }
  }
  return (
    <div className="radar">
      <div className="radar-ring r1" /><div className="radar-ring r2" /><div className="radar-ring r3" />
      <div className="radar-sweep" />
      <span className="radar-n">N</span>
      <span className="radar-scale">{range >= 1000 ? `${range / 1000} km` : `${range} m`}</span>
      {places.filter(pl => metres(here, pl.loc) <= range * 1.04).map(pl => { const s = pos(pl.loc); return <span key={pl.id} className="radar-place" style={{ left: s.left, top: s.top }} title={pl.name}>{pl.emoji}</span> })}
      {list.filter(x => x.m !== null && x.m <= range * 1.2).map(({ p }) => {
        const s = pos(p.loc!)
        return <button key={p.uid} className={`radar-dot${isActive(p) ? ' live' : ''}${s.out ? ' out' : ''}`} style={{ left: s.left, top: s.top }} onClick={() => onOpen(p)} aria-label={p.name}><Avatar name={p.name} photoURL={p.photoURL} hue={p.hue} size={34} /></button>
      })}
      <span className="radar-me"><Avatar name={me.name} photoURL={me.photoURL} hue={me.hue} size={40} ring /></span>
    </div>
  )
}

function PersonRow({ p, m, vibe, places, onOpen }: { p: Person; m: number | null; vibe: number; places: Place[]; onOpen: () => void }) {
  const at = places.find(pl => pl.id === p.placeId)
  return (
    <button className="person-row" onClick={onOpen}>
      <span className="avatar-wrap"><Avatar name={p.name} photoURL={p.photoURL} hue={p.hue} size={48} />{isActive(p) && <i className="live-dot" />}</span>
      <div>
        <b>{p.name}{p.sample && <small className="sample-tag inline">SAMPLE</small>}</b>
        <span className="row-status">{p.status || p.bio}</span>
        <small>{distanceLabel(m)}{at ? ` · ${at.emoji} ${at.name}` : ''}{p.locAt ? ` · ${lastSeen(p)}` : ''}</small>
      </div>
      <em>{vibe}%</em>
    </button>
  )
}

export function PersonSheet({ me, p, here, places, onClose, onChat }: { me: Person; p: Person; here: Coarse | null; places: Place[]; onClose: () => void; onChat: () => void }) {
  const vibe = compatibility(me.vector, p.vector), shared = sharedTraits(me.vector, p.vector)
  const m = here && p.loc ? metres(here, p.loc) : null
  const at = places.find(pl => pl.id === p.placeId)
  const common = p.interests.filter(i => me.interests.includes(i))
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label={p.name}>
        <button className="close-detail" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="sheet-head">
          <Avatar name={p.name} photoURL={p.photoURL} hue={p.hue} size={72} ring={isActive(p)} />
          <div><h3>{p.name}{p.sample && <small className="sample-tag inline">SAMPLE</small>}</h3><span>{p.program} · {p.year}</span>
            <small className="where"><MapPin size={12} /> {distanceLabel(m)}{at ? ` · at ${at.emoji} ${at.name}` : ''}{p.locAt ? ` · ${lastSeen(p)}` : ''}</small></div>
        </div>
        {p.status && <div className="status-bubble">“{p.status}”</div>}
        {p.bio && <p>{p.bio}</p>}
        <div className="vibe-box"><Ring value={vibe} size={52} /><div><b>{compatibilityLabel(vibe)}</b><span>{shared.length ? `You're both ${shared.join(', ')}.` : 'Different styles — could be a fun chat.'}</span></div></div>
        <h4>Open to</h4><Chips items={p.openTo} active={p.openTo.filter(o => me.openTo.includes(o))} />
        <h4>Interests{common.length ? ` · ${common.length} in common` : ''}</h4><Chips items={p.interests} active={common} />
        <button className="primary-button wide" onClick={onChat}><MessageCircle size={16} /> Say hi to {p.name}</button>
      </div>
    </div>
  )
}
