import React from 'react';
export default function EmptyState({ title, children, emoji = '💎' }) {
  return (
    <div className="card glass" style={{ textAlign: 'center', padding: 34 }}>
      <div style={{ fontSize: '2.6rem', filter: 'drop-shadow(0 0 14px rgba(124,92,255,.6))' }} aria-hidden="true">{emoji}</div>
      <h3 style={{ margin: '8px 0' }}>{title || 'Nothing here yet'}</h3>
      <div className="muted">{children}</div>
    </div>
  );
}
export function Loader() { return <div aria-live="polite"><div className="skel" style={{ marginBottom: 10 }} /><div className="skel" /><p>💎 Loading royal data…</p></div>; }
