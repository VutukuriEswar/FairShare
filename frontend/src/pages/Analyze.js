import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { API_BASE } from '../services/api';
import Loader from '../components/Loader';
import ContributionDonut from '../components/ContributionDonut';
import ShareBar from '../components/ShareBar';
import ContributorCard from '../components/ContributorCard';
import { enrichPeople, fmtPct, fmtNum, fmtLines, STAGE_EMOJI } from '../utils/share';

export default function Analyze() {
  const [q] = useSearchParams();
  const repo = q.get('repo') || '';
  const [data, setData] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('fs-instant') || 'null'); }
    catch { return null; }
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(!data);
  const [basis, setBasis] = useState('effortPct');

  useEffect(() => {
    if (data || !repo) return;
    setLoading(true);
    fetch(API_BASE + '/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_url: repo }),
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.detail || 'Analyze failed');
        setData(j);
        sessionStorage.setItem('fs-instant', JSON.stringify(j));
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [repo]);

  const { people, totals } = useMemo(
    () => enrichPeople(data?.people || []),
    [data]
  );

  const stageTotals = useMemo(() => {
    const m = {};
    for (const p of people)
      for (const [k, v] of Object.entries(p.stages || {})) m[k] = (m[k] || 0) + Number(v || 0);
    const total = Object.values(m).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v, pct: (100 * v) / total }));
  }, [people]);

  if (loading) return <Loader label="🔍 Reading commits → 📝 measuring lines → ⚖️ weighing files…" />;
  if (err)
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: '2.4rem' }}>⚠️</div>
        <h2>Couldn't analyze that repo</h2>
        <p className="muted">{err}</p>
        <p style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn" to="/">🏠 Try another link</Link>
          <button className="btn ghost" onClick={() => window.location.reload()}>🔄 Retry</button>
        </p>
      </div>
    );
  if (!data)
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: '2.4rem' }}>📭</div>
        <h2>Paste a repo to see the magic</h2>
        <p className="muted">Public GitHub URL → per-person percentages, no signup.</p>
        <Link className="btn" to="/">🏠 Go home</Link>
      </div>
    );

  const hasEffort = totals.hasEffort;
  const effectiveBasis = hasEffort ? basis : 'commitPct';
  const sorted = [...people].sort((a, b) => (b[effectiveBasis] || 0) - (a[effectiveBasis] || 0));
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <motion.section className="neon-hero" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="hero-tape">✨ instant analysis · effort-weighted</span>
          <span className="hero-badge">⚡ no signup</span>
          <span style={{ flex: 1 }} />
          <button
            className="btn small sunny no-print"
            onClick={() => { try { navigator.clipboard.writeText(window.location.href); } catch {} }}
            title="Copy shareable link"
          >🔗 Copy link</button>
        </div>
        <h2 style={{ fontSize: 'clamp(1.5rem,3.4vw,2.2rem)', margin: '10px 0 4px' }}>
          📁 {data.repo?.owner}/<strong>{data.repo?.name}</strong>
        </h2>
        <p style={{ margin: '4px 0 0', color: '#EDE7FF' }}>
          ⭐ {data.repo?.stars ?? 0} stars · {data.repo?.description || 'No description'}
        </p>
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-num">👥 {totals.contributors}</div><div className="kpi-label">contributors</div></div>
          <div className="kpi"><div className="kpi-num">⚡ {fmtNum(totals.effort)}</div><div className="kpi-label">effort pts = 100%</div><div className="kpi-sub">{fmtNum(totals.lines)} lines changed</div></div>
          <div className="kpi"><div className="kpi-num">💻 {totals.commits}</div><div className="kpi-label">commits (count)</div></div>
          <div className="kpi"><div className="kpi-num">🤝 {totals.prs} · 💬 {totals.issues}</div><div className="kpi-label">reviews + issues</div></div>
        </div>
        {!hasEffort && (
          <div className="quote" style={{ color: '#fff' }}>⚠️ Effort data missing (stale cache) — showing commit counts. Re-analyze to get line-weighted shares. <button className="btn small sunny" onClick={() => { sessionStorage.removeItem('fs-instant'); window.location.reload(); }}>🔄 Re-analyze</button></div>
        )}
        <div style={{ background: 'rgba(0,0,0,.28)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 16, padding: 14 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <strong>⚖️ 100% basis:</strong>
            <button className={`btn small ${effectiveBasis === 'effortPct' ? '' : 'ghost'}`} onClick={() => setBasis('effortPct')}>⚡ True effort</button>
            <button className={`btn small ${effectiveBasis === 'commitPct' ? '' : 'ghost'}`} onClick={() => setBasis('commitPct')}>💻 Commit count</button>
            <span className="muted" style={{ color: '#D9D1FF', fontSize: '.82rem' }}>
              {effectiveBasis === 'effortPct'
                ? 'lines changed × file weight (code 1.0, docs 0.25) × content boost — README-only can’t tie a full build'
                : 'raw commit count — kept for transparency, easy to game'}
            </span>
          </div>
          <ShareBar people={sorted} basis={effectiveBasis} />
        </div>
      </motion.section>

      <div className="analyze-layout two-col">
        <div className="card glass">
          <div className="section-title"><h3>🍩 Who did the work?</h3><span className="pill">100% = {effectiveBasis === 'effortPct' ? `${fmtNum(totals.effort)} effort pts` : `${totals.commits} commits`}</span></div>
          <div style={{ marginTop: 12 }}><ContributionDonut people={sorted} basis={effectiveBasis} /></div>
          <p className="muted" style={{ fontSize: '.83rem', marginBottom: 0 }}>
            💡 <strong>Effort %</strong> = lines changed × file importance (core <code>.py</code> 4× a <code>.md</code>) × content boost for model/training code.
            A README-only commit scores ~5 pts; an 800-line feature scores ~960. That’s why equal commit counts don’t split 50-50.
          </p>
        </div>
        <div className="card glass">
          <div className="section-title"><h3>🧠 What kind of work?</h3><span className="pill">stage signals</span></div>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {stageTotals.length === 0 && <p className="muted">🌱 No stage signals detected.</p>}
            {stageTotals.map((s) => (
              <div key={s.k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.9rem' }}>
                  <strong>{STAGE_EMOJI[s.k] || '📌'} {s.k} ×{s.v}</strong>
                  <strong className="ring-num">{fmtPct(s.pct)}</strong>
                </div>
                <div className="neon-bar"><motion.div initial={{ width: 0 }} animate={{ width: `${s.pct}%` }} transition={{ duration: 0.6 }} style={{ background: 'linear-gradient(90deg,#FFC93C,#FF6B9D)' }} /></div>
              </div>
            ))}
          </div>
          <div className="quote" style={{ marginTop: 14 }}>
            🧪 <strong>How to read this:</strong> compare <strong>Effort %</strong> vs <strong>Commit %</strong> on each card. Big gap = many tiny/docs commits. Aligned = consistent builder.
          </div>
        </div>
      </div>

      <div className="section-title"><h3>🏆 Leaderboard — ranked by {effectiveBasis === 'commitPct' ? 'commit count 💻' : 'true effort ⚡'}</h3><span className="pill active">code 4× docs · lines counted</span></div>
      {top3.length > 0 && (
        <div className="podium top3">
          {top3.map((p, i) => <ContributorCard key={p.login} person={p} totals={totals} index={i} />)}
        </div>
      )}
      {rest.length > 0 && (
        <div className="contrib-grid">
          {rest.map((p, i) => <ContributorCard key={p.login} person={p} totals={totals} index={i + 3} />)}
        </div>
      )}

      <div className="card">
        <div className="section-title"><h3>📊 Full breakdown</h3><span className="pill">{totals.contributors} people · {fmtNum(totals.effort)} effort pts = 100%</span></div>
        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          <table>
            <thead><tr><th>🏅 Rank</th><th>🧑‍💻 Person</th><th>⚡ Effort + %</th><th>📝 Lines</th><th>💻 Commits + %</th><th>🗂️ Top file</th><th>🤝 PRs</th><th>📅 Days</th></tr></thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.login}>
                  <td><strong style={{ color: p.color }}>{p.rank <= 3 ? ['🥇', '🥈', '🥉'][p.rank - 1] : `#${p.rank}`}</strong></td>
                  <td><strong>@{p.login}</strong></td>
                  <td><strong>{fmtNum(p.effort)}</strong> <span className="pill" style={{ borderColor: p.color }}>{fmtPct(p.effortPct)}</span></td>
                  <td><span title={`+${p.lines_added || 0} added, −${p.lines_removed || 0} removed · code ${p.code_churn || 0}, docs ${p.docs_churn || 0}`}>{fmtLines(p)}</span></td>
                  <td>{p.commits} <span className="muted">({fmtPct(p.commitPct, 0)})</span></td>
                  <td className="muted" style={{ fontSize: '.82rem' }}>{(p.top_files || [])[0] ? `📄 ${(p.top_files[0].file || '').split('/').pop()} · ${Math.round(p.top_files[0].effort)}` : '—'}</td>
                  <td>{p.prs}</td>
                  <td>{p.active_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: '.83rem' }}>
          📐 Effort % = file-weighted churn ÷ {fmtNum(totals.effort)} pts. Code <code>.py/.ipynb</code> ×1.0, docs <code>.md</code> ×0.25, model/training content ×1.2, per-file cap 2000 lines. Additions + deletions both count. Percentages may not sum to exactly 100% due to rounding. Line count is an effort proxy, not a quality grade.
        </p>
      </div>

      <div className="quote">
        💡 <strong>Want this saved + peer-confirmed?</strong> Sign up to add permanent 📝 logs with 🔗 links, multipliers ×1.2–2.0, and a shareable team report. <Link to="/register">🚀 Get started</Link>
        {' · '}<Link to="/">🔍 Analyze another repo</Link>
      </div>
    </div>
  );
}
