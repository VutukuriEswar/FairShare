import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, API_BASE } from '../services/api';
import ConsentBanner from '../components/ConsentBanner';
const STEPS = [
  ['📁', 'Paste GitHub link', 'Any PUBLIC repo — instant leaderboard with commit % + impact %, donut + 100% bar. No signup. 👑'],
  ['📝', 'Log work + links', '2-min logs with 🔗 links (Colab, Kaggle, HF, arXiv, Figma, Notion…) verified inside. Multipliers ×1.2–2.0. 🧠'],
  ['🤝', 'Teammates confirm', 'Any 1 ✅ confirm makes it count. 🔒 Permanent — preview first, no edit/delete.'],
  ['📊', 'Share the royal report', 'Same evidence for all — GitHub 💻 + confirmed logs 📝 with % shares. 🖨️ Print it.'],
];
const validRepo = (v) => /^https?:\/\/github\.com\/[^/]+\/[^/]+/.test((v || '').trim());
export default function Landing() {
  const [msg, setMsg] = useState(''); const [repo, setRepo] = useState(''); const [busy, setBusy] = useState(false); const nav = useNavigate();
  async function loadDemo() {
    setMsg('🌱 Seeding demo…');
    try { const r = await api('/demo/seed', { method: 'POST' }); if (r.token) localStorage.setItem('fs-token', r.token); setMsg('🎉 Demo ready!'); window.location.href = '/dashboard'; }
    catch (e) { setMsg('⚠️ ' + e.message); }
  }
  async function analyze(e) {
    e?.preventDefault(); setMsg('');
    if (!validRepo(repo)) { setMsg('⚠️ Paste a link like https://github.com/owner/repo'); return; }
    setBusy(true); setMsg('🔍 Reading commits → 💬 PRs → 🍩 percentages…');
    try {
      const r = await fetch(API_BASE + '/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repo_url: repo.trim() }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.detail || 'Analyze failed');
      sessionStorage.setItem('fs-instant', JSON.stringify(j)); setMsg('🎉 Done — opening your leaderboard!');
      nav('/analyze?repo=' + encodeURIComponent(repo.trim()));
    } catch (e) { setMsg('⚠️ ' + e.message); }
    setBusy(false);
  }
  const ok = validRepo(repo);
  return (<div style={{ display: 'grid', gap: 16 }}>
    <ConsentBanner />
    <motion.section className="hero" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <span className="hero-tape">👑 Royal neon · GitHub + confirmed logs · student teams</span>
      <h1>Proof of effort,<br />without the arguments. 💎</h1>
      <p>Paste a GitHub link 📁 → get a <strong style={{ color: '#FFE9A8' }}>royal leaderboard</strong> with <strong style={{ color: '#FFE9A8' }}>% shares, donut + 100% bar</strong>. Add peer-confirmed logs 📝 with 🔗 links from <strong>any platform</strong> 🏋️📦📄📖🎨🤝 — verified inside, immutable 🔒.</p>
      <form onSubmit={analyze} style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 14 }}>
        <div style={{ position: 'relative', maxWidth: 400, flex: '1 1 280px' }}>
          <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="📁 https://github.com/owner/repo" style={{ maxWidth: 400, paddingRight: 44 }} aria-label="GitHub repo URL" aria-invalid={repo ? !ok : undefined} />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} aria-hidden="true">{!repo ? '👑' : ok ? '✅' : '⚠️'}</span>
        </div>
        <button className="btn sunny" type="submit" disabled={busy} style={{ minWidth: 150 }}>📊 {busy ? 'Reading…' : 'Reveal %'}</button>
      </form>
      {busy && (
        <div style={{ maxWidth: 520, margin: '12px auto 0' }} aria-hidden="true">
          <div className="stackbar"><motion.div animate={{ x: ['-100%', '250%'] }} transition={{ duration: 1.1, repeat: Infinity }} style={{ width: '35%', background: 'linear-gradient(90deg,#FFC93C,#FF6B9D)' }} /></div>
        </div>
      )}
      <p style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        <Link className="btn secondary" to="/register">🚀 Get started</Link>
        <button className="btn ghost" onClick={loadDemo}>🎲 Load demo</button>
        <button className="btn ghost" onClick={() => { setRepo('https://github.com/pytorch/examples'); }}>⚡ Try pytorch/examples</button>
      </p>
      {msg && <p role="status" style={{ background: 'rgba(0,0,0,.35)', display: 'inline-block', padding: '6px 14px', borderRadius: 999 }}><strong>{msg}</strong></p>}
      <p style={{ color: '#D9D1FF', fontSize: '.88rem' }}>⚡ Instant, no signup · 🍩 Donut + 100% bar · 🔒 Logs permanent after preview · ✅ Any-1 confirm counts</p>
      <div className="kpi-grid" style={{ maxWidth: 640, margin: '14px auto 0' }}>
        {[['🍩', 'Donut %', 'commit split'], ['📊', '100% bar', 'team balance'], ['⚡', 'Impact %', 'weighted fair'], ['🏆', 'Podium', 'ranked']].map(([e, t, s]) => (
          <div key={t} className="kpi" style={{ textAlign: 'center' }}><div style={{ fontSize: '1.4rem' }}>{e}</div><div className="kpi-label">{t}</div><div className="kpi-sub">{s}</div></div>
        ))}
      </div>
    </motion.section>
    <section className="steps">
      {STEPS.map(([n, t, d], i) => <motion.div key={t} className="card glass step" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}><div className="num">{i + 1}</div><div style={{ fontSize: '1.6rem' }}>{n}</div><h3 style={{ margin: '6px 0' }}>{t}</h3><p className="muted">{d}</p></motion.div>)}
    </section>
    <section className="grid two">
      <div className="card glass"><h2>🔗 Links from everywhere</h2><ul><li>🏋️ Training: Colab, Kaggle, HF Spaces, W&B</li><li>📦 Data: Kaggle Datasets, HF Datasets, Zenodo</li><li>📄 Learning: arXiv, courses, tutorials</li><li>🎨📖🤝 Design, docs, coordination too</li></ul><p className="muted">We fetch title + code inside → multiplier ×1.2–2.0. Mismatch = ×0.5 flagged. Verified links boost your impact %.</p></div>
      <div className="card glass"><h2>💬 Teams say</h2><div className="quote">“The percentages ended the debate — 57% vs 14% is hard to argue with.” — 🦊 Demo team</div><div className="quote" style={{ marginTop: 10 }}>“My Colab link doubled my impact %. Worth it.” — 🐼 Priya</div></div>
    </section>
  </div>);
}
