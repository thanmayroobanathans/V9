'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Heart, MessageCircle, Send } from 'lucide-react'
import type { Match, Message, Person } from '@/lib/social'
import { icebreakers } from '@/lib/pulse-model'
import { fit } from '@/lib/match'
import { Avatar } from './ui'

export const otherOf = (m: Match, uid: string) => m.memberUids.find(u => u !== uid) ?? ''
const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d` }
/** A thread is unread when its latest message came from the other person after I last opened it. */
export const isUnread = (m: Match, me: string, lastRead: Record<string, number>) => !!m.lastMessage && m.lastSender !== me && m.lastAt > (lastRead[m.id] ?? 0)

export function Inbox({ me, matches, people, lastRead, onOpen }: {
  me: Person; matches: Match[]; people: Record<string, Person>; lastRead: Record<string, number>; onOpen: (id: string) => void
}) {
  const open = matches.filter(m => m.status === 'open').sort((a, b) => b.lastAt - a.lastAt)
  const fresh = open.filter(m => !m.lastMessage)
  const convos = open.filter(m => m.lastMessage)
  return (
    <section className="matches">
      <span className="panel-kicker">MATCHES</span>
      <h2>Your <em>matches</em></h2>
      {!open.length && <div className="empty-state"><Heart size={22} /><b>No matches yet</b><span>Swipe right on people you like. When they like you back, you&apos;ll match and can chat here.</span></div>}
      {fresh.length > 0 && <>
        <h4>New matches</h4>
        <div className="new-matches">{fresh.map(m => { const o = m.members[otherOf(m, me.uid)]; return <button key={m.id} onClick={() => onOpen(m.id)}><Avatar name={o?.name} photoURL={o?.photoURL} hue={o?.hue ?? 0} size={64} ring /><span>{o?.name}</span></button> })}</div>
      </>}
      {convos.length > 0 && <>
        <h4>Messages</h4>
        <div className="convo-list">{convos.map(m => {
          const uid = otherOf(m, me.uid), o = m.members[uid], p = people[uid], unread = isUnread(m, me.uid, lastRead)
          return <button key={m.id} className={unread ? 'unread' : ''} onClick={() => onOpen(m.id)}>
            <Avatar name={o?.name} photoURL={o?.photoURL} hue={o?.hue ?? 0} />
            <div><b>{o?.name}{m.sample && <small className="sample-tag inline">SAMPLE</small>}</b><span>{m.lastSender === me.uid ? 'You: ' : ''}{m.lastMessage}</span></div>
            <em>{unread ? <i className="dot" /> : null}{ago(m.lastAt)}{p ? ` · ${fit(me, p).score}%` : ''}</em>
          </button>
        })}</div>
      </>}
    </section>
  )
}

export function ChatView({ meUid, header, messages, hasMore, onLoadMore, onSend, onBack, starters, empty, placeholder, footer, banner }: {
  meUid: string; header: ReactNode; messages: Message[]; hasMore?: boolean; onLoadMore?: () => void
  onSend: (t: string) => void; onBack: () => void; starters?: string[]; empty?: ReactNode; placeholder: string; footer?: ReactNode; banner?: ReactNode
}) {
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const lastId = messages[messages.length - 1]?.id
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [lastId])
  const send = (t: string) => { const v = t.trim(); if (!v) return; onSend(v.slice(0, 1000)); setText('') }
  return (
    <section className="chat">
      <header className="chat-head"><button className="icon-button" onClick={onBack} aria-label="Back"><ArrowLeft size={18} /></button>{header}</header>
      {banner}
      <div className="chat-body">
        {hasMore && <button className="ghost-button load-more" onClick={onLoadMore}>Load earlier messages</button>}
        {!messages.length && <div className="chat-empty">{empty}{starters && <div className="icebreakers">{starters.map(q => <button key={q} onClick={() => send(q)}><MessageCircle size={13} /> {q}</button>)}</div>}</div>}
        {messages.map((m, i) => {
          const mine = m.senderUid === meUid
          const showTime = i === 0 || m.at - messages[i - 1].at > 15 * 60 * 1000
          return <div key={m.id}>
            {showTime && <div className="msg-time">{new Date(m.at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
            <div className={`bubble ${mine ? 'mine' : 'theirs'}${m.pending ? ' pending' : ''}`}>{m.text}</div>
          </div>
        })}
        <div ref={end} />
      </div>
      {footer ?? <form className="composer" onSubmit={e => { e.preventDefault(); send(text) }}><input value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} maxLength={1000} enterKeyHint="send" /><button className="send" disabled={!text.trim()} aria-label="Send"><Send size={18} /></button></form>}
    </section>
  )
}

export const matchStarters = (me: Person, other?: Person) => other ? icebreakers(me.vector, other.vector) : ['Hey! 👋']

export function MatchModal({ me, other, onChat, onClose }: { me: Person; other: Person; onChat: () => void; onClose: () => void }) {
  return (
    <div className="modal" role="dialog" aria-label="It's a match">
      <div className="modal-inner">
        <span className="panel-kicker">MUTUAL LIKE</span>
        <h2>It&apos;s a <em>match</em></h2>
        <div className="match-avatars"><Avatar name={me.name} photoURL={me.photoURL} hue={me.hue} size={96} ring /><Heart className="beat" size={28} /><Avatar name={other.name} photoURL={other.photoURL} hue={other.hue} size={96} ring /></div>
        <p className="muted">You and {other.name} liked each other · {fit(me, other).score}% match</p>
        <button className="primary-button" onClick={onChat}><MessageCircle size={16} /> Send a message</button>
        <button className="ghost-button" onClick={onClose}>Keep swiping</button>
      </div>
    </div>
  )
}
