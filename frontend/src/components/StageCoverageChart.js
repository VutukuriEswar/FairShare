import React from 'react';
export default function StageCoverageChart({people,stages}){
  if(!stages?.length) return <p className="muted">🌱 No stage data yet — push some code and refresh GitHub.</p>;
  const emoji={Data:'📦',Model:'🧠',Training:'🏋️',Evaluation:'🧪',Docs:'📝',Other:'📌'};
  return (<div style={{overflowX:'auto'}}><table><thead><tr><th>🧑‍🎓 Person</th>{stages.map(s=><th key={s}>{emoji[s]||'📌'} {s}</th>)}</tr></thead><tbody>
    {people.map(p=><tr key={p.email}><td><strong>{p.name}</strong></td>{stages.map(s=>{const v=p.github?.stages?.[s]||0;return <td key={s}>{v>0?`✅ ${v}`:<span className="muted">—</span>}</td>;})}</tr>)}
  </tbody></table></div>);
}
