import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { continueWithGithub } from '../services/github';
import { useAuth } from '../hooks/useAuth';
export default function Settings(){
  const [gh,setGh]=useState('');const [msg,setMsg]=useState('');const [me,setMe]=useState(null);const {setToken,setUser}=useAuth();
  async function load(){try{setMe(await api('/users/me'));}catch(e){}}
  useEffect(()=>{load();},[]);
  async function link(){try{const r=await api('/users/me/github',{method:'PATCH',body:JSON.stringify({github_url:gh})});setMsg(`✅ Connected @${r.github_login}! Verify on 👤 Profile for ✅.`);load();}catch(e){setMsg('⚠️ '+e.message);}}
  async function disconnect(){if(!window.confirm('🔓 Disconnect GitHub @login? Reports will fall back to email matching.'))return;try{await api('/users/me/github',{method:'DELETE'});setMsg('🔓 Disconnected.');load();}catch(e){setMsg('⚠️ '+e.message);}}
  async function wipe(){if(!window.confirm('🗑️ Delete ALL your data + account? This cannot be undone.'))return;await api('/users/me',{method:'DELETE'});setToken('');setUser(null);window.location.href='/';}
  return (<div className="card" style={{maxWidth:640}}><div style={{fontSize:'2rem'}}>⚙️</div><h2>Settings</h2>{msg&&<p role="status">{msg}</p>}
    <h3>📝 Logging</h3><p className="muted">Log from any team page with 🔍 preview. Logs are 🔒 permanent — no edit/delete. Any 1 teammate ✅ confirm counts.</p>
    <h3>🔗 Links</h3><p className="muted">Attach any link 🏋️📦📄📖🎨🤝 — we verify title + code inside for ×1.2–2.0. 🔒</p>
    <h3>💻 GitHub</h3>
    {me?.github_login?<p><span className="pill">🐙 @{me.github_login}</span> <span className={`pill ${me.github_verified?'shared':'pending'}`}>{me.github_verified?'✅ verified':'⚠️ linked'}</span></p>:<p className="muted">📭 No GitHub linked yet — connect it on your <Link to="/profile">👤 Profile</Link>.</p>}
    <p><Link className="btn small" to="/profile">👤 Manage GitHub on Profile</Link></p>
    <details><summary className="muted">Advanced: manual login + OAuth here</summary>
    <p style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="btn small" onClick={async()=>{try{await continueWithGithub();}catch(e){setMsg('⚠️ '+e.message);}}}>🐙 {me?.github_login?'Reconnect with GitHub':'Connect with GitHub'}</button>{me?.github_login&&<button className="btn small ghost" onClick={disconnect}>🔓 Disconnect</button>}</p>
    <div className="field"><label>✏️ Paste profile link<input value={gh} onChange={e=>setGh(e.target.value)} placeholder="https://github.com/octocat"/></label></div><button className="btn small ghost" onClick={link}>🔗 Link this link</button></details>
    <h3>☢️ Danger zone</h3><div className="card soft"><p>🗑️ Removes your records, summaries, labels + account everywhere.</p><button className="btn small danger" onClick={wipe}>🗑️ Delete all my data + account</button></div></div>);
}
