import React from 'react';
export default function MultiplierBadge({mult,verified}){
  if(!mult||mult<=1) return <span className="pill">📌 base claim ×1.0</span>;
  if(mult>=2) return <span className="pill active">✅ link-verified inside ×{mult}</span>;
  if(mult>=1.5) return <span className="pill active">🔗 link-verified ×{mult}</span>;
  return <span className="pill pending">⚠️ {verified?'generic':'unverified'} ×{mult}</span>;
}
