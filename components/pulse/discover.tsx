'use client'

import { useMemo, useRef, useState } from 'react'
import { Compass, Heart, Info, MapPin, RefreshCw, SlidersHorizontal, Star, X } from 'lucide-react'
import { INTENT_LABEL, genderMatches, type Intent, type PublicProfile, type Swipe } from '@/lib/dating'
import { compatibility, compatibilityLabel, complement, sharedTraits } from '@/lib/pulse-model'
import { Chips, Portrait, Ring } from './ui'

type Filters = { min: number; max: number; intent: Intent | 'any' }

export function Discover({ me, candidates, onSwipe, loading, onRefresh, note }: {
  me: PublicProfile; candidates: PublicProfile[]; onSwipe: (p: PublicProfile, k: Swipe) => void
  loading: boolean; onRefresh: () => void; note?: string
}) {
  const [filters, setFilters] = useState<Filters>({ min: 18, max: 30, intent: 'any' })
  const [showFilters, setShowFilters] = useState(false)
  const deck = useMemo(() => candidates
    .filter(p => genderMatches(me, p) && p.age >= filters.min && p.age <= filters.max && (filters.intent === 'any' || p.intent === filters.intent))
    .map(p => ({ p, score: compatibility(me.vector, p.vector) }))
    .sort((a, b) => b.score - a.score), [candidates, me, filters])
  const top = deck[0]

  return (
    <section className="discover">
      <div className="discover-head">
        <div><span className="panel-kicker">DISCOVER</span><h2>Today&apos;s <em>picks</em></h2></div>
        <button className="icon-button" aria-label="Filters" onClick={() => setShowFilters(s => !s)}><SlidersHorizontal size={18} /></button>
      </div>
      {showFilters && (
        <div className="filters">
          <label>Age {filters.min}–{filters.max}
            <div className="range-pair">
              <input type="range" min={18} max={40} value={filters.min} onChange={e => setFilters(f => ({ ...f, min: Math.min(Number(e.target.value), f.max) }))} />
              <input type="range" min={18} max={40} value={filters.max} onChange={e => setFilters(f => ({ ...f, max: Math.max(Number(e.target.value), f.min) }))} />
            </div>
          </label>
          <label>Looking for
            <select value={filters.intent} onChange={e => setFilters(f => ({ ...f, intent: e.target.value as Filters['intent'] }))}>
              <option value="any">Anything</option>
              {(Object.keys(INTENT_LABEL) as Intent[]).map(i => <option key={i} value={i}>{INTENT_LABEL[i]}</option>)}
            </select>
          </label>
        </div>
      )}
      {note && <p className="sample-note">{note}</p>}
      <div className="deck">
        {loading && <div className="empty-state"><RefreshCw size={22} className="spin" /><b>Finding people near your wavelength…</b></div>}
        {!loading && !top && (
          <div className="empty-state">
            <Compass size={22} /><b>You&apos;re all caught up</b>
            <span>No one new matches your filters right now. Widen your age range or check back later — new students calibrate every day.</span>
            <button className="secondary-button" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button>
          </div>
        )}
        {!loading && deck.slice(0, 3).reverse().map(({ p, score }, i, arr) => (
          <SwipeCard key={p.uid} me={me} p={p} score={score} depth={arr.length - 1 - i} onSwipe={k => onSwipe(p, k)} />
        ))}
      </div>
    </section>
  )
}

function SwipeCard({ me, p, score, depth, onSwipe }: { me: PublicProfile; p: PublicProfile; score: number; depth: number; onSwipe: (k: Swipe) => void }) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false })
  const [leaving, setLeaving] = useState<Swipe | null>(null)
  const [open, setOpen] = useState(false)
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const shared = sharedTraits(me.vector, p.vector)
  const comp = complement(me.vector, p.vector)
  const isTop = depth === 0

  function commit(k: Swipe) { if (leaving) return; setLeaving(k); setTimeout(() => onSwipe(k), 260) }
  const onDown = (e: React.PointerEvent) => { if (!isTop || open) return; start.current = { x: e.clientX, y: e.clientY, moved: false }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }
  const onMove = (e: React.PointerEvent) => { if (!start.current) return; const x = e.clientX - start.current.x, y = e.clientY - start.current.y; if (Math.abs(x) + Math.abs(y) > 6) start.current.moved = true; setDrag({ x, y, active: true }) }
  const onUp = () => {
    if (!start.current) return
    const moved = start.current.moved; start.current = null
    if (drag.x > 110) commit('like'); else if (drag.x < -110) commit('pass'); else if (drag.y < -130) commit('super')
    else { setDrag({ x: 0, y: 0, active: false }); if (!moved) setOpen(true) }
  }
  const out = leaving === 'like' ? 'translate(140%,-5%) rotate(22deg)' : leaving === 'pass' ? 'translate(-140%,-5%) rotate(-22deg)' : leaving === 'super' ? 'translate(0,-140%)' : null
  const transform = out ?? (isTop ? `translate(${drag.x}px,${drag.y}px) rotate(${drag.x / 18}deg)` : `translateY(${depth * 12}px) scale(${1 - depth * 0.04})`)
  const stamp = drag.x > 50 ? 'like' : drag.x < -50 ? 'nope' : drag.y < -70 ? 'super' : null

  return (
    <div className={`card-wrap${isTop ? ' top' : ''}`} style={{ zIndex: 10 - depth }}>
      <article className={`swipe-card${open ? ' open' : ''}`} style={{ transform, transition: drag.active && !leaving ? 'none' : 'transform .28s ease' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <Portrait name={p.name} photoURL={p.photoURL} hue={p.hue}>
          {stamp && <span className={`stamp ${stamp}`}>{stamp === 'like' ? 'LIKE' : stamp === 'nope' ? 'NOPE' : 'SUPER'}</span>}
          {p.sample && <span className="sample-tag">SAMPLE</span>}
          <div className="card-overlay">
            <div className="card-title">
              <div><h3>{p.name}, {p.age}</h3><span>{p.program} · {p.year}{p.campusSignal?.includes('CAMPUS') && <> · <MapPin size={11} /> on campus</>}</span></div>
              <Ring value={score} />
            </div>
            <div className="card-meta"><b>{compatibilityLabel(score)}</b>{shared.length > 0 && <> · you&apos;re both {shared.join(', ')}</>}</div>
            <p className="card-bio">{p.bio}</p>
            {isTop && <button className="info-button" aria-label="More about this person" onPointerDown={e => e.stopPropagation()} onClick={() => setOpen(true)}><Info size={16} /></button>}
          </div>
        </Portrait>
        {open && (
          <div className="card-detail" onPointerDown={e => e.stopPropagation()}>
            <button className="close-detail" onClick={() => setOpen(false)} aria-label="Close details"><X size={18} /></button>
            <div className="detail-head"><h3>{p.name}, {p.age}</h3><Ring value={score} size={48} /></div>
            <span className="tag">{INTENT_LABEL[p.intent]}</span>
            <p>{p.bio}</p>
            {p.prompts.map(pr => <div className="prompt-card" key={pr.q}><small>{pr.q}</small><b>{pr.a}</b></div>)}
            <h4>Interests</h4><Chips items={p.interests} active={p.interests.filter(i => me.interests.includes(i))} />
            <h4>Why Pulse paired you</h4>
            <ul className="why">
              <li>{score}% personality fit — {compatibilityLabel(score).toLowerCase()}.</li>
              {shared.length > 0 && <li>Shared strengths: {shared.join(', ')}.</li>}
              {comp && <li>Complement: you&apos;re {comp.mineHigher ? 'more' : 'less'} {comp.label} than {p.name} — good balance.</li>}
              <li>Archetype: {p.archetypeCode} {p.archetype}.</li>
            </ul>
          </div>
        )}
      </article>
      {isTop && (
        <div className="swipe-actions">
          <button className="act pass" aria-label="Pass" onClick={() => commit('pass')}><X size={26} /></button>
          <button className="act super" aria-label="Super like" onClick={() => commit('super')}><Star size={20} /></button>
          <button className="act like" aria-label="Like" onClick={() => commit('like')}><Heart size={26} /></button>
        </div>
      )}
    </div>
  )
}
