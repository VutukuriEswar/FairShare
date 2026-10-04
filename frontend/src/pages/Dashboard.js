import React from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import TeamCard from '../components/TeamCard';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
export default function Dashboard() {
  const { data, loading, error } = useFetch('/teams');
  if (loading) return <Loader label="👑 Loading your royal teams…" />;
  if (error) return <div className="card">⚠️ Error: {error}</div>;
  const teams = data?.teams || [];
  const avgAccept = teams.length ? Math.round(100 * teams.reduce((s, t) => s + (t.total ? t.accepted / t.total : 0), 0) / teams.length) : 0;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="neon-hero">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>📁 My teams</h2>
          <span className="hero-badge">👑 {teams.length} team{teams.length === 1 ? '' : 's'} · {avgAccept}% accepted</span>
        </div>
        <p style={{ color: '#EDE7FF', margin: '6px 0 0' }}>Teams go live instantly — invite teammates and start logging. ⚡</p>
        <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 0 }}>
          <Link className="btn sunny" to="/create">➕ New team</Link>
          <Link className="btn ghost" to="/activity">🕒 My activity</Link>
          <Link className="btn ghost" to="/analyze">📊 Instant analyze</Link>
        </p>
      </section>
      {teams.length === 0
        ? <EmptyState title="📭 No teams yet" emoji="👑">Create a team ➕ or accept an invite email 💌 to get started.<br />Just curious? <strong>Load the demo 🎲</strong> from the home page.</EmptyState>
        : <div className="grid two">{teams.map((t) => <TeamCard key={t.id} team={t} />)}</div>}
    </div>
  );
}
