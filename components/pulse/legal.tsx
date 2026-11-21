'use client'

import { useState } from 'react'
import { PRIVACY, TERMS, UPDATED, type Section } from '@/lib/legal-content'
import { Page } from './people'

export function Legal({ onClose, initial = 'terms' }: { onClose: () => void; initial?: 'terms' | 'privacy' }) {
  const [tab, setTab] = useState(initial)
  const doc: Section[] = tab === 'terms' ? TERMS : PRIVACY
  return (
    <Page title={tab === 'terms' ? 'Terms of Use' : 'Privacy Policy'} onBack={onClose}>
      <div className="legal">
        <div className="ig-switch">
          <button className={tab === 'terms' ? 'on' : ''} onClick={() => setTab('terms')}>Terms</button>
          <button className={tab === 'privacy' ? 'on' : ''} onClick={() => setTab('privacy')}>Privacy</button>
        </div>
        <small className="muted">Last updated {UPDATED}</small>
        {doc.map((s, i) => (
          <div key={i}>
            {s.h && <h4>{s.h}</h4>}
            {s.p && <p>{s.p}</p>}
            {s.li && <ul>{s.li.map((l, j) => <li key={j}>{l}</li>)}</ul>}
          </div>
        ))}
      </div>
    </Page>
  )
}
