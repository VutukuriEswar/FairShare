import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import Loader from '../components/Loader';
import MemberStatusPill from '../components/MemberStatusPill';
import LogWizard from '../components/LogWizard';
import ConfirmInbox from '../components/ConfirmInbox';
import { countdown } from '../utils/formatters';
export default function TeamDetail(){
  const {id}=useParams();const [data,setData]=useState(null);const [err,setErr]=useState('');const [msg,setMsg]=useState('');
  async function load(){try{const r=await api('/teams/'+id);setData(r);}catch(e){setErr(e.message);}}
  useEffect(()=>{load();},[id]);
  if(err) return <div className="card">⚠️ Error: {err}</div>;
  if(!data) return <Loader/>;
  const {team,members}=data;
  async function resend(){const r=await api(`/teams/${id}/invites/resend`,{method:'POST'});setMsg('💌 Resent! '+(Object.values(r.inviteLinks||{}).join(' ')||'Check email (and spam).'));}
  async function revoke(mid){await api(`/teams/${id}/invites/${mid}`,{method:'DELETE'});load();}
  return (<div>
    <div className="report-head"><h2>📁 {team.name}</h2><span className="pill active">🌿 active</span><span className="pill">⏰ {countdown(team.deadline)}</span></div>
    <p className="muted">📝 {team.description} · 📁 <a href={team.repo_url}>{team.repo_url}</a></p>
    <p style={{display:'flex',gap:8,flexWrap:'wrap'}} className="no-print"><Link className="btn small" to={`/teams/${id}/report`}>📊 Open report</Link> <button className="btn small ghost" onClick={resend}>💌 Resend invites</button></p>
    {msg&&<p role="status" className="pill">✅ {msg}</p>}
    <div className="card"><h3>👥 Members</h3><table><thead><tr><th>👤 Email</th><th>📌 Status</th><th className="no-print">🛠️ Actions</th></tr></thead><tbody>
      {members.map(m=><tr key={m.id}><td>{m.email}</td><td><MemberStatusPill status={m.status}/></td><td className="no-print">{m.status==='invited'&&<button className="btn small ghost" onClick={()=>revoke(m.id)}>🗑️ Revoke</button>}</td></tr>)}
    </tbody></table></div>
    <LogWizard teamId={id} onDone={load}/>
    <ConfirmInbox teamId={id}/>
  </div>);
}
