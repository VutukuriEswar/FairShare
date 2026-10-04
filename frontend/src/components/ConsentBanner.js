import React from 'react';
export default function ConsentBanner(){
  const [hide,setHide]=React.useState(localStorage.getItem('fs-consent')==='1');
  if(hide) return null;
  return (<div className="card no-print" role="note" style={{borderColor:'var(--border)',background:'var(--bg2)',marginBottom:14}}><span className="hero-badge">✨ Evidence by consent + confirmation</span><p style={{margin:'10px 0'}}><strong>🔒 Logs are permanent.</strong> Check the 🔍 preview — no edit, no delete after submit. Any 1 teammate ✅ confirm makes it count. 🔗 Links verified inside boost ×1.2–2.0.</p>
  <button className="btn small sunny" onClick={()=>{localStorage.setItem('fs-consent','1');setHide(true);}}>👍 Got it</button></div>);
}
