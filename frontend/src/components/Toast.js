import React from 'react';
export default function Toast({msg}){ if(!msg) return null; return <div role="alert" className="card" style={{borderColor:'var(--danger)',background:'#FFF0F0',marginBottom:12}}>⚠️ {msg}</div>; }
