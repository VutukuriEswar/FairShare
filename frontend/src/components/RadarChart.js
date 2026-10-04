import React from 'react';
export default function RadarChart({scores, size=230}){
  const keys=['Code','Docs','Review','Research','Consistency'];
  const emoji={Code:'💻',Docs:'📝',Review:'🤝',Research:'🔍',Consistency:'📅'};
  const vals=keys.map(k=>Number(scores?.[k]||0));
  const max=Math.max(10,...vals);
  const cx=size/2,cy=size/2,R=size/2-34;
  const pt=(i,v)=>{const a=(Math.PI*2*i/keys.length)-Math.PI/2;const r=R*v/max;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];};
  const poly=vals.map((v,i)=>pt(i,v).join(',')).join(' ');
  return (<div className="card soft" style={{textAlign:'center',marginTop:10}}><div aria-hidden="true">🕸️ skill web</div><svg width={size} height={size} role="img" aria-label="Radar chart of five contribution areas" style={{background:'var(--bg2)',borderRadius:16,border:'2px solid var(--border)'}}>
    {[0.25,0.5,0.75,1].map(f=><polygon key={f} points={keys.map((_,i)=>pt(i,max*f).join(',')).join(' ')} fill="none" stroke="var(--border-soft)" strokeWidth="2" strokeDasharray="4 4"/>)}
    {keys.map((k,i)=>{const [x,y]=pt(i,max);return <line key={k} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border-soft)" strokeWidth="2"/>;})}
    {keys.map((k,i)=>{const [x,y]=pt(i,max*1.22);return <text key={k} x={x} y={y} fontSize="12" fontWeight="700" textAnchor="middle" fill="var(--text)">{emoji[k]} {k}</text>;})}
    <polygon points={poly} fill="rgba(108,92,231,.35)" stroke="#6C5CE7" strokeWidth="3" strokeLinejoin="round"/>
    {vals.map((v,i)=>{const [x,y]=pt(i,v);return <circle key={i} cx={x} cy={y} r="5" fill="var(--sun)" stroke="var(--border)" strokeWidth="2"/>;})}
  </svg></div>);
}
