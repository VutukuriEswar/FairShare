import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import Toast from '../components/Toast';
import { isValidEmail } from '../utils/formatters';
export default function CreateTeam(){
  const [name,setName]=useState('');const [desc,setDesc]=useState('');const [repo,setRepo]=useState('');const [deadline,setDeadline]=useState('');
  const [chip,setChip]=useState('');const [emails,setEmails]=useState([]);const [err,setErr]=useState('');const [done,setDone]=useState(null);
  const nav=useNavigate();
  function addChip(e){if(e.key==='Enter'){e.preventDefault();const v=chip.trim().toLowerCase();if(!isValidEmail(v)){setErr('⚠️ Invalid email: '+chip);return;}if(emails.includes(v)){setErr('⚠️ Duplicate email — already added.');return;}setEmails([...emails,v]);setChip('');setErr('');}}
  async function submit(e){e.preventDefault();setErr('');if(name.length<2){setErr('📝 Project name required.');return;}if(!/^https?:\/\/github\.com\/.+\/.+/.test(repo)){setErr('📁 Repo URL must look like https://github.com/owner/repo');return;}
    try{const r=await api('/teams',{method:'POST',body:JSON.stringify({name,description:desc,repo_url:repo,deadline,member_emails:emails})});setDone(r);}catch(e){setErr(e.message);}}
  if(done) return (<div className="card" style={{textAlign:'center'}}><div style={{fontSize:'2.4rem'}}>🎉</div><h2>Team created ✓</h2><p>Status: <span className="pill active">⏳ {done.team.status}</span></p>{Object.keys(done.inviteLinks||{}).length>0?(<><p>📧 SMTP off — copy these invite links manually 💌:</p><ul style={{textAlign:'left'}}>{Object.entries(done.inviteLinks).map(([e,l])=><li key={e}>👤 {e}: <code style={{wordBreak:'break-all'}}>{l}</code></li>)}</ul></>):<p>📧 Invite emails sent! Tell teammates to check spam too. 💌</p>}<button className="btn" onClick={()=>nav('/dashboard')}>📁 Go to dashboard</button></div>);
  return (<div className="card" style={{maxWidth:680}}><div style={{fontSize:'2rem'}}>🆕</div><h2>Create team 📁</h2><p className="muted">Link a <strong>PUBLIC</strong> repo 📁, add teammates with Enter ⏎, and FairShare handles invites 💌.</p><Toast msg={err}/>
    <form onSubmit={submit}><div className="field"><label>📝 Project name<input value={name} onChange={e=>setName(e.target.value)} required placeholder="CIFAR-10 Classifier 🧠"/></label></div>
    <div className="field"><label>💬 Description<textarea value={desc} onChange={e=>setDesc(e.target.value)} rows="3" placeholder="What are you building? Helps teammates confirm logs. 🔍"/></label></div>
    <div className="field"><label>📁 Public GitHub repo URL<input value={repo} onChange={e=>setRepo(e.target.value)} placeholder="https://github.com/owner/repo" required/></label><span className="help">🔍 We check via GitHub API that it is public.</span></div>
    <div className="field"><label>⏰ Deadline<input type="datetime-local" value={deadline} onChange={e=>setDeadline(e.target.value)}/></label></div>
    <div className="field"><label>👥 Teammate emails (press ⏎ Enter to add)<input value={chip} onChange={e=>setChip(e.target.value)} onKeyDown={addChip} placeholder="teammate@uni.edu 💌"/></label></div>
    <div className="chips">{emails.map(m=><span key={m} className="chip">👤 {m}<button type="button" aria-label={'Remove '+m} onClick={()=>setEmails(emails.filter(x=>x!==m))}>×</button></span>)}</div>
    <button className="btn" type="submit">💌 Create + send invites</button></form></div>);
}
