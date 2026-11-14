'use client'

import { useMemo, useRef, useState } from 'react'
import { Compass, Heart, Info, RefreshCw, SlidersHorizontal, Star, X } from 'lucide-react'
import { INTENT_LABEL, genderMatches, isActive, type Intent, type Person, type Swipe } from '@/lib/social'
import { fit, fitLabel, jungOf, type Fit } from '@/lib/match'
import { natureTags } from '@/lib/nature'
import { typeInfo } from '@/lib/jung'
import { Chips, Portrait, Ring } from './ui'

type Filters = { min: number; max: number; intent: Intent | 'any' }

export function Discover({ me, candidates, onSwipe, loading, note }: {
  me: Person; candidates: Person[]; onSwipe: (p: Person, k: Swipe) => void; loading: boolean; note?: string
}) {
  const [filters, setFilters] = useState<Filters>({ min: 18, max: 30, intent: 'any' })
  const [showFilters, setShowFilters] = useState(false)
  const deck = useMemo(() => candidates
    .filter(p => genderMatches(me, p) && p.age >= filters.min && p.age <= filters.max && (filters.intent === 'any' || p.intent === filters.intent))
    .map(p => ({ p, f: fit(me, p) }))
    // Best match first; people active in the last day get a small nudge up the deck.
    .sort((a, b) => (b.f.score + (isActive(b.p) ? 2 : 0)) - (a.f.score + (isActive(a.p) ? 2 : 0))), [candidates, me, filters])

  return (
    <section className="discover">
      <div className="discover-head">
        <div><span className="panel-kicker">SWIPE</span><h2>Today&apos;s <em>picks</em></h2></div>
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
        {loading && <div className="empty-state"><RefreshCw size={22} className="spin" /><b>Finding people on your wavelength…</b></div>}
        {!loading && !deck.length && (
          <div className="empty-state"><Compass size={22} /><b>You&apos;re all caught up</b><span>No one new fits your filters right now. Widen them, or check back later — new students join every day.</span></div>
        )}
        {!loading && deck.slice(0, 3).reverse().map(({ p, f }, i, arr) => (
          <SwipeCard key={p.uid} me={me} p={p} f={f} depth={arr.length - 1 - i} onSwipe={k => onSwipe(p, k)} />
        ))}
      </div>
    </section>
  )
}

function SwipeCard({ me, p, f, depth, onSwipe }: { me: Person; p: Person; f: Fit; depth: number; onSwipe: (k: Swipe) => void }) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false })
  const [leaving, setLeaving] = useState<Swipe | null>(null)
  const [open, setOpen] = useState(false)
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const isTop = depth === 0
  const t = typeInfo(jungOf(p))
  const tags = natureTags(p.nature)

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
      <article className="swipe-card" style={{ transform, transition: drag.active && !leaving ? 'none' : 'transform .28s ease' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <Portrait name={p.name} photoURL={p.photoURL} hue={p.hue}>
          {stamp && <span className={`stamp ${stamp}`}>{stamp === 'like' ? 'LIKE' : stamp === 'nope' ? 'NOPE' : 'SUPER'}</span>}
          {p.sample && <span className="sample-tag">SAMPLE</span>}
          {isActive(p) && <span className="live-tag">● Active now</span>}
          <div className="card-overlay">
            <div className="card-title">
              <div><h3>{p.name}, {p.age}</h3><span>{p.program} · {p.year}</span></div>
              <Ring value={f.score} />
            </div>
            <div className="card-meta"><b>{fitLabel(f.score)}</b> · {t.emoji} {t.name}{tags.length ? ` · ${tags[0]}` : ''}</div>
            <p className="card-bio">{p.status ? `“${p.status}”` : p.bio}</p>
            {isTop && <button className="info-button" aria-label="More about this person" onPointerDown={e => e.stopPropagation()} onClick={() => setOpen(true)}><Info size={16} /></button>}
          </div>
        </Portrait>
        {open && (
          <div className="card-detail" onPointerDown={e => e.stopPropagation()}>
            <button className="close-detail" onClick={() => setOpen(false)} aria-label="Close details"><X size={18} /></button>
            <ProfileDetail me={me} p={p} f={f} />
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

/** Full-profile view (swipe card details and chat header). */
export function ProfileDetail({ me, p, f }: { me: Person; p: Person; f: Fit }) {
  const t = typeInfo(jungOf(p))
  const common = p.interests.filter(i => me.interests.includes(i))
  const tags = natureTags(p.nature)
  return <>
    <div className="detail-head"><h3>{p.name}, {p.age}{p.sample && <small className="sample-tag inline">SAMPLE</small>}</h3><Ring value={f.score} size={48} /></div>
    <span className="tag">{INTENT_LABEL[p.intent] ?? 'Open to see'}</span> <span className="tag soft">{t.emoji} {t.name}</span>{tags.map(x => <span key={x} className="tag soft"> {x}</span>)}
    {p.status && <div className="status-bubble">“{p.status}”</div>}
    {p.bio && <p>{p.bio}</p>}
    {p.prompts?.filter(pr => pr.a).map(pr => <div className="prompt-card" key={pr.q}><small>{pr.q}</small><b>{pr.a}</b></div>)}
    <h4>Why you might click · {fitLabel(f.score)}</h4>
    <ul className="why">{f.reasons.length ? f.reasons.map(r => <li key={r}>{r}.</li>) : <li>Different styles — could be a fun conversation.</li>}</ul>
    <h4>Open to</h4><Chips items={p.openTo ?? []} active={(p.openTo ?? []).filter(o => me.openTo?.includes(o))} />
    <h4>Interests{common.length ? ` · ${common.length} in common` : ''}</h4><Chips items={p.interests} active={common} />
  </>
}
