import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { continueWithGithub } from '../services/github';
import Loader from '../components/Loader';
export default function Profile(){
  const [q]=useSearchParams();const welcome=q.get('welcome');
  const [me,setMe]=useState(null);const [teams,setTeams]=useState([]);const [err,setErr]=useState('');const [msg,setMsg]=useState(welcome?'🎉 Email verified — welcome! Now connect GitHub 👇':'');
  const [ghInput,setGhInput]=useState('');const [busy,setBusy]=useState(false);
  async function load(){try{const m=await api('/users/me');setMe(m);if(m.github_login)setGhInput(`https://github.com/${m.github_login}`);try{setTeams((await api('/teams')).teams||[]);}catch(e){}}catch(e){setErr(e.message);}}
  useEffect(()=>{load();},[]);
  async function connect(e){e?.preventDefault();setErr('');setMsg('');if(!ghInput.trim()){setErr('🔗 Paste your GitHub profile link first, e.g. https://github.com/octocat');return;}setBusy(true);try{const r=await api('/users/me/github',{method:'PATCH',body:JSON.stringify({github_url:ghInput})});setMsg(`✅ Connected @${r.github_login}! ${r.message||''}`);load();}catch(e){setErr(e.message);}setBusy(false);}
  async function disconnect(){if(!window.confirm('🔓 Disconnect GitHub? Reports fall back to email matching.'))return;try{await api('/users/me/github',{method:'DELETE'});setMsg('🔓 Disconnected.');load();}catch(e){setErr(e.message);}}
  if(err&&!me) return <div className="card">⚠️ {err}</div>;
  if(!me) return <Loader/>;
  return (<div style={{maxWidth:680}}>
    <div className="report-head"><h2>👤 Profile</h2>{me.email_verified?<span className="pill active">✅ email verified</span>:<span className="pill pending">⚠️ unverified</span>}</div>
    {msg&&<p role="status" className="pill active">{msg}</p>}{err&&<p role="alert">⚠️ {err}</p>}
    <div className="card"><div style={{display:'flex',gap:12,alignItems:'center'}}><span className="avatar" style={{width:52,height:52,fontSize:'1.8rem'}}>🧑‍🎓</span><div><h3 style={{margin:0}}>{me.name}</h3><p className="muted" style={{margin:0}}>📧 {me.email}</p></div></div></div>
    <div className="card"><h3>🐙 GitHub connection</h3>
      {me.github_login?<><p><span className="pill">🐙 <a href={`https://github.com/${me.github_login}`}>@{me.github_login}</a></span> <span className={`pill ${me.github_verified?'shared':'pending'}`}>{me.github_verified?'✅ verified':'⚠️ linked — not proven yours yet'}</span></p><p style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="btn small" onClick={async()=>{try{await continueWithGithub();}catch(e){setErr(e.message);}}}>🐙 {me.github_verified?'Re-verify':'Verify it is mine — Verify with GitHub'}</button><button className="btn small ghost" onClick={disconnect}>🔓 Disconnect</button></p><div className="field"><label>✏️ Change link<input value={ghInput} onChange={e=>setGhInput(e.target.value)} placeholder="https://github.com/your-username"/></label></div><button className="btn small ghost" onClick={connect} disabled={busy}>🔗 Reconnect this link</button></>
      :<form onSubmit={connect}><div className="field"><label>🔗 Paste your GitHub profile link<input value={ghInput} onChange={e=>setGhInput(e.target.value)} placeholder="https://github.com/octocat"/></label><span className="help">We check the profile exists on GitHub. Only you can prove ownership — press Verify after. 💡</span></div><button className="btn small" type="submit" disabled={busy}>🔗 Connect it</button></form>}
    </div>
    <div className="card"><h3>📁 My teams ({teams.length})</h3>{teams.length===0?<p className="muted">📭 No teams yet — <Link to="/create">create one ➕</Link> or accept an invite 💌.</p>:teams.map(t=><p key={t.id}>📁 <Link to={`/teams/${t.id}`}>{t.name}</Link> <span className="pill">{t.status}</span></p>)}</div>
    <p><Link className="btn small ghost" to="/settings">⚙️ Settings</Link> <Link className="btn small ghost" to="/activity">🕒 My activity</Link></p>
  </div>);
}
