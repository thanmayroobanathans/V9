'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Flag, Grid3x3, Heart, ImagePlus, Lock, Plus, Search as SearchIcon, Settings, X } from 'lucide-react'
import {
  createPost, deletePost, likeInfo, report, searchPeople, setLike, watchPosts,
  type Follow, type Person, type Post,
} from '@/lib/social'
import { compressImage } from '@/lib/image'
import { typeInfo } from '@/lib/jung'
import { jungOf, quizTaken } from '@/lib/match'
import { Avatar } from './ui'

export type FollowState = 'none' | 'requested' | 'following'

/** Full-screen page with an Instagram-style top bar. */
export function Page({ title, onBack, right, children }: { title: string; onBack: () => void; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="fullpage">
      <header className="page-bar"><button className="icon-button plain" onClick={onBack} aria-label="Back"><ArrowLeft size={24} /></button><b>{title}</b><span className="page-right">{right}</span></header>
      <div className="page-body">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Profile — same layout for you and for others (Instagram style)
// ---------------------------------------------------------------------------
export function ProfileScreen({ me, person, followState, followsMe, chatId, counts, onFollow, onUnfollow, onMessage, onEdit, onSettings, onLists, onReport, onQuiz }: {
  me: Person; person: Person; followState?: FollowState; followsMe?: boolean; chatId?: string | null
  counts?: { followers: number; following: number }
  onFollow?: () => void; onUnfollow?: () => void; onMessage?: (id: string) => void
  onEdit?: () => void; onSettings?: () => void; onLists?: (tab: 'followers' | 'following') => void; onReport?: () => void; onQuiz?: () => void
}) {
  const isMe = me.uid === person.uid
  const canSee = isMe || followState === 'following'
  const [posts, setPosts] = useState<Post[] | null>(canSee ? null : [])
  const [open, setOpen] = useState<Post | null>(null)
  const [composing, setComposing] = useState(false)
  useEffect(() => { if (!canSee) { setPosts([]); return } return watchPosts(person.uid, setPosts, () => setPosts([])) }, [person.uid, canSee])
  const t = typeInfo(jungOf(person))

  if (open) return <PostView post={open} owner={person} me={me.uid} editable={isMe} onBack={() => setOpen(null)} />
  if (composing) return <NewPost uid={me.uid} onDone={() => setComposing(false)} />

  return (
    <section className="profile page-in">
      <div className="ig-head">
        <Avatar name={person.name} photoURL={person.photoURL} hue={person.hue} size={86} ring />
        <div className="ig-stats">
          <div><b>{canSee ? posts?.length ?? '–' : '–'}</b><span>posts</span></div>
          {counts
            ? <><button onClick={() => onLists?.('followers')}><b>{counts.followers}</b><span>followers</span></button><button onClick={() => onLists?.('following')}><b>{counts.following}</b><span>following</span></button></>
            : <div><b>{person.age || '–'}</b><span>age</span></div>}
        </div>
      </div>
      <div className="ig-bio">
        <b>{person.name}</b>
        <span className="ig-sub">{person.program} · {person.year}{quizTaken(person) ? ` · ${t.emoji} ${t.name}` : ''}</span>
        {person.bio && <p>{person.bio}</p>}
        {person.interests?.length > 0 && <span className="ig-tags">{person.interests.map(i => <em key={i} className={!isMe && me.interests.includes(i) ? 'common' : ''}>#{i.toLowerCase().replace(/\s+/g, '')}</em>)}</span>}
      </div>
      {isMe && !quizTaken(person) && onQuiz && <button className="quiz-nudge" onClick={onQuiz}><span>✨</span><span><b>Take the personality quiz</b><small>Optional · 36 questions · better matches</small></span></button>}
      <div className="ig-actions">
        {isMe ? <>
          <button className="secondary-button" onClick={onEdit}>Edit profile</button>
          <button className="secondary-button" onClick={onSettings}><Settings size={16} /></button>
        </> : <>
          {followState === 'following'
            ? <button className="secondary-button" onClick={onUnfollow}>Following</button>
            : followState === 'requested'
              ? <button className="secondary-button" onClick={onUnfollow}>Requested</button>
              : <button className="primary-button" onClick={onFollow}>{followsMe ? 'Follow back' : 'Follow'}</button>}
          {chatId && <button className="secondary-button" onClick={() => onMessage?.(chatId)}>Message</button>}
          <button className="secondary-button narrow" aria-label="Report" onClick={onReport}><Flag size={16} /></button>
        </>}
      </div>
      <div className="ig-tabs"><span className="on"><Grid3x3 size={22} /></span></div>
      {canSee
        ? <div className="grid">
          {isMe && <button className="tile add" onClick={() => setComposing(true)} aria-label="New post"><Plus size={28} /></button>}
          {posts === null && Array.from({ length: 6 }, (_, i) => <span key={i} className="tile shimmer" />)}
          {posts?.map(p => <button key={p.id} className="tile" onClick={() => setOpen(p)}>{p.image ? <img src={p.image} alt="" loading="lazy" /> : <span className="tile-text">{p.text}</span>}</button>)}
        </div>
        : <div className="private"><span className="lock-ring"><Lock size={26} /></span><b>This account is private</b><span>Follow to see their photos</span></div>}
      {canSee && posts?.length === 0 && !isMe && <p className="muted center small">No posts yet</p>}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Single post — double-tap to like, with a heart burst
// ---------------------------------------------------------------------------
function PostView({ post, owner, me, editable, onBack }: { post: Post; owner: Person; me: string; editable?: boolean; onBack: () => void }) {
  const [info, setInfo] = useState<{ count: number; liked: boolean } | null>(null)
  const [burst, setBurst] = useState(0)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => { likeInfo(post.uid, post.id, me).then(setInfo).catch(() => setInfo({ count: 0, liked: false })) }, [post.uid, post.id, me])
  const set = async (on: boolean) => {
    if (!info || info.liked === on) return
    const prev = info
    setInfo({ count: info.count + (on ? 1 : -1), liked: on })
    try { await setLike(post.uid, post.id, me, on) } catch { setInfo(prev) }
  }
  const dbl = () => { setBurst(b => b + 1); set(true) }
  return (
    <Page title="Post" onBack={onBack}>
      <div className="post-head"><Avatar name={owner.name} photoURL={owner.photoURL} hue={owner.hue} size={32} /><b>{owner.username}</b></div>
      <div className="post-media" onDoubleClick={dbl}>
        {post.image ? <img src={post.image} alt="" /> : <div className="post-textcard">{post.text}</div>}
        {burst > 0 && <Heart key={burst} className="burst" size={96} />}
      </div>
      <div className="post-actions">
        <button className={`like${info?.liked ? ' on' : ''}`} onClick={() => set(!info?.liked)} aria-label={info?.liked ? 'Unlike' : 'Like'}><Heart size={26} /></button>
        {editable && (confirm
          ? <span className="inline-confirm">Delete post? <button className="link-button danger" onClick={async () => { await deletePost(post.uid, post.id).catch(() => {}); onBack() }}>Delete</button><button className="link-button" onClick={() => setConfirm(false)}>Cancel</button></span>
          : <button className="link-button muted-link" onClick={() => setConfirm(true)}>Delete</button>)}
      </div>
      <div className="post-meta">
        <b>{info ? `${info.count} ${info.count === 1 ? 'like' : 'likes'}` : ' '}</b>
        {post.image && post.text && <p><b>{owner.username}</b> {post.text}</p>}
        <small>{new Date(post.at).toLocaleDateString([], { day: 'numeric', month: 'long' })}</small>
      </div>
    </Page>
  )
}

function NewPost({ uid, onDone }: { uid: string; onDone: () => void }) {
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => { file.current?.click() }, [])
  const pick = async (f?: File) => { if (!f) return; try { setImage(await compressImage(f, 1080, 0.78)) } catch (e) { setErr(e instanceof Error ? e.message : 'Could not use image') } }
  const share = async () => {
    setBusy(true); setErr('')
    try { await createPost(uid, text.trim(), image); onDone() } catch (e) { setErr(e instanceof Error ? e.message : 'Could not post'); setBusy(false) }
  }
  return (
    <Page title="New post" onBack={onDone} right={<button className="link-button blue" disabled={busy || (!text.trim() && !image)} onClick={share}>{busy ? 'Sharing…' : 'Share'}</button>}>
      <input ref={file} type="file" accept="image/*" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
      <button className="new-media" onClick={() => file.current?.click()}>
        {image ? <img src={image} alt="" /> : <span><ImagePlus size={34} /><b>Select a photo</b></span>}
      </button>
      {image && <button className="link-button" onClick={() => setImage(null)}><X size={14} /> Remove photo</button>}
      <textarea className="caption" value={text} maxLength={500} rows={3} placeholder="Write a caption…" onChange={e => setText(e.target.value)} />
      {err && <p className="error">{err}</p>}
    </Page>
  )
}

// ---------------------------------------------------------------------------
// Search by username
// ---------------------------------------------------------------------------
export type Suggestion = { p: Person; reason: string; state: FollowState }
export function Search({ meUid, onOpen, suggestions = [], onFollow }: { meUid: string; onOpen: (p: Person) => void; suggestions?: Suggestion[]; onFollow?: (p: Person) => void }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return }
    setLoading(true)
    const t = setTimeout(() => { searchPeople(q).then(r => setRes(r.filter(p => p.uid !== meUid))).catch(() => setRes([])).finally(() => setLoading(false)) }, 250)
    return () => clearTimeout(t)
  }, [q, meUid])
  return (
    <section className="search page-in">
      <label className="search-box"><SearchIcon size={18} /><input value={q} autoCapitalize="none" autoCorrect="off" placeholder="Search" onChange={e => setQ(e.target.value)} />{q && <button className="icon-button plain" onClick={() => setQ('')} aria-label="Clear"><X size={16} /></button>}</label>
      <div className="list">
        {loading && !res.length && Array.from({ length: 3 }, (_, i) => <div key={i} className="row"><span className="shimmer dot44" /><div><span className="shimmer line" /><span className="shimmer line short" /></div></div>)}
        {res.map(p => <button key={p.uid} className="row" onClick={() => onOpen(p)}><Avatar name={p.name} photoURL={p.photoURL} hue={p.hue} size={44} /><div><b>{p.username}</b><span>{p.name} · {p.program}</span></div></button>)}
      </div>
      {!loading && q.trim().length >= 2 && !res.length && <p className="muted small center">No accounts found</p>}
      {q.trim().length < 2 && <>
        <h4 className="list-title">Suggested for you</h4>
        <div className="list">
          {suggestions.map(({ p, reason, state }, i) => (
            <div key={p.uid} className="row suggest" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              <button className="row-main" onClick={() => onOpen(p)}><Avatar name={p.name} photoURL={p.photoURL} hue={p.hue} size={44} /><div><b>{p.username || p.name}</b><span>{p.name}</span><small>{reason}</small></div></button>
              {state === 'none'
                ? <button className="primary-button small" onClick={() => onFollow?.(p)}>Follow</button>
                : <button className="secondary-button small" onClick={() => onOpen(p)}>{state === 'requested' ? 'Requested' : 'Following'}</button>}
            </div>
          ))}
          {!suggestions.length && <p className="muted small center">No suggestions yet — more students are joining every day.</p>}
        </div>
      </>}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Requests + lists (only ever shown to the owner)
// ---------------------------------------------------------------------------
export function Requests({ incoming, onAccept, onDecline }: { incoming: Follow[]; onAccept: (f: Follow) => void; onDecline: (f: Follow) => void }) {
  const pending = incoming.filter(f => f.status === 'pending')
  if (!pending.length) return null
  return <div className="requests">
    <h4>Follow requests</h4>
    <div className="list">{pending.map(f => (
      <div key={f.id} className="row">
        <Avatar name={f.fromName} photoURL={f.fromPhoto} hue={f.fromHue} size={44} />
        <div><b>{f.fromUsername}</b><span>{f.fromName}</span></div>
        <button className="primary-button small" onClick={() => onAccept(f)}>Confirm</button>
        <button className="secondary-button small" onClick={() => onDecline(f)}>Delete</button>
      </div>
    ))}</div>
  </div>
}

export function FollowLists({ initial, incoming, outgoing, onRemoveFollower, onUnfollow, onBack, username }: {
  initial: 'followers' | 'following'; incoming: Follow[]; outgoing: Follow[]; username: string
  onRemoveFollower: (f: Follow) => void; onUnfollow: (f: Follow) => void; onBack: () => void
}) {
  const [tab, setTab] = useState(initial)
  const followers = incoming.filter(f => f.status === 'accepted'), following = outgoing.filter(f => f.status === 'accepted')
  const list = tab === 'followers' ? followers : following
  return (
    <Page title={username} onBack={onBack}>
      <div className="ig-switch"><button className={tab === 'followers' ? 'on' : ''} onClick={() => setTab('followers')}>{followers.length} followers</button><button className={tab === 'following' ? 'on' : ''} onClick={() => setTab('following')}>{following.length} following</button></div>
      <div className="list">
        {list.map(f => tab === 'followers'
          ? <div key={f.id} className="row"><Avatar name={f.fromName} photoURL={f.fromPhoto} hue={f.fromHue} size={44} /><div><b>{f.fromUsername}</b><span>{f.fromName}</span></div><button className="secondary-button small" onClick={() => onRemoveFollower(f)}>Remove</button></div>
          : <div key={f.id} className="row"><Avatar name={f.toName} photoURL={f.toPhoto} hue={f.toHue} size={44} /><div><b>{f.toUsername}</b><span>{f.toName}</span></div><button className="secondary-button small" onClick={() => onUnfollow(f)}>Following</button></div>)}
        {!list.length && <p className="muted small center">No one yet</p>}
      </div>
    </Page>
  )
}

// ---------------------------------------------------------------------------
// Report (grievance mechanism) — full page, no dropdowns
// ---------------------------------------------------------------------------
const REASONS = ['Harassment or bullying', 'Ragging', 'Fake profile', 'Nudity or sexual content', 'Hate speech', 'Spam or scam', 'Under 18', 'Something else']
export function ReportPage({ me, target, onBack }: { me: string; target?: Person; onBack: () => void }) {
  const [reason, setReason] = useState<string | null>(null)
  const [detail, setDetail] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const send = async () => { if (!reason) return; setBusy(true); try { await report(me, target?.uid ?? '', reason, detail); setDone(true) } catch { /* ignore */ } setBusy(false) }
  return (
    <Page title="Report" onBack={onBack}>
      {done ? <div className="done-state"><span className="check-ring">✓</span><b>Thanks for letting us know</b><span className="muted">We review every report.</span><button className="primary-button wide" onClick={onBack}>Done</button></div> : <>
        <b className="report-q">{target ? `Why are you reporting @${target.username}?` : 'What went wrong?'}</b>
        <div className="list">{REASONS.map(r => <button key={r} className={`row choice${reason === r ? ' on' : ''}`} onClick={() => setReason(r)}><span>{r}</span><i className="radio" /></button>)}</div>
        <textarea className="caption" rows={3} maxLength={1000} placeholder="Add details (optional)" value={detail} onChange={e => setDetail(e.target.value)} />
        <button className="primary-button wide" disabled={!reason || busy} onClick={send}>Submit report</button>
      </>}
    </Page>
  )
}

