import React from 'react';
import MultiplierBadge from './MultiplierBadge';
export default function LinkPreview({preview}){
  if(!preview) return null;
  const p=preview.parsed||{};
  return (<div className="card soft" role="status" style={{marginTop:12}}>
    <h4>🔍 Is this correct? (preview — logs are permanent)</h4>
    <p>🌐 Domain: <strong>{p.domain||'— no link —'}</strong> · 👪 Family: <strong>{p.family}</strong></p>
    {p.title&&<p>📝 Title: {p.title}</p>}
    {(p.signals?.code_hits||[]).length>0&&<p>💻 Code inside: <code>{p.signals.code_hits.join(', ')}</code></p>}
    <p><MultiplierBadge mult={preview.multiplier} verified={true}/> predicted <strong>+{preview.predicted_points} pts</strong></p>
    <p className="muted">💬 {preview.verification_note}</p>
    <p className="pill pending">⚠️ {preview.immutable_warning}</p>
  </div>);
}
