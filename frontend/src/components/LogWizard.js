import React, { useState } from 'react';
import { api } from '../services/api';
import LinkPreview from './LinkPreview';
import { CATEGORIES } from '../utils/constants';
const FAMILY_HINTS={
  training:'🏋️ Colab, Kaggle notebooks, HF Spaces, W&B, SageMaker — training runs + metrics',
  dataset:'📦 Kaggle Datasets, HF Datasets, OpenML, Zenodo — data found + used',
  paper:'📄 arXiv, PapersWithCode, courses, tutorials — what you learned',
  docs:'📖 docs, GitHub, StackOverflow — fixes + references',
  debugging:'🐛 error links + fix notes',
  tutorial:'🎓 courses + takeaways',
  other:'📌 anything: Figma, Notion, Trello, Miro, Streamlit demos, meeting notes'
};
export default function LogWizard({teamId,onDone}){
  const [topic,setTopic]=useState('');const [cat,setCat]=useState('training');const [mins,setMins]=useState(60);
  const [link,setLink]=useState('');const [notes,setNotes]=useState('');const [prev,setPrev]=useState(null);
  const [err,setErr]=useState('');const [busy,setBusy]=useState(false);const [ack,setAck]=useState(false);
  async function preview(e){e?.preventDefault();setErr('');setBusy(true);try{const r=await api('/logs/preview',{method:'POST',body:JSON.stringify({team_id:teamId,topic,category:cat,minutes:Number(mins),link_url:link,notes})});setPrev(r);}catch(e){setErr(e.message);}setBusy(false);}
  async function submit(){setErr('');if(!ack){setErr('☑️ Tick “looks right, submit permanently” — logs cannot be edited or deleted.');return;}setBusy(true);try{const r=await api('/logs',{method:'POST',body:JSON.stringify({team_id:teamId,topic,category:cat,minutes:Number(mins),link_url:link,notes})});setPrev(null);setTopic('');setLink('');setNotes('');setAck(false);onDone&&onDone(r);}catch(e){setErr(e.message);}setBusy(false);}
  return (<div className="card"><h3>📝 Log work (permanent 🔒)</h3>
    <p className="muted">2-min log: what + minutes + optional 🔗 link. Teammate ✅ confirms → counts. <strong>No edit, no delete after submit.</strong></p>
    {err&&<p role="alert" className="pill declined">⚠️ {err}</p>}
    <div className="field"><label>📌 Topic<input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Trained ResNet on CIFAR-10, acc 0.78→0.82"/></label></div>
    <div className="grid two"><div className="field"><label>📚 Category<select value={cat} onChange={e=>setCat(e.target.value)}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></label><span className="help">{FAMILY_HINTS[cat]}</span></div>
    <div className="field"><label>⏱️ Minutes<input type="number" min="1" max="960" value={mins} onChange={e=>setMins(e.target.value)}/></label></div></div>
    <div className="field"><label>🔗 Evidence link (optional, boosts ×1.2–2.0)<input value={link} onChange={e=>setLink(e.target.value)} placeholder="https://colab.research.google.com/… or kaggle / arxiv / figma / notion / trello…"/></label><span className="help">🏋️📦📄📖🎨🤝 all platforms: training, datasets, papers, docs, design, coordination. We read title + code inside to verify.</span></div>
    <div className="field"><label>💬 Notes (what changed?)<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows="2" placeholder="e.g. augmentation + lr 0.001, eval F1 up"/></label></div>
    <p style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="btn small ghost" onClick={preview} disabled={busy}>🔍 Preview — is this correct?</button></p>
    <LinkPreview preview={prev}/>
    {prev&&<><label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/> ✅ Looks right — submit permanently (no edit/delete)</label><p><button className="btn small" onClick={submit} disabled={busy||!ack}>🔒 Submit immutable log</button></p></>}
  </div>);
}
