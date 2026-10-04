import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import MemberStatusPill from './MemberStatusPill';
export default function TeamCard({ team }) {
  const pct = team.total ? Math.round(100 * team.accepted / team.total) : 0;
  return (
    <motion.div className="card glass" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#7C5CFF,#4DD8FF,#FFC93C)' }} />
      <h3 style={{ margin: '0 0 6px' }}>📁 <Link to={`/teams/${team.id}`}>{team.name}</Link></h3>
      <p className="muted">{team.description || 'No description yet — add one so teammates know what counts. 📝'}</p>
      <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><MemberStatusPill status={team.status} /> <span className="pill">✅ {team.accepted}/{team.total} accepted · {pct}%</span></p>
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label={`Acceptance progress ${pct} percent`}>
        <motion.div initial={{ width: 0 }} animate={{ width: pct + '%' }} transition={{ duration: 0.7 }} />
      </div>
      <p className="muted" style={{ fontSize: '.83rem', margin: '6px 0' }}>{pct === 100 ? '👑 Fully accepted — team is live!' : pct >= 50 ? '⚡ Majority in — almost royal.' : '🌱 Waiting for teammates to accept.'}</p>
      <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Link className="btn small" to={`/teams/${team.id}/report`}>📊 View report</Link> <Link className="btn small ghost" to={`/teams/${team.id}`}>⚙️ Manage</Link></p>
    </motion.div>
  );
}
