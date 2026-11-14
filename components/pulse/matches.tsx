'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Heart, MessageCircle, MoreVertical, Send } from 'lucide-react'
import type { Match, Message, PublicProfile } from '@/lib/dating'
import { compatibility, icebreakers } from '@/lib/pulse-model'
import { Avatar, Portrait, Ring } from './ui'

export const otherOf = (m: Match, uid: string) => m.memberUids.find(u => u !== uid) ?? ''

export function MatchList({ me, matches, profiles, onOpen }: { me: PublicProfile; matches: Match[]; profiles: Record<string, PublicProfile>; onOpen: (id: string) => void }) {
  const open = matches.filter(m => m.status === 'open').sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0))
  const fresh = open.filter(m => !m.lastMessage)
  const convos = open.filter(m => m.lastMessage)
  return (
    <section className="matches">
      <span className="panel-kicker">MATCHES</span>
      <h2>Your <em>connections</em></h2>
      {!open.length && <div className="empty-state"><Heart size={22} /><b>No matches yet</b><span>When you and someone both like each other, they show up here and you can start chatting.</span></div>}
      {fresh.length > 0 && <>
        <h4>New matches</h4>
        <div className="new-matches">{fresh.map(m => { const o = m.members[otherOf(m, me.uid)]; return <button key={m.id} onClick={() => onOpen(m.id)}><Avatar name={o?.name} photoURL={o?.photoURL} hue={o?.hue ?? 0} size={64} ring /><span>{o?.name}</span></button> })}</div>
      </>}
      {convos.length > 0 && <>
        <h4>Messages</h4>
        <div className="convo-list">{convos.map(m => {
          const uid = otherOf(m, me.uid), o = m.members[uid], p = profiles[uid]
          return <button key={m.id} onClick={() => onOpen(m.id)}><Avatar name={o?.name} photoURL={o?.photoURL} hue={o?.hue ?? 0} /><div><b>{o?.name}{m.sample && <small className="sample-tag inline">SAMPLE</small>}</b><span>{m.lastMessage}</span></div>{p && <em>{compatibility(me.vector, p.vector)}%</em>}</button>
        })}</div>
      </>}
    </section>
  )
}

export function Chat({ me, match, other, messages, onSend, onBack, onUnmatch }: {
  me: PublicProfile; match: Match; other?: PublicProfile; messages: Message[]
  onSend: (t: string) => void; onBack: () => void; onUnmatch: () => void
}) {
  const [text, setText] = useState('')
  const [menu, setMenu] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const o = match.members[otherOf(match, me.uid)]
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])
  const send = (t: string) => { const v = t.trim(); if (!v) return; onSend(v.slice(0, 1000)); setText('') }
  const score = other ? compatibility(me.vector, other.vector) : null
  return (
    <section className="chat">
      <header className="chat-head">
        <button className="icon-button" onClick={onBack} aria-label="Back to matches"><ArrowLeft size={18} /></button>
        <Avatar name={o?.name} photoURL={o?.photoURL} hue={o?.hue ?? 0} size={38} />
        <div><b>{o?.name}</b><small>{other ? `${other.program} · ${other.year}` : 'Matched'}{match.sample ? ' · SAMPLE' : ''}</small></div>
        {score !== null && <Ring value={score} size={40} />}
        <button className="icon-button" aria-label="Chat options" onClick={() => setMenu(m => !m)}><MoreVertical size={18} /></button>
        {menu && <div className="menu"><button onClick={() => { setMenu(false); if (confirm(`Unmatch ${o?.name}? This closes the conversation for both of you.`)) onUnmatch() }}>Unmatch</button></div>}
      </header>
      <div className="chat-body">
        {!messages.length && (
          <div className="chat-empty">
            <Portrait name={o?.name ?? ''} photoURL={o?.photoURL} hue={o?.hue ?? 0} />
            <b>You matched with {o?.name}</b>
            <span className="muted">Break the ice — Pulse picked these from what you have in common:</span>
            {other && <div className="icebreakers">{icebreakers(me.vector, other.vector).map(q => <button key={q} onClick={() => send(q)}><MessageCircle size={13} /> {q}</button>)}</div>}
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.senderUid === me.uid
          const showTime = i === 0 || m.at - messages[i - 1].at > 15 * 60 * 1000
          return <div key={m.id}>{showTime && <div className="msg-time">{new Date(m.at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</div>}<div className={`bubble ${mine ? 'mine' : 'theirs'}`}>{m.text}</div></div>
        })}
        <div ref={end} />
      </div>
      {match.status === 'open'
        ? <form className="composer" onSubmit={e => { e.preventDefault(); send(text) }}><input value={text} onChange={e => setText(e.target.value)} placeholder={`Message ${o?.name ?? ''}`} maxLength={1000} /><button className="send" disabled={!text.trim()} aria-label="Send"><Send size={18} /></button></form>
        : <div className="composer closed">This conversation was closed.</div>}
    </section>
  )
}

export function MatchModal({ me, other, onChat, onClose }: { me: PublicProfile; other: PublicProfile; onChat: () => void; onClose: () => void }) {
  return (
    <div className="modal" role="dialog" aria-label="It's a match">
      <div className="modal-inner">
        <span className="panel-kicker">MUTUAL SIGNAL</span>
        <h2>It&apos;s a <em>match</em></h2>
        <div className="match-avatars"><Avatar name={me.name} photoURL={me.photoURL} hue={me.hue} size={96} ring /><Heart className="beat" size={28} /><Avatar name={other.name} photoURL={other.photoURL} hue={other.hue} size={96} ring /></div>
        <p className="muted">You and {other.name} liked each other · {compatibility(me.vector, other.vector)}% fit</p>
        <button className="primary-button" onClick={onChat}><MessageCircle size={16} /> Send a message</button>
        <button className="ghost-button" onClick={onClose}>Keep swiping</button>
      </div>
    </div>
  )
}
