'use client'

import { useEffect, useRef, useState } from 'react'
import { Flag, Heart, ImagePlus, Lock, MessageCircle, Search as SearchIcon, Trash2, UserCheck, UserPlus, X } from 'lucide-react'
import {
  createPost, deletePost, likeInfo, report, searchPeople, setLike, watchPosts,
  type Follow, type Person, type Post,
} from '@/lib/social'
import { compressImage } from '@/lib/image'
import { Avatar, Chips } from './ui'

export type FollowState = 'none' | 'requested' | 'following'

// ---------------------------------------------------------------------------
// Another person's profile. Card info is visible to all; posts only to accepted followers.
// ---------------------------------------------------------------------------
export function PersonPage({ me, p, followState, followsMe, chatId, onFollow, onUnfollow, onMessage, onClose }: {
  me: Person; p: Person; followState: FollowState; followsMe: boolean; chatId: string | null
  onFollow: () => void; onUnfollow: () => void; onMessage: (id: string) => void; onClose: () => void
}) {
  const [reporting, setReporting] = useState(false)
  const canSee = followState === 'following'
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet person-page" onClick={e => e.stopPropagation()} role="dialog" aria-label={p.name}>
        <button className="close-detail" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="pp-head">
          <Avatar name={p.name} photoURL={p.photoURL} hue={p.hue} size={84} />
          <div><h3>{p.name}{p.age ? `, ${p.age}` : ''}</h3><span>@{p.username}</span><small>{p.program} · {p.year}</small></div>
        </div>
        {p.bio && <p className="pp-bio">{p.bio}</p>}
        <div className="pp-actions">
          {followState === 'following'
            ? <button className="secondary-button" onClick={onUnfollow}><UserCheck size={15} /> Following</button>
            : followState === 'requested'
              ? <button className="secondary-button" onClick={onUnfollow}>Requested</button>
              : <button className="primary-button" onClick={onFollow}><UserPlus size={15} /> {followsMe ? 'Follow back' : 'Follow'}</button>}
          {chatId && <button className="secondary-button" onClick={() => onMessage(chatId)}><MessageCircle size={15} /> Message</button>}
          <button className="icon-button" aria-label="Report" onClick={() => setReporting(true)}><Flag size={16} /></button>
        </div>
        {p.interests?.length > 0 && <Chips items={p.interests} active={p.interests.filter(i => me.interests.includes(i))} />}
        {canSee ? <Posts owner={p.uid} me={me.uid} /> : <div className="private"><Lock size={22} /><b>Private account</b><span>Follow to see posts</span></div>}
        {reporting && <ReportForm me={me.uid} target={p} onClose={() => setReporting(false)} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Posts grid / feed with likes
// ---------------------------------------------------------------------------
export function Posts({ owner, me, editable }: { owner: string; me: string; editable?: boolean }) {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => watchPosts(owner, setPosts, e => setErr(e.message)), [owner])
  if (err) return <p className="muted small">Posts unavailable</p>
  if (!posts) return null
  return (
    <div className="posts">
      {editable && <Composer uid={owner} />}
      {!posts.length && <p className="muted small center">No posts yet</p>}
      {posts.map(p => <PostCard key={p.id} post={p} me={me} editable={editable} />)}
    </div>
  )
}

function PostCard({ post, me, editable }: { post: Post; me: string; editable?: boolean }) {
  const [info, setInfo] = useState<{ count: number; liked: boolean } | null>(null)
  useEffect(() => { likeInfo(post.uid, post.id, me).then(setInfo).catch(() => setInfo({ count: 0, liked: false })) }, [post.uid, post.id, me])
  const toggle = async () => {
    if (!info) return
    const on = !info.liked
    setInfo({ count: info.count + (on ? 1 : -1), liked: on })
    try { await setLike(post.uid, post.id, me, on) } catch { setInfo(info) }
  }
  return (
    <article className="post">
      {post.image && <img src={post.image} alt="" onDoubleClick={() => !info?.liked && toggle()} />}
      {post.text && <p>{post.text}</p>}
      <div className="post-foot">
        <button className={`like${info?.liked ? ' on' : ''}`} onClick={toggle} aria-label={info?.liked ? 'Unlike' : 'Like'}><Heart size={20} /> {info?.count ?? ''}</button>
        <small>{new Date(post.at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</small>
        {editable && <button className="ghost-button" aria-label="Delete post" onClick={() => { if (window.confirm('Delete this post?')) deletePost(post.uid, post.id) }}><Trash2 size={15} /></button>}
      </div>
    </article>
  )
}

function Composer({ uid }: { uid: string }) {
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const pick = async (f?: File) => { if (!f) return; try { setImage(await compressImage(f, 900, 0.75)) } catch (e) { setErr(e instanceof Error ? e.message : 'Could not use image') } }
  const post = async () => {
    setBusy(true); setErr('')
    try { await createPost(uid, text.trim(), image); setText(''); setImage(null) } catch (e) { setErr(e instanceof Error ? e.message : 'Could not post') }
    setBusy(false)
  }
  return (
    <div className="composer-card">
      <textarea value={text} maxLength={500} rows={2} placeholder="Share something…" onChange={e => setText(e.target.value)} />
      {image && <div className="preview"><img src={image} alt="" /><button className="icon-button" aria-label="Remove image" onClick={() => setImage(null)}><X size={16} /></button></div>}
      {err && <p className="error">{err}</p>}
      <div className="composer-row">
        <input ref={file} type="file" accept="image/*" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
        <button className="ghost-button" onClick={() => file.current?.click()}><ImagePlus size={18} /> Photo</button>
        <button className="primary-button" disabled={busy || (!text.trim() && !image)} onClick={post}>{busy ? 'Posting…' : 'Post'}</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Search by username
// ---------------------------------------------------------------------------
export function Search({ meUid, onOpen }: { meUid: string; onOpen: (p: Person) => void }) {
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
    <section className="search">
      <h2><em>Search</em></h2>
      <label className="search-box"><SearchIcon size={18} /><input value={q} autoCapitalize="none" autoCorrect="off" placeholder="Search username" onChange={e => setQ(e.target.value)} /></label>
      <div className="convo-list">
        {res.map(p => <button key={p.uid} onClick={() => onOpen(p)}><Avatar name={p.name} photoURL={p.photoURL} hue={p.hue} /><div><b>{p.username}</b><span>{p.name}</span></div></button>)}
      </div>
      {!loading && q.trim().length >= 2 && !res.length && <p className="muted small center">No results</p>}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Follow requests + lists (only ever shown to the owner)
// ---------------------------------------------------------------------------
export function Requests({ incoming, onAccept, onDecline }: { incoming: Follow[]; onAccept: (f: Follow) => void; onDecline: (f: Follow) => void }) {
  const pending = incoming.filter(f => f.status === 'pending')
  if (!pending.length) return null
  return <>
    <h4>Follow requests</h4>
    <div className="convo-list">{pending.map(f => (
      <div key={f.id} className="request-row">
        <Avatar name={f.fromName} photoURL={f.fromPhoto} hue={f.fromHue} />
        <div><b>{f.fromUsername}</b><span>{f.fromName}</span></div>
        <button className="primary-button small" onClick={() => onAccept(f)}>Accept</button>
        <button className="secondary-button small" onClick={() => onDecline(f)}>Delete</button>
      </div>
    ))}</div>
  </>
}

export function FollowLists({ incoming, outgoing, onRemoveFollower, onUnfollow }: { incoming: Follow[]; outgoing: Follow[]; onRemoveFollower: (f: Follow) => void; onUnfollow: (f: Follow) => void }) {
  const [tab, setTab] = useState<'followers' | 'following' | null>(null)
  const followers = incoming.filter(f => f.status === 'accepted'), following = outgoing.filter(f => f.status === 'accepted')
  return <>
    <div className="counts">
      <button onClick={() => setTab(tab === 'followers' ? null : 'followers')}><b>{followers.length}</b><span>Followers</span></button>
      <button onClick={() => setTab(tab === 'following' ? null : 'following')}><b>{following.length}</b><span>Following</span></button>
    </div>
    {tab && (
      <div className="convo-list">
        {(tab === 'followers' ? followers : following).map(f => (
          <div key={f.id} className="request-row">
            {tab === 'followers'
              ? <><Avatar name={f.fromName} photoURL={f.fromPhoto} hue={f.fromHue} /><div><b>{f.fromUsername}</b><span>{f.fromName}</span></div><button className="secondary-button small" onClick={() => onRemoveFollower(f)}>Remove</button></>
              : <><Avatar name={f.toName} photoURL={f.toPhoto} hue={f.toHue} /><div><b>{f.toUsername}</b><span>{f.toName}</span></div><button className="secondary-button small" onClick={() => onUnfollow(f)}>Unfollow</button></>}
          </div>
        ))}
        {!(tab === 'followers' ? followers : following).length && <p className="muted small center">Nobody yet</p>}
      </div>
    )}
  </>
}

// ---------------------------------------------------------------------------
// Report (grievance mechanism)
// ---------------------------------------------------------------------------
const REASONS = ['Harassment or bullying', 'Ragging', 'Fake profile or impersonation', 'Nudity or sexual content', 'Hate speech', 'Spam or scam', 'Underage', 'Other']
export function ReportForm({ me, target, onClose }: { me: string; target?: Person; onClose: () => void }) {
  const [reason, setReason] = useState(REASONS[0])
  const [detail, setDetail] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const send = async () => { setBusy(true); try { await report(me, target?.uid ?? '', reason, detail); setDone(true) } catch { /* ignore */ } setBusy(false) }
  return (
    <div className="report">
      {done ? <><b>Thanks — we&apos;ll review it.</b><button className="secondary-button" onClick={onClose}>Close</button></> : <>
        <b>{target ? `Report @${target.username}` : 'Report a problem'}</b>
        <select value={reason} onChange={e => setReason(e.target.value)}>{REASONS.map(r => <option key={r}>{r}</option>)}</select>
        <textarea rows={3} maxLength={1000} placeholder="Details (optional)" value={detail} onChange={e => setDetail(e.target.value)} />
        <div className="composer-row"><button className="ghost-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy} onClick={send}>Send</button></div>
      </>}
    </div>
  )
}
