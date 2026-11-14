'use client'

import { useMemo, useState } from 'react'
import { LogIn, LogOut, MapPin, Plus, Users } from 'lucide-react'
import { PLACE_EMOJI, distanceLabel, isActive, metres, type Coarse, type Person, type Place } from '@/lib/social'
import { Avatar } from './ui'

export const NEARBY_PLACE_M = 3000
export const CHECKIN_M = 250

export function Places({ me, here, places, people, onOpenRoom, onCheckIn, onCreate }: {
  me: Person; here: Coarse | null; places: Place[]; people: Person[]
  onOpenRoom: (id: string) => void; onCheckIn: (id: string | null) => void; onCreate: (name: string, emoji: string) => Promise<void>
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(PLACE_EMOJI[0])
  const [busy, setBusy] = useState(false)
  const list = useMemo(() => places
    .map(pl => ({ pl, m: here ? metres(here, pl.loc) : null, there: people.filter(p => p.placeId === pl.id && isActive(p)) }))
    .filter(x => x.m === null || x.m <= NEARBY_PLACE_M)
    .sort((a, b) => (a.m ?? 0) - (b.m ?? 0) || b.there.length - a.there.length), [places, people, here])

  return (
    <section className="places">
      <div className="discover-head">
        <div><span className="panel-kicker">PLACES</span><h2>Hangout <em>spots</em></h2></div>
        <button className="secondary-button" disabled={!here} onClick={() => setAdding(a => !a)}><Plus size={14} /> Add spot</button>
      </div>
      <p className="muted">Check in where you are so people nearby can find you. Every spot has its own chat room.</p>
      {!here && <div className="sample-note">Turn on location in Settings to check in and add spots. You can still read and join rooms.</div>}
      {adding && here && (
        <form className="add-place" onSubmit={async e => { e.preventDefault(); if (!name.trim()) return; setBusy(true); await onCreate(name.trim(), emoji); setBusy(false); setName(''); setAdding(false) }}>
          <b>New spot at your current location</b>
          <div className="emoji-row">{PLACE_EMOJI.map(em => <button type="button" key={em} className={em === emoji ? 'on' : ''} onClick={() => setEmoji(em)}>{em}</button>)}</div>
          <input value={name} maxLength={40} placeholder="e.g. Library 3rd floor, Gazebo, Foodys" onChange={e => setName(e.target.value)} />
          <button className="primary-button" disabled={!name.trim() || busy}>{busy ? 'Adding…' : 'Add & check in'}</button>
        </form>
      )}
      {!list.length && <div className="empty-state"><MapPin size={22} /><b>No spots nearby yet</b><span>Be the first — add the place you are at right now.</span></div>}
      <div className="place-list">
        {list.map(({ pl, m, there }) => {
          const mine = me.placeId === pl.id
          const canCheck = m !== null && m <= CHECKIN_M
          return (
            <div key={pl.id} className={`place-card${mine ? ' here' : ''}`}>
              <span className="place-emoji">{pl.emoji}</span>
              <div className="place-info">
                <b>{pl.name}{pl.sample && <small className="sample-tag inline">SAMPLE</small>}</b>
                <small>{distanceLabel(m)} · <Users size={11} /> {there.length} here now</small>
                {there.length > 0 && <div className="stack">{there.slice(0, 5).map(p => <Avatar key={p.uid} name={p.name} photoURL={p.photoURL} hue={p.hue} size={24} />)}</div>}
              </div>
              <div className="place-actions">
                <button className="secondary-button" onClick={() => onOpenRoom(pl.id)}>Room</button>
                {mine
                  ? <button className="ghost-button" onClick={() => onCheckIn(null)}><LogOut size={14} /> Leave</button>
                  : <button className="ghost-button" disabled={!canCheck} title={canCheck ? '' : 'Get within ~250 m to check in'} onClick={() => onCheckIn(pl.id)}><LogIn size={14} /> Check in</button>}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
