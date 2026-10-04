import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../services/api';
import { useAuth } from '../hooks/useAuth';
export default function GithubCallback(){
  const [q]=useSearchParams();const [msg,setMsg]=useState('⏳ Connecting to GitHub… 🐙');const {setToken,setUser}=useAuth();const nav=useNavigate();
  useEffect(()=>{
    const code=q.get('code');const state=q.get('state');const err=q.get('error');
    if(err){setMsg('⚠️ GitHub said no: '+err+'. Try again or use email.');return;}
    if(!code){setMsg('⚠️ Missing code from GitHub. Try again.');return;}
    (async()=>{
      try{
        const r=await fetch(`${API_BASE}/auth/github/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state||'')}`);
        const j=await r.json();
        if(!r.ok) throw new Error(j.detail||'GitHub login failed.');
        localStorage.setItem('fs-token',j.token);setToken(j.token);setUser(j.user);
        setMsg(`🎉 Welcome, @${j.user.github_login}! ${j.isNew?'Account created.':'Logged in.'} ${(j.linked_teams||[]).length?`🔗 Linked ${j.linked_teams.length} team(s).`:''}`);
        setTimeout(()=>nav(j.next||'/dashboard'),900);
      }catch(e){setMsg('⚠️ '+e.message);}
    })();
  },[q,setToken,setUser,nav]);
  return (<div className="auth-wrap"><div className="card auth-card" style={{textAlign:'center'}}><div style={{fontSize:'2.4rem'}}>🐙</div><h2>GitHub login</h2><p role="status">{msg}</p><p><Link className="btn small ghost" to="/login">🔑 Back to login</Link></p></div></div>);
}
