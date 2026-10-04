import React from 'react';
export default function Timeline({items}){
  if(!items?.length) return <p className="muted">📭 No shared activity yet — share a weekly summary to appear here.</p>;
  const max=Math.max(...items.map(i=>i.minutes),1);
  const byDay={};items.forEach(i=>{byDay[i.day]=byDay[i.day]||[];byDay[i.day].push(i);});
  return (<div>{Object.entries(byDay).map(([day,rows])=>(<div key={day} style={{marginBottom:12}}><strong>📅 {day}</strong><div className="timeline-bar" role="img" aria-label={`Activity on ${day}`}>{rows.map((r,j)=>(<div key={j} title={`${r.person}: ${r.minutes} min`} style={{height:Math.max(14,76*r.minutes/max)}}/>))}</div><div className="muted">{rows.map(r=>`🧑‍🎓 ${r.person} (${r.minutes}m)`).join(' · ')}</div></div>))}</div>);
}
