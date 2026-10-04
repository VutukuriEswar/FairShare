import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
export default function ConfirmInbox({teamId}){
  const [items,setItems]=useState([]);const [msg,setMsg]=useState('');
  async function load(){try{setItems((await api(`/teams/${teamId}/inbox`)).pending||[]);}catch(e){setMsg(e.message);}}
  useEffect(()=>{load();},[teamId]);
  async function review(id,decision){try{await api(`/logs/${id}/confirm`,{method:'POST',body:JSON.stringify({decision})});setMsg(decision==='confirm'?'✅ Confirmed — now counts!':'🚩 Flagged with context.');load();}catch(e){setMsg('⚠️ '+e.message);}}
  if(!items.length) return <div className="card soft"><h3>🤝 Confirm inbox</h3><p className="muted">📭 Nothing awaiting your confirmation. Logs need any 1 teammate ✅ to count.</p>{msg&&<p>{msg}</p>}</div>;
  return (<div className="card"><h3>🤝 Confirm inbox ({items.length} ⏳)</h3><p className="muted">Your ✅ makes it count. You cannot confirm your own. 🚩 = needs context (still visible).</p>{msg&&<p role="status">{msg}</p>}
    {items.map(it=><div key={it.local_id} className="card soft" style={{margin:'8px 0'}}><strong>📌 {it.topic}</strong><p className="muted">🧑‍🎓 {it.author} · ⏱️ {it.minutes}m · 🔗 {it.link_domain||'no link'} {it.link_domain&&`(×${it.multiplier})`}</p><p style={{display:'flex',gap:8}}><button className="btn small secondary" onClick={()=>review(it.local_id,'confirm')}>✅ Confirm</button><button className="btn small ghost" onClick={()=>review(it.local_id,'flag')}>🚩 Flag</button></p></div>)}</div>);
}
