import React from 'react';
export default function ConfidenceBadge({level,note}){
  const c=level==='high'?'active':level==='medium'?'pending':'declined';
  const e=level==='high'?'💪':level==='medium'?'👍':'🌱';
  return <span className={`pill ${c}`} title={note}>{e} confidence: {level||'low'}</span>;
}
