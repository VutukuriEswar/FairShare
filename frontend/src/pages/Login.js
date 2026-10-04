import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { continueWithGithub } from '../services/github';
import { useAuth } from '../hooks/useAuth';
import Toast from '../components/Toast';
export default function Login(){
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [show,setShow]=useState(false);const [err,setErr]=useState('');
  const {setToken}=useAuth();const nav=useNavigate();
  async function submit(e){e.preventDefault();setErr('');if(!email||!password){setErr('📧 Email and 🔑 password are required.');return;}try{const r=await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})});setToken(r.token);nav('/dashboard');}catch(e){if(e.verify_required){nav('/register?verify='+encodeURIComponent(e.email||email));return;}setErr(e.message);}}
  return (<div className="auth-wrap"><div className="card auth-card"><div style={{fontSize:'2rem'}}>🔑</div><h2>Welcome back! 👋</h2><p className="muted">Log in to see your teams 📁 and reports 📊.</p><Toast msg={err}/><form onSubmit={submit}><div className="field"><label>📧 Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@uni.edu"/></label></div><div className="field"><label>🔑 Password<input type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••"/> </label><button type="button" className="btn small ghost" onClick={()=>setShow(!show)}>{show?'🙈 Hide':'👁️ Show'}</button></div><button className="btn" type="submit" style={{marginTop:12,width:'100%',justifyContent:'center'}}>✨ Login</button></form><p style={{textAlign:'center'}} className="muted">— or —</p><button className="btn ghost" type="button" style={{width:'100%',justifyContent:'center'}} onClick={async()=>{setErr('');try{await continueWithGithub();}catch(e){setErr(e.message);}}}>🐙 Continue with GitHub</button><p>No account? <Link to="/register">✏️ Register</Link></p></div></div>);
}
