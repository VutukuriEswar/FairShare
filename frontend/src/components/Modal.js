import React from 'react';
export default function Modal({open,onClose,children}){
  if(!open) return null;
  return (<div role="dialog" aria-modal="true" style={{position:'fixed',inset:0,background:'rgba(43,33,24,.45)',display:'grid',placeItems:'center',zIndex:50,padding:16}} onClick={onClose}>
    <div className="card" style={{maxWidth:520,width:'100%'}} onClick={e=>e.stopPropagation()}>📩 {children}<div style={{marginTop:12}}><button className="btn small ghost" onClick={onClose}>Close</button></div></div></div>);
}
