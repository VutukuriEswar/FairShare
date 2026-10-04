import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import Loader from '../components/Loader';
import EvidenceCard from '../components/EvidenceCard';
import RadarChart from '../components/RadarChart';
import Timeline from '../components/Timeline';
import StageCoverageChart from '../components/StageCoverageChart';
import { enrichReportPeople, fmtPct } from '../utils/share';
export default function Report() {
  const { id } = useParams(); const [rep, setRep] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api(`/teams/${id}/report`).then(setRep).catch((e) => setErr(e.message)); }, [id]);
  const { people, total } = useMemo(() => enrichReportPeople(rep?.people || []), [rep]);
  if (err) return <div className="card">⚠️ Error: {err}</div>;
  if (!rep) return <Loader label="👑 Building royal team report with percentages…" />;
  async function refresh() { try { await api(`/teams/${id}/github/refresh`, { method: 'POST' }); const r = await api(`/teams/${id}/report`); setRep(r); } catch (e) { setErr(e.message); } }
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="neon-hero">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>👑 {rep.team.name} — team report</h2>
          <span className="hero-badge">🤝 same for everyone</span>
        </div>
        <p style={{ color: '#EDE7FF', margin: '6px 0' }}>💬 Evidence for a fair conversation, not a verdict. 📌 {rep.note}</p>
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-num">👥 {people.length}</div><div className="kpi-label">members</div></div>
          <div className="kpi"><div className="kpi-num">⭐ {Math.round(total)}</div><div className="kpi-label">total pts = 100%</div></div>
          <div className="kpi"><div className="kpi-num">🏆 {people[0]?.name?.split(' ')[0] || '—'}</div><div className="kpi-label">top impact {fmtPct(people[0]?.impactPct || 0)}</div></div>
          <div className="kpi"><div className="kpi-num">📅 {rep.team.deadline ? new Date(rep.team.deadline).toLocaleDateString() : '—'}</div><div className="kpi-label">deadline</div></div>
        </div>
        <div style={{ background: 'rgba(0,0,0,.28)', borderRadius: 14, padding: 12, border: '1px solid rgba(255,255,255,.18)' }}>
          <strong style={{ fontSize: '.88rem' }}>⚖️ Team impact split (100%)</strong>
          <div className="stackbar" style={{ marginTop: 8 }}>
            {people.map((p) => <div key={p.email} title={`${p.name}: ${fmtPct(p.impactPct)}`} style={{ width: `${p.impactPct}%`, background: p.color }} />)}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {people.map((p) => <span key={p.email} className="pill" style={{ borderColor: p.color }}>{p.rank <= 3 ? ['🥇', '🥈', '🥉'][p.rank - 1] + ' ' : ''}{p.name} {fmtPct(p.impactPct)}</span>)}
          </div>
        </div>
        <p className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 0 }}>
          <button className="btn small sunny" onClick={refresh}>🔄 Refresh GitHub</button>
          <button className="btn small ghost" onClick={() => window.print()}>🖨️ Print / Export</button>
        </p>
      </section>
      <div className="grid two">{people.map((p, i) => <motion.div key={p.email} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.06, 0.4) }}><EvidenceCard person={p} impactPct={p.impactPct} rank={p.rank} /><RadarChart scores={p.scores} /></motion.div>)}</div>
      <div className="card glass"><h3>📈 Activity timeline</h3><Timeline items={rep.timeline} /></div>
      <div className="card glass"><h3>🧠 ML stage coverage</h3><StageCoverageChart people={rep.people} stages={rep.stages} /></div>
      <div className="card glass"><h3>🧪 Experiment ledger</h3>{rep.people.every((p) => !(p.github?.metrics || []).length) ? <p className="muted">🌱 No metrics yet — metrics like <code>accuracy: 0.82</code> in commits/notebooks will appear here.</p> : rep.people.map((p) => (p.github?.metrics || []).map((m, i) => <p key={p.email + i} className="quote" style={{ margin: '8px 0' }}>🏅 <strong>{p.name}</strong> <code>{m.sha}</code>: 📊 {JSON.stringify(m.values)} (Δ {JSON.stringify(m.delta)}) 📅 {m.date}</p>))}</div>
      <div className="card glass"><h3>⚙️ Hyperparameter trail</h3>{rep.people.every((p) => !(p.github?.hps || []).length) ? <p className="muted">🌱 No hyperparameter changes detected yet.</p> : rep.people.map((p) => (p.github?.hps || []).map((h, i) => <p key={p.email + 'h' + i}>🔧 <strong>{p.name}</strong> <code>{h.sha}</code>: {JSON.stringify(h.changes)}</p>))}</div>
      <div className="card glass"><h3>🕵️ Not detectable</h3><p className="muted">Fairness means naming what we <em>cannot</em> see 👀:</p><ul>{rep.not_detectable.map((n) => <li key={n}>🔍 {n}</li>)}</ul></div>
      <div className="card glass no-print"><h3>🔗 Identity merge</h3><p className="muted">One person, several git names? 🧑‍💻 Map git authors to teammates.</p><IdentityTool teamId={id} people={rep.people} /></div>
    </div>
  );
}
function IdentityTool({ teamId, people }) {
  const [author, setAuthor] = useState(''); const [uid, setUid] = useState(''); const [msg, setMsg] = useState('');
  async function save() { try { await api(`/teams/${teamId}/identities`, { method: 'PUT', body: JSON.stringify({ links: [{ git_author_name: author, git_email: '', user_id: uid }] }) }); setMsg('✅ Saved! Refresh GitHub to apply.'); } catch (e) { setMsg('⚠️ ' + e.message); } }
  return (<div><div className="field"><label>🧑‍💻 Git author name<input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="e.g. ada-lovelace" /></label></div>
    <div className="field"><label>👥 Map to teammate<select value={uid} onChange={(e) => setUid(e.target.value)}><option value="">— pick —</option>{people.map((p) => <option key={p.email} value={p.user_id || ''}>🧑‍🎓 {p.name} ({p.email})</option>)}</select></label></div>
    <button className="btn small" onClick={save}>💾 Save mapping</button>{msg && <p role="status">{msg}</p>}</div>);
}
