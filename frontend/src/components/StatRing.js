import React from 'react';

export default function StatRing({ pct = 0, color = '#7C5CFF', size = 64, label = '' }) {
  const R = (size - 10) / 2;
  const C = 2 * Math.PI * R;
  const frac = Math.min(100, Math.max(0, Number(pct) || 0)) / 100;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="9" />
          <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={color} strokeWidth="9"
            strokeDasharray={`${frac * C} ${C}`} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '.8rem' }}>
          {Number(pct).toFixed(pct < 10 && pct > 0 ? 1 : 0)}%
        </div>
      </div>
      {label && <div style={{ fontSize: '.85rem', fontWeight: 700 }}>{label}</div>}
    </div>
  );
}
