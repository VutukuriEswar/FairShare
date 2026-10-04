import React from 'react';
import { fmtPct } from '../utils/share';

export default function ShareBar({ people = [], basis = 'commitPct' }) {
  if (!people.length) return null;
  return (
    <div>
      <div className="stackbar" role="img" aria-label="Team contribution split, 100 percent stacked bar">
        {people.map((p) => (
          <div key={p.login} title={`@${p.login}: ${fmtPct(p[basis])}`} style={{ width: `${Math.max(p[basis] || 0, 0)}%`, background: p.color, boxShadow: `0 0 12px ${p.color}` }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {people.slice(0, 6).map((p) => (
          <span key={p.login} className="pill" style={{ borderColor: p.color }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, display: 'inline-block' }} />
            @{p.login} {fmtPct(p[basis])}
          </span>
        ))}
      </div>
    </div>
  );
}
