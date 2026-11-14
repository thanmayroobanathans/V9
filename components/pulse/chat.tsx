'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, MessageCircle, Send } from 'lucide-react'
import type { Chat, Message, Person } from '@/lib/social'
import { compatibility, icebreakers } from '@/lib/pulse-model'
import { Avatar } from './ui'

export const otherOf = (c: Chat, uid: string) => c.memberUids.find(u => u !== uid) ?? ''

export function ChatList({ me, chats, people, onOpen }: { me: Person; chats: Chat[]; people: Record<string, Person>; onOpen: (id: string) => void }) {
  const list = [...chats].sort((a, b) => b.lastAt - a.lastAt)
  return (
    <section className="matches">
      <span className="panel-kicker">CHATS</span>
      <h2>Your <em>conversations</em></h2>
      {!list.length && <div className="empty-state"><MessageCircle size={22} /><b>No chats yet</b><span>Open someone on Explore and tap “Say hi”, or join a place room to talk with whoever is there.</span></div>}
      <div className="convo-list">{list.map(c => {
        const uid = otherOf(c, me.uid), o = c.members[uid], p = people[uid]
        return <button key={c.id} onClick={() => onOpen(c.id)}><Avatar name={o?.name} photoURL={o?.photoURL} hue={o?.hue ?? 0} /><div><b>{o?.name}{c.sample && <small className="sample-tag inline">SAMPLE</small>}</b><span>{c.lastMessage || 'Say hi 👋'}</span></div>{p && <em>{compatibility(me.vector, p.vector)}%</em>}</button>
      })}</div>
    </section>
  )
}

/** Generic conversation view used for direct chats and place rooms. */
export function ChatView({ meUid, header, messages, onSend, onBack, starters, empty, showNames, placeholder }: {
  meUid: string; header: ReactNode; messages: Message[]; onSend: (t: string) => void; onBack: () => void
  starters?: string[]; empty?: ReactNode; showNames?: boolean; placeholder: string
}) {
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages.length])
  const send = (t: string) => { const v = t.trim(); if (!v) return; onSend(v.slice(0, 1000)); setText('') }
  return (
    <section className="chat">
      <header className="chat-head"><button className="icon-button" onClick={onBack} aria-label="Back"><ArrowLeft size={18} /></button>{header}</header>
      <div className="chat-body">
        {!messages.length && <div className="chat-empty">{empty}{starters && <div className="icebreakers">{starters.map(q => <button key={q} onClick={() => send(q)}><MessageCircle size={13} /> {q}</button>)}</div>}</div>}
        {messages.map((m, i) => {
          const mine = m.senderUid === meUid
          const showTime = i === 0 || m.at - messages[i - 1].at > 15 * 60 * 1000
          const showName = showNames && !mine && (i === 0 || messages[i - 1].senderUid !== m.senderUid)
          return <div key={m.id}>
            {showTime && <div className="msg-time">{new Date(m.at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
            {showName && <div className="msg-name">{m.senderName}</div>}
            <div className={`bubble ${mine ? 'mine' : 'theirs'}`}>{m.text}</div>
          </div>
        })}
        <div ref={end} />
      </div>
      <form className="composer" onSubmit={e => { e.preventDefault(); send(text) }}><input value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} maxLength={1000} /><button className="send" disabled={!text.trim()} aria-label="Send"><Send size={18} /></button></form>
    </section>
  )
}

export const directStarters = (me: Person, other?: Person) => other ? icebreakers(me.vector, other.vector) : ['Hey! 👋']
