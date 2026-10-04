import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { continueWithGithub } from '../services/github';
import Loader from '../components/Loader';
export default function AcceptInvite(){
  const {token}=useParams();const [info,setInfo]=useState(null);const [err,setErr]=useState('');const [pw,setPw]=useState('');const [name,setName]=useState('');
  const nav=useNavigate();
  useEffect(()=>{api('/invites/'+token).then(setInfo).catch(e=>setErr(e.message));},[token]);
  async function act(accept){
    if(accept){try{const r=await api(`/invites/${token}/accept`,{method:'POST',body:JSON.stringify({password:pw||undefined,name:name||undefined})});if(r.token)localStorage.setItem('fs-token',r.token);nav('/teams/'+r.team_id);}catch(e){setErr(e.message);}}
    else{await api(`/invites/${token}/decline`,{method:'POST'});nav('/');}
  }
  if(err) return <div className="card" style={{textAlign:'center'}}><div style={{fontSize:'2rem'}}>😢</div><h2>Invite issue</h2><p>⚠️ {err}</p><Link className="btn small" to="/">🏠 Home</Link></div>;
  if(!info) return <Loader/>;
  return (<div className="card" style={{maxWidth:580,margin:'24px auto'}}><div style={{fontSize:'2rem'}}>💌</div><h2>You are invited to {info.team_name}! 🎉</h2><p className="muted">📝 {info.description}</p><p>👤 Invited email: <strong>{info.email}</strong> · 📁 Repo: <a href={info.repo_url}>{info.repo_url}</a></p>
    <div className="quote">1️⃣ Accept below (register with 🔑 password or 🐙 GitHub) — accounts required for confirmed logs.<br/>2️⃣ Log work 📝 with optional 🔗 links; teammates ✅ confirm; immutable 🔒.</div>
    <div className="field"><label>🧑 Your name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ada Lovelace"/></label></div>
    <div className="field"><label>🔑 Password (for new accounts)<input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="6+ characters"/></label></div>
    <p style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="btn" onClick={()=>act(true)}>✅ Accept invite</button> <button className="btn ghost" onClick={()=>act(false)}>🙅 Decline</button></p><p style={{textAlign:'center'}} className="muted">— or —</p><button className="btn ghost" style={{width:'100%',justifyContent:'center'}} onClick={async()=>{try{await continueWithGithub(info.email);}catch(e){setErr(e.message);}}}>🐙 Accept with GitHub (auto-links 🔗)</button></div>);
}
