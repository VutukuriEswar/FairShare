import React from 'react';
const EMOJI={invited:'✉️',accepted:'✅',declined:'🙅',pending:'⏳',active:'🌿',private:'🔒',shared:'🌿'};
export default function MemberStatusPill({status}){
  return <span className={`pill ${status}`}>{EMOJI[status]||'📌'} {status}</span>;
}
