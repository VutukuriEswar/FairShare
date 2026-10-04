import React from 'react';
import { motion } from 'framer-motion';
import ConfidenceBadge from './ConfidenceBadge';
import { fmtPct, avatarFor } from '../utils/share';
const AVATAR_BG = 'linear-gradient(135deg,rgba(124,92,255,.4),rgba(77,216,255,.25))';
export default function EvidenceCard({ person, impactPct = null, rank = null }) {
  const s = person.scores || {};
  const max = Math.max(1, ...['Code', 'Docs', 'Review', 'Research', 'Consistency'].map((k) => Number(s[k] || 0)));
  return (
    <motion.article className="card glass evidence" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} aria-label={`Evidence for ${person.name}`} style={{ borderLeftWidth: 6 }}>
      <h3>
        <span className="avatar" style={{ background: person.color ? `linear-gradient(135deg, ${person.color}55, rgba(0,0,0,.2))` : AVATAR_BG }} aria-hidden="true">{avatarFor(person.name)}</span>
        <span style={{ flex: 1 }}>{rank ? `${rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] + ' ' : `#${rank} `}` : ''}{person.name}</span>
        <ConfidenceBadge level={person.confidence} note={person.confidence_note} />
      </h3>
      {impactPct != null && (
        <p style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '6px 0' }}>
          <strong className="ring-num" style={{ fontSize: '1.5rem', color: person.color || 'var(--sun)' }}>{fmtPct(impactPct)}</strong>
          <span className="muted">of team impact · {s.total || 0} pts</span>
        </p>
      )}
      <p>💬 {person.summary}</p>
      <p className="muted">📝 Confirmed logs: <strong>{person.logs?.confirmed_minutes || 0} min</strong>{person.logs?.pending ? ` · ⏳ ${person.logs.pending} pending` : ''} · 💻 GitHub: <strong>{person.github?.commits || 0}</strong> commits, <strong>{person.github?.prs || 0}</strong> PRs</p>
      {(person.logs?.links || []).length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0' }}>{person.logs.links.map((l, i) => <span key={i} className="pill" title={l.title || l.url}>🔗 {l.domain || 'link'} ×{l.multiplier} {l.verified ? '✅' : '⚠️'}</span>)}</div>}
      {['Code', 'Docs', 'Review', 'Research', 'Consistency'].map((k) => (
        <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0' }}>
          <span style={{ width: 118, fontSize: '.85rem' }}>{k} <strong>{s[k] || 0}</strong></span>
          <div className="scorebar" style={{ flex: 1 }}><motion.div initial={{ width: 0 }} animate={{ width: Math.round(100 * (Number(s[k] || 0) / max)) + '%' }} transition={{ duration: 0.6 }} /></div>
        </div>
      ))}
      <p className="muted">⭐ Total <strong>{s.total || 0}</strong> pts{impactPct != null ? <> · <strong>{fmtPct(impactPct)}</strong> of team</> : null} — supporting number, not a verdict.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{(person.flags || []).map((f, i) => <span key={i} className="pill">🔍 {f.text}</span>)}</div>
      {person.crunch && <p className="pill pending" style={{ marginTop: 8 }}>⚠️ Last-minute crunch: &gt;70% activity in final 48h</p>}
    </motion.article>
  );
}
