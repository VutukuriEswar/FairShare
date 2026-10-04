import React from 'react';
import { Link } from 'react-router-dom';
export default function Footer() {
  return (
    <footer className="no-print footer-glass">
      <div className="card glass" style={{ display: 'inline-block', padding: '14px 22px' }}>
        👑 <strong>FairShare royal — proof of effort, without the arguments.</strong><br />
        <span className="muted">🔒 Logs permanent — preview first · ✅ Any-1 confirm counts · 📊 Percentages = share of 100%</span><br />
        <span className="muted"><Link to="/privacy">📜 Privacy</Link>{' · '}<Link to="/ethics">💛 Ethics</Link>{' · '}<Link to="/analyze">📊 Analyze</Link><br />MIT © 2026 Eswar Vutukuri · 💎 FairShare</span>
      </div>
    </footer>
  );
}
