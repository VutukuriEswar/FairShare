import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
export default function Navbar({ theme, onTheme }) {
  const { user, setToken, setUser } = useAuth();
  const nav = useNavigate();
  return (
    <nav className="nav-sticky no-print" style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, padding: '10px 14px', flexWrap: 'wrap' }} aria-label="Main">
      <Link to="/" className="nav-logo"><span className="avatar" aria-hidden="true">👑</span> FairShare</Link>
      <span className="muted" style={{ fontSize: '.85rem' }}>💎 royal evidence · no arguments</span>
      <span style={{ flex: 1 }} />
      <span className="nav-links">
        {user ? (
          <>
            <Link to="/dashboard">📁 Dashboard</Link>
            <Link to="/activity">🕒 Activity</Link>
            <Link to="/profile">👤 Profile</Link>
            <button className="btn small ghost" onClick={() => { setToken(''); setUser(null); nav('/'); }}>👋 Logout</button>
          </>
        ) : (
          <>
            <Link to="/analyze">📊 Analyze</Link>
            <Link to="/login">🔑 Login</Link>
            <Link to="/register" className="btn small">✏️ Register</Link>
          </>
        )}
        <button onClick={onTheme} aria-label="Toggle theme" title="Toggle royal/dark" style={{ width: 48 }}> {theme === 'light' ? '🌙' : '☀️'}</button>
      </span>
    </nav>
  );
}
