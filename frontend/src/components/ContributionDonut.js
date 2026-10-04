import React from 'react';
import { fmtPct, fmtLines } from '../utils/share';

export default function ContributionDonut({ people = [], size = 220, thickness = 30, basis = 'effortPct', label = '' }) {
  if (!people.length) return <p className="muted">📭 No contributors yet.</p>;
  const val = (p) => Number(p[basis] || 0) / 100;
  const total = people.reduce((s, p) => s + Number(p[basis === 'commitPct' ? 'commits' : 'effort'] || 0), 0);
  const R = (size - thickness) / 2 - 4;
  const C = 2 * Math.PI * R;
  const cx = size / 2, cy = size / 2;
  let acc = 0;
  const segs = people.map((p) => {
    const frac = val(p);
    const seg = { ...p, frac, offset: acc };
    acc += frac;
    return seg;
  });
  const leader = [...people].sort((a, b) => (b[basis] || 0) - (a[basis] || 0))[0];
  const unit = basis === 'commitPct' ? 'commits' : 'effort pts';
  return (
    <div className="donut-wrap">
      <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
        <svg width={size} height={size} role="img" aria-label="Contribution share donut chart" style={{ transform: 'rotate(-90deg)', filter: 'drop-shadow(0 0 18px rgba(124,92,255,.5))' }}>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={thickness} />
          {segs.map((s) => (
            <circle
              key={s.login}
              cx={cx} cy={cy} r={R} fill="none"
              stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${Math.max(0, s.frac * C - 3)} ${C}`}
              strokeDashoffset={-s.offset * C}
              strokeLinecap="butt"
            >
              <title>{`@${s.login}: ${fmtPct(s[basis])} ${label || unit} · ${s.commits} commits · ${fmtLines(s)} lines`}</title>
            </circle>
          ))}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
          <div>
            <div style={{ fontSize: '.72rem', fontWeight: 800, letterSpacing: '.08em', opacity: .85 }}>👑 LEADER</div>
            <div className="ring-num" style={{ fontSize: '1.5rem' }}>{fmtPct(leader?.[basis] || 0)}</div>
            <div style={{ fontSize: '.82rem', fontWeight: 700 }}>@{leader?.login}</div>
          </div>
        </div>
      </div>
      <div className="donut-legend">
        {people.slice(0, 8).map((p) => (
          <div key={p.login} className="legend-row" title={`${p.commits} commits · ${fmtLines(p)} lines · effort ${Math.round(Number(p.effort || 0))}`}>
            <span className="legend-dot" style={{ background: p.color, color: p.color }} />
            <span style={{ flex: 1 }}><strong>@{p.login}</strong> <span className="muted">{basis === 'commitPct' ? `${p.commits} 💻` : `${fmtLines(p)} 📝`}</span></span>
            <strong className="ring-num">{fmtPct(p[basis])}</strong>
          </div>
        ))}
        {people.length > 8 && <div className="muted">+{people.length - 8} more contributors</div>}
      </div>
    </div>
  );
}
