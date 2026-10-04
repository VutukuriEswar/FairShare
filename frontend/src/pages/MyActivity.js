import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import Loader from '../components/Loader';
import MultiplierBadge from '../components/MultiplierBadge';
import { fmtPct } from '../utils/share';
const CAT_EMOJI = { dataset: '📦', paper: '📄', docs: '📖', training: '🏋️', debugging: '🐛', tutorial: '🎓', other: '📌' };
export default function MyActivity() {
  const [recs, setRecs] = useState([]); const [teams, setTeams] = useState([]); const [msg, setMsg] = useState(''); const [loading, setLoading] = useState(true);
  async function load() { setLoading(true); try { setRecs((await api('/me/records')).records || []); setTeams((await api('/teams')).teams || []); } catch (e) { setMsg(e.message); } setLoading(false); }
  useEffect(() => { load(); }, []);
  const { totalMins, confirmedMins } = useMemo(() => {
    const total = recs.reduce((s, r) => s + Number(r.minutes || 0), 0);
    const conf = recs.filter((r) => r.status === 'confirmed').reduce((s, r) => s + Number(r.minutes || 0) * Number(r.multiplier || 1), 0);
    return { totalMins: total, confirmedMins: conf };
  }, [recs]);
  if (loading) return <Loader label="🕒 Loading your activity percentages…" />;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="neon-hero">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>🕒 My activity</h2>
          <span className="hero-badge">🔒 immutable logs</span>
        </div>
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-num">⏱️ {Math.round(totalMins)}</div><div className="kpi-label">total min = 100%</div></div>
          <div className="kpi"><div className="kpi-num">⚡ {Math.round(confirmedMins)}</div><div className="kpi-label">weighted min (×mult)</div></div>
          <div className="kpi"><div className="kpi-num">✅ {recs.filter((r) => r.status === 'confirmed').length}/{recs.length}</div><div className="kpi-label">confirmed share</div></div>
        </div>
        {msg && <p role="status">⚠️ {msg}</p>}
      </section>
      <div className="quote">🔒 Logs are <strong>permanent</strong> — no edit, no delete. ⏳ <strong>Pending</strong> needs any 1 teammate ✅ to count. ✅ <strong>Confirmed</strong> counts with link multiplier. Each log shows its <strong>% of your total minutes</strong>. Log from a team page below ⬇️.</div>
      {teams.length === 0 ? <p className="muted">📭 No teams — <Link to="/create">create one ➕</Link> or paste a GitHub link on <Link to="/">home 🏠</Link> for instant analysis.</p> : <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{teams.map((t) => <Link key={t.id} className="btn small" to={`/teams/${t.id}`}>📝 Log in {t.name}</Link>)}</p>}
      <div className="grid two">
        {recs.map((r) => {
          const pct = totalMins ? (100 * Number(r.minutes || 0)) / totalMins : 0;
          return (
            <div key={r.local_id} className="card glass">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>{CAT_EMOJI[r.category] || '📌'} {r.topic}</strong>
                <span className={`pill ${r.status === 'confirmed' ? 'shared' : 'pending'}`}>{r.status === 'confirmed' ? '✅ confirmed' : r.status === 'flagged' ? '🚩 flagged' : '⏳ pending'}</span>
                <span className="pill" title="Share of your total logged minutes">📊 {fmtPct(pct)}</span>
              </div>
              <div className="neon-bar" style={{ marginTop: 8 }}><div style={{ width: `${Math.min(100, pct)}%` }} /></div>
              <p className="muted">⏱️ {r.minutes} min ({fmtPct(pct)} of your {Math.round(totalMins)} min) · 🔗 {r.link_domain || 'no link'} {r.link_url && `(×${r.multiplier})`} · 📅 {r.started_at}</p>
              <MultiplierBadge mult={r.multiplier} verified={r.link_verified} />
              <p className="muted">🔒 Immutable — cannot edit/delete.</p>
            </div>
          );
        })}
      </div>
      {recs.length === 0 && <p className="muted">📭 No logs yet — open a team and use the 📝 Log wizard with 🔍 preview.</p>}
    </div>
  );
}
